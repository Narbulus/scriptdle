"""
Resumable, low-disk batch extractor for Movie Packs and TV Season Packs.

Streams compact ~10-22 MB English center-channel MP3 audio one item at a time,
extracts with calibrated scene-window attribution, deletes the temporary MP3
immediately after each item finishes, and enforces a strict spend cap.
"""

import argparse
import json
import re
import sys
import urllib.parse
from pathlib import Path
from typing import Dict, List, Optional, Sequence, Tuple

from pipeline import export, extract, jellyfin, srt

REPO_ROOT = Path(__file__).resolve().parent.parent


def clean_episode_title(title: str) -> str:
    """Clean overly verbose multi-part Jellyfin episode titles into concise display labels."""
    text = re.sub(r"\s+", " ", (title or "")).strip()
    if not text:
        return ""
    # Collapse 3+ slash-joined multi-part titles like "Sozin's Comet: Part 1 / Part 2 / ..."
    parts = [p.strip() for p in text.split(" / ") if p.strip()]
    if len(parts) >= 3:
        prefix = parts[0].split(":")[0].strip()
        if prefix and all(p.startswith(prefix) for p in parts):
            return f"{prefix} (Parts 1-{len(parts)})"
        return f"{parts[0]} / {parts[-1]}"
    return text


def clean_episode_summary(overview: str, max_chars: int = 210) -> str:
    """Trim episode synopsis to 1-2 clean sentences suitable for a dropdown preview."""
    text = re.sub(r"\s+", " ", (overview or "")).strip()
    if not text or len(text) <= max_chars:
        return text
    # Prefer ending cleanly at a sentence boundary within max_chars
    clipped = text[:max_chars]
    last_punct = max(clipped.rfind(". "), clipped.rfind("! "), clipped.rfind("? "))
    if last_punct >= 70:
        return clipped[: last_punct + 1].strip()
    return clipped.rsplit(" ", 1)[0].rstrip(",;:") + "..."


def build_season_episodes_catalog(episodes: Sequence[dict], season_num: int) -> List[dict]:
    """Build ordered [{id, number, title, summary}] metadata for every episode in a season."""
    catalog: List[dict] = []
    seen = set()
    for ep in sorted(episodes, key=lambda e: int(e.get("IndexNumber") or 999)):
        ep_num = int(ep.get("IndexNumber") or 0)
        if ep_num <= 0:
            continue
        ep_code = f"s{season_num:02d}e{ep_num:02d}"
        if ep_code in seen:
            continue
        seen.add(ep_code)
        catalog.append({
            "id": ep_code,
            "number": ep_num,
            "title": clean_episode_title(ep.get("Name") or f"Episode {ep_num}"),
            "summary": clean_episode_summary(ep.get("Overview") or ""),
        })
    return catalog


def pick_spaced_episodes(episodes: Sequence[dict], count: int) -> List[dict]:
    """Select up to `count` evenly spaced episodes across a season (premiere -> mid -> finale)."""
    eps = list(episodes)
    if len(eps) <= count:
        return eps
    if count <= 1:
        return [eps[0]]
    chosen: List[dict] = []
    seen = set()
    for i in range(count):
        idx = round(i * (len(eps) - 1) / (count - 1))
        if idx not in seen:
            seen.add(idx)
            chosen.append(eps[idx])
    return chosen


def pick_top_rated_episodes(episodes: Sequence[dict], count: int) -> List[dict]:
    """Select up to `count` highest-rated episodes (by CommunityRating), returned in season order.

    Falls back to `pick_spaced_episodes` if no episode has a positive rating.
    """
    eps = list(episodes)
    if len(eps) <= count:
        return eps
    if not any(float(ep.get("CommunityRating") or 0.0) > 0 for ep in eps):
        return pick_spaced_episodes(eps, count)
    ranked = sorted(
        eps,
        key=lambda ep: (
            -float(ep.get("CommunityRating") or 0.0),
            int(ep.get("IndexNumber") or 999),
        ),
    )
    chosen = ranked[:count]
    chosen.sort(key=lambda ep: int(ep.get("IndexNumber") or 999))
    return chosen


def merge_cast_rosters(items: Sequence[dict], limit: int = 35) -> List[dict]:
    """Build a deduplicated Actor -> Canonical Role roster across series + episodes."""
    cast: List[dict] = []
    seen = set()
    for item in items:
        for person in item.get("People") or []:
            if person.get("Type") != "Actor":
                continue
            role = (person.get("Role") or "").strip()
            actor = (person.get("Name") or "").strip()
            if not role:
                continue
            canon = jellyfin.canonical_role(role)
            if not canon or canon in seen or not export.is_guessable_character(canon):
                continue
            seen.add(canon)
            cast.append({"actor": actor, "role": role, "canonical": canon})
            if len(cast) >= limit:
                return cast
    return cast


def extract_movie_item(
    jf: jellyfin.JellyfinClient,
    llm_client,
    item_id: str,
    script_id: Optional[str] = None,
    title_override: Optional[str] = None,
    poster_override: Optional[str] = None,
    model: str = "google/gemini-3.8-flash",
    mode: str = "audio",
    min_conf: float = 0.90,
    workers: int = 2,
    out_dir: Path = REPO_ROOT / "data" / "exports",
    alias_map: Optional[Dict[str, str]] = None,
    subdl_key: str = "",
) -> Tuple[Optional[Path], float, dict]:
    """Pull, extract, auto-clean audio, and export a single movie."""
    item = jf.get_movie(item_id)
    meta = jellyfin.extract_movie_metadata(item)
    if title_override:
        meta["title"] = title_override
    if poster_override:
        meta["poster"] = poster_override
    slug = script_id or meta["slug"]
    out_path = out_dir / f"{slug}.json"

    if out_path.exists():
        doc = json.loads(out_path.read_text(encoding="utf-8"))
        rep = export.validate_scriptle_script(doc)
        if rep["valid"]:
            print(f"[SKIP] {slug} already exported (eligible={rep['eligibleTargets']})")
            return out_path, 0.0, rep

    media_dir = REPO_ROOT / "data" / "media" / meta["slug"]
    media_dir.mkdir(parents=True, exist_ok=True)
    (media_dir / "meta.json").write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")

    srt_path = media_dir / "subtitles.srt"
    media_source = (item.get("MediaSources") or [{}])[0]
    if not srt_path.exists():
        sub_stream = jellyfin.select_best_subtitle(media_source, prefer_sdh=True)
        if sub_stream:
            print(f"  [{slug}] downloading Jellyfin sub: {sub_stream.get('DisplayTitle')}")
            jf.download_subtitle(item["Id"], meta["mediaSourceId"], sub_stream["Index"], srt_path)
        elif subdl_key and meta.get("imdbId"):
            print(f"  [{slug}] fetching English sub from SubDL ({meta['imdbId']})...")
            got = jellyfin.fetch_subdl_subtitle(meta["imdbId"], srt_path, subdl_key, prefer_sdh=True)
            if not got:
                print(f"  [WARN] {slug}: no English subtitle found on Jellyfin or SubDL; skipping", file=sys.stderr)
                return None, 0.0, {"valid": False, "errors": ["No English subtitle"]}
        else:
            print(f"  [WARN] {slug}: no English subtitle available; skipping", file=sys.stderr)
            return None, 0.0, {"valid": False, "errors": ["No English subtitle"]}

    work_dir = REPO_ROOT / "data" / "work" / slug
    extracted_path = work_dir / f"extracted_{extract.safe_model_slug(model)}_{mode}.json"
    cost_usd = 0.0

    if extracted_path.exists():
        result = json.loads(extracted_path.read_text(encoding="utf-8"))
        print(f"  [{slug}] reusing cached extraction ({len(result['items'])} cues)")
    else:
        audio_path = media_dir / "center.mp3"
        try:
            if mode == "audio" and not audio_path.exists():
                aud_stream = jellyfin.select_best_audio_stream(media_source)
                aud_idx = aud_stream["Index"] if aud_stream else None
                aud_desc = aud_stream.get("DisplayTitle") if aud_stream else "default"
                print(f"  [{slug}] streaming English audio [{aud_idx}: {aud_desc}] -> center.mp3")
                jf.pull_center_audio(
                    item["Id"], meta["mediaSourceId"], audio_path, audio_stream_index=aud_idx
                )
            cues = srt.load_dialogue(srt_path)
            cache_dir = work_dir / f"{extract.safe_model_slug(model)}_{mode}"
            result = extract.extract_film(
                cues=cues,
                meta=meta,
                client=llm_client,
                model=model,
                mode=mode,
                audio_path=audio_path if mode == "audio" else None,
                cache_dir=cache_dir,
                strip_sdh=False,
                workers=workers,
            )
            work_dir.mkdir(parents=True, exist_ok=True)
            extracted_path.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
            cost_usd = float(result["usage"].get("estimatedCostUsd") or 0.0)
            print(
                f"  [{slug}] extracted {len(result['items'])} cues in "
                f"{result['usage']['elapsedSeconds']}s | cost=${cost_usd:.4f}"
            )
        finally:
            if audio_path.exists():
                audio_path.unlink()

    doc = export.build_scriptle_script(
        items=result["items"],
        meta=meta,
        script_id=slug,
        min_conf=min_conf,
        min_run_length=3,
        merge_turns=True,
        alias_map=alias_map,
    )
    rep = export.validate_scriptle_script(doc)
    export.write_script(doc, out_path)
    print(
        f"  [DONE] {slug}: lines={rep['totalLines']} scenes={rep['sceneCount']} "
        f"cast={rep['topSpeakingCastCount']} eligible={rep['eligibleTargets']} valid={rep['valid']}"
    )
    return out_path, cost_usd, rep


def extract_tv_season_pack(
    jf: jellyfin.JellyfinClient,
    llm_client,
    series_id: str,
    pack_id: str,
    episodes_per_season: int = 3,
    seasons: Optional[Sequence[int]] = None,
    selection: str = "top_rated",
    season_titles: Optional[Dict[int, str]] = None,
    model: str = "google/gemini-3.8-flash",
    mode: str = "audio",
    min_conf: float = 0.90,
    workers: int = 2,
    out_dir: Path = REPO_ROOT / "data" / "exports",
    alias_map: Optional[Dict[str, str]] = None,
    max_spend_usd: float = 20.0,
) -> Tuple[List[Path], float]:
    """Extract a single-show TV Season Pack (one validated Scriptle script JSON per season)."""
    series = jf.get_movie(series_id)
    series_name = series.get("Name") or pack_id
    series_imdb = (series.get("ProviderIds") or {}).get("Imdb") or ""
    genres = ", ".join(series.get("Genres") or [])
    rated = series.get("OfficialRating") or ""
    overview = (series.get("Overview") or "").strip()

    q = urllib.parse.urlencode({
        "ParentId": series_id,
        "IncludeItemTypes": "Episode",
        "Recursive": "true",
        "Fields": "MediaSources,People,Overview,ProductionYear,RunTimeTicks,CommunityRating",
        "SortBy": "ParentIndexNumber,IndexNumber",
    })
    all_eps = jf.get_json(f"/Users/{jf.user_id}/Items?{q}").get("Items", [])
    subdl_key = jellyfin.load_env().get("SUBDL_API_KEY", "")
    media_root = REPO_ROOT / "data" / "media" / pack_id
    media_root.mkdir(parents=True, exist_ok=True)

    all_by_season: Dict[int, List[dict]] = {}
    for ep in all_eps:
        sn = ep.get("ParentIndexNumber")
        if not sn or sn <= 0:
            continue
        if seasons and sn not in seasons:
            continue
        all_by_season.setdefault(int(sn), []).append(ep)

    by_season: Dict[int, List[dict]] = {}
    picker = pick_spaced_episodes if selection == "spaced" else pick_top_rated_episodes
    for sn, eps in sorted(all_by_season.items()):
        def _has_sub(ep: dict) -> bool:
            return (
                jellyfin.select_best_subtitle((ep.get("MediaSources") or [{}])[0], prefer_sdh=True) is not None
                or (media_root / f"s{sn:02d}e{int(ep.get('IndexNumber') or 0):02d}.srt").exists()
            )

        desired = picker(eps, episodes_per_season)
        missing_desired = any(not _has_sub(ep) for ep in desired)
        with_sub = [ep for ep in eps if _has_sub(ep)]
        if (len(with_sub) < min(episodes_per_season, len(eps)) or missing_desired) and subdl_key and series_imdb:
            print(f"  [{pack_id} S{sn:02d}] {len(with_sub)}/{len(eps)} subs ready (need top picks); fetching SubDL season pack...")
            fetched = jellyfin.fetch_subdl_tv_season(series_imdb, sn, media_root, subdl_key, prefer_sdh=True)
            print(f"  [{pack_id} S{sn:02d}] unpacked {len(fetched)} SubDL episode SRTs")
            with_sub = [ep for ep in eps if _has_sub(ep)]
        if with_sub:
            by_season[sn] = with_sub

    if not by_season:
        raise RuntimeError(f"No episodes with English text subtitles found for {series_name}")

    # Build a rich cast roster combining series-level cast + sampled episodes
    roster_sources = [series]
    selected_by_season: Dict[int, List[dict]] = {}
    for sn, eps in sorted(by_season.items()):
        picked = picker(eps, episodes_per_season)
        selected_by_season[sn] = picked
        roster_sources.extend(picked)

    merged_cast = merge_cast_rosters(roster_sources, limit=35)
    print(f"=== TV Pack: {series_name} ({len(selected_by_season)} seasons, {len(merged_cast)} cast roles, selection={selection}) ===")
    for sn, picked in sorted(selected_by_season.items()):
        ep_summary = ", ".join(
            f"E{int(e.get('IndexNumber') or 0):02d} {e.get('Name', '')} ({e.get('CommunityRating') or '-'})"
            for e in picked
        )
        print(f"  S{sn:02d}: {ep_summary}")

    exported_paths: List[Path] = []
    total_cost = 0.0

    for sn, picked_eps in sorted(selected_by_season.items()):
        season_slug = f"{pack_id}-s{sn:02d}"
        out_path = out_dir / f"{season_slug}.json"
        if out_path.exists():
            doc = json.loads(out_path.read_text(encoding="utf-8"))
            rep = export.validate_scriptle_script(doc)
            if rep["valid"]:
                print(f"[SKIP] {season_slug} already exported (eligible={rep['eligibleTargets']})")
                exported_paths.append(out_path)
                continue

        if total_cost >= max_spend_usd:
            print(f"[BUDGET] Reached spend cap (${total_cost:.2f} >= ${max_spend_usd:.2f}); stopping.")
            break

        season_years = [int(e["ProductionYear"]) for e in picked_eps if e.get("ProductionYear")]
        season_year = min(season_years) if season_years else int(series.get("ProductionYear") or 2000)

        season_lines: List[dict] = []
        next_scene_id = 0
        media_root = REPO_ROOT / "data" / "media" / pack_id
        media_root.mkdir(parents=True, exist_ok=True)

        for ep in picked_eps:
            ep_num = int(ep.get("IndexNumber") or 0)
            ep_code = f"s{sn:02d}e{ep_num:02d}"
            ep_title = ep.get("Name") or ep_code
            ms = (ep.get("MediaSources") or [{}])[0]
            ms_id = ms.get("Id") or ep["Id"]

            ep_meta = {
                "slug": f"{pack_id}-{ep_code}",
                "title": f"{series_name} — Season {sn}, Episode {ep_num}: {ep_title}",
                "year": ep.get("ProductionYear") or season_year,
                "overview": f"{overview}\nEpisode synopsis: {(ep.get('Overview') or '').strip()}".strip(),
                "cast": merged_cast,
            }

            srt_path = media_root / f"{ep_code}.srt"
            if not srt_path.exists():
                sub_stream = jellyfin.select_best_subtitle(ms, prefer_sdh=True)
                if not sub_stream:
                    continue
                jf.download_subtitle(ep["Id"], ms_id, sub_stream["Index"], srt_path)

            work_dir = REPO_ROOT / "data" / "work" / pack_id / ep_code
            extracted_path = work_dir / f"extracted_{extract.safe_model_slug(model)}_{mode}.json"

            if extracted_path.exists():
                res = json.loads(extracted_path.read_text(encoding="utf-8"))
                print(f"  [{pack_id} {ep_code}] cached ({len(res['items'])} cues)")
            else:
                audio_path = media_root / f"{ep_code}_center.mp3"
                try:
                    if mode == "audio" and not audio_path.exists():
                        aud_stream = jellyfin.select_best_audio_stream(ms)
                        aud_idx = aud_stream["Index"] if aud_stream else None
                        jf.pull_center_audio(ep["Id"], ms_id, audio_path, audio_stream_index=aud_idx)
                    cues = srt.load_dialogue(srt_path)
                    cache_dir = work_dir / f"{extract.safe_model_slug(model)}_{mode}"
                    res = extract.extract_film(
                        cues=cues,
                        meta=ep_meta,
                        client=llm_client,
                        model=model,
                        mode=mode,
                        audio_path=audio_path if mode == "audio" else None,
                        cache_dir=cache_dir,
                        strip_sdh=False,
                        workers=workers,
                    )
                    work_dir.mkdir(parents=True, exist_ok=True)
                    extracted_path.write_text(json.dumps(res, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
                    ep_cost = float(res["usage"].get("estimatedCostUsd") or 0.0)
                    total_cost += ep_cost
                    print(
                        f"  [{pack_id} {ep_code}] {ep_title[:32]:32s} | {len(res['items']):3d} cues | "
                        f"{res['usage']['elapsedSeconds']:.0f}s | ${ep_cost:.3f} (cum=${total_cost:.2f})"
                    )
                finally:
                    if audio_path.exists():
                        audio_path.unlink()

            # Build per-episode contiguous runs and offset scene IDs so episodes never bleed together
            ep_doc = export.build_scriptle_script(
                items=res["items"],
                meta=ep_meta,
                script_id=f"{pack_id}-{ep_code}",
                min_conf=min_conf,
                min_run_length=3,
                merge_turns=True,
                alias_map=alias_map,
            )
            ep_scene_offset = next_scene_id
            max_sc = -1
            for line in ep_doc["lines"]:
                sc = int(line.get("scene", 0))
                max_sc = max(max_sc, sc)
                season_lines.append({
                    "character": line["character"],
                    "text": line["text"],
                    "scene": ep_scene_offset + sc,
                    "episode": ep_code,
                })
            if max_sc >= 0:
                next_scene_id = ep_scene_offset + max_sc + 1

        characters = sorted({
            l["character"] for l in season_lines if export.is_guessable_character(l["character"])
        })
        top_cast = export.compute_top_speaking_cast(season_lines)
        season_title = (season_titles or {}).get(sn) or f"Season {sn}"
        season_episodes = build_season_episodes_catalog(all_by_season.get(sn, picked_eps), sn)
        season_doc = {
            "id": season_slug,
            "title": season_title,
            "year": season_year,
            "characters": characters,
            "lines": season_lines,
            "episodes": season_episodes,
            "lineCount": len(season_lines),
            "characterCount": len(characters),
            "imdbId": series_imdb,
            "poster": "",
            "rated": rated,
            "runtime": f"{len(picked_eps)} eps",
            "genre": genres,
            "director": series_name,
            "topSpeakingCast": top_cast,
        }
        rep = export.validate_scriptle_script(season_doc)
        export.write_script(season_doc, out_path)
        exported_paths.append(out_path)
        print(
            f"  [SEASON DONE] {season_slug} (Season {sn}, {season_year}): "
            f"lines={rep['totalLines']} scenes={rep['sceneCount']} "
            f"cast={rep['topSpeakingCastCount']} eligible={rep['eligibleTargets']} valid={rep['valid']}"
        )

    return exported_paths, total_cost


def main(argv: Optional[List[str]] = None) -> int:
    p = argparse.ArgumentParser(description="Batch extract Movie or TV Season packs from Jellyfin")
    sub = p.add_subparsers(dest="cmd", required=True)

    mv = sub.add_parser("movies", help="Extract a list of movies from a pack manifest JSON")
    mv.add_argument("--manifest", type=Path, required=True)
    mv.add_argument("--packs", required=True, help="Comma-separated pack IDs from manifest")
    mv.add_argument("--model", default="google/gemini-3.8-flash")
    mv.add_argument("--mode", choices=["text", "audio"], default="audio")
    mv.add_argument("--min-conf", type=float, default=0.90)
    mv.add_argument("--workers", type=int, default=2)
    mv.add_argument("--max-spend-usd", type=float, default=15.0)

    tv = sub.add_parser("tv", help="Extract a single-show TV Season pack")
    tv.add_argument("--series-id", required=True)
    tv.add_argument("--pack-id", required=True)
    tv.add_argument("--episodes-per-season", type=int, default=3)
    tv.add_argument("--seasons", help="Optional comma-separated season numbers (e.g. 1,2,3,4,5)")
    tv.add_argument("--selection", choices=["top_rated", "spaced"], default="top_rated")
    tv.add_argument("--model", default="google/gemini-3.8-flash")
    tv.add_argument("--mode", choices=["text", "audio"], default="audio")
    tv.add_argument("--min-conf", type=float, default=0.90)
    tv.add_argument("--workers", type=int, default=2)
    tv.add_argument("--max-spend-usd", type=float, default=10.0)

    args = p.parse_args(argv)
    env = jellyfin.load_env()
    jf = jellyfin.JellyfinClient.from_env()
    llm = extract.create_client(provider="openrouter")

    if args.cmd == "movies":
        data = json.loads(args.manifest.read_text(encoding="utf-8"))
        by_id = {c["id"]: c for c in data.get("packCandidates", [])}
        wanted = [x.strip() for x in args.packs.split(",") if x.strip()]
        total_cost = 0.0
        for pid in wanted:
            pack = by_id[pid]
            print(f"\n=== Movie Pack: {pack['name']} ({len(pack['movies'])} movies) ===")
            for m in pack["movies"]:
                if total_cost >= args.max_spend_usd:
                    print(f"[BUDGET] Reached spend cap (${total_cost:.2f} >= ${args.max_spend_usd:.2f}); stopping.")
                    return 0
                slug = m.get("scriptId") or jellyfin.slugify(m["title"])
                _, cost, _ = extract_movie_item(
                    jf=jf,
                    llm_client=llm,
                    item_id=m["jellyfinId"],
                    script_id=slug,
                    title_override=m["title"],
                    poster_override=m.get("poster"),
                    model=args.model,
                    mode=args.mode,
                    min_conf=args.min_conf,
                    workers=args.workers,
                    subdl_key=env.get("SUBDL_API_KEY", ""),
                )
                total_cost += cost
        print(f"\nBatch complete. Total spend: ${total_cost:.4f}")
        return 0

    if args.cmd == "tv":
        season_nums = [int(x) for x in args.seasons.split(",") if x.strip()] if args.seasons else None
        _, cost = extract_tv_season_pack(
            jf=jf,
            llm_client=llm,
            series_id=args.series_id,
            pack_id=args.pack_id,
            episodes_per_season=args.episodes_per_season,
            seasons=season_nums,
            selection=args.selection,
            model=args.model,
            mode=args.mode,
            min_conf=args.min_conf,
            workers=args.workers,
            max_spend_usd=args.max_spend_usd,
        )
        print(f"\nTV pack complete. Total spend: ${cost:.4f}")
        return 0

    return 1


if __name__ == "__main__":
    sys.exit(main())
