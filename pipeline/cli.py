#!/usr/bin/env python3
"""
Single-command CLI for the Scriptle extraction pipeline.

Commands:
  inventory   Summarize Jellyfin library & high-value pack opportunities
  pull        Fetch metadata, best English SRT (or SubDL), and center-channel audio
  extract     Run multimodal scene-window speaker attribution via Gemini
  export      Convert attributed lines into validated Scriptle script JSON
  run         End-to-end: Jellyfin movie -> pull -> extract -> validated export
  benchmark   Zero-leakage accuracy, confidence-tier precision, & cost benchmark
  validate    Validate any Scriptle script JSON against daily-puzzle rules
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Dict, List, Optional

from pipeline import benchmark, export, extract, jellyfin, srt

REPO_ROOT = Path(__file__).resolve().parent.parent


def _resolve_media_dir(slug: str, media_root: Optional[Path] = None) -> Path:
    root = media_root or (REPO_ROOT / "data" / "media")
    return root / slug


def cmd_inventory(args: argparse.Namespace) -> int:
    client = jellyfin.JellyfinClient.from_env()
    movies = client.list_movies()

    existing_imdb = set()
    existing_titles = set()
    scripts_dir = REPO_ROOT / "public" / "data" / "scripts"
    if scripts_dir.exists():
        for p in scripts_dir.glob("*.json"):
            try:
                d = json.loads(p.read_text(encoding="utf-8"))
                if d.get("imdbId"):
                    existing_imdb.add(d["imdbId"])
                if d.get("title"):
                    existing_titles.add(d["title"].lower())
            except Exception:
                pass

    def is_new(m: dict) -> bool:
        imdb = (m.get("ProviderIds") or {}).get("Imdb")
        name = (m.get("Name") or "").lower()
        return not ((imdb and imdb in existing_imdb) or name in existing_titles)

    net_new = [m for m in movies if is_new(m)]
    print(f"Jellyfin movies: {len(movies)} total ({len(net_new)} net new vs public/data/scripts/)")

    if args.search:
        term = args.search.lower()
        hits = [m for m in movies if term in (m.get("Name") or "").lower()]
        for m in hits[: args.limit]:
            imdb = (m.get("ProviderIds") or {}).get("Imdb") or "-"
            tag = "" if is_new(m) else " [IN SCRIPTLE]"
            print(f"  {m.get('ProductionYear')}  {m.get('Name')}  ({imdb})  id={m.get('Id')}{tag}")
        return 0

    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(json.dumps(movies, indent=2), encoding="utf-8")
        print(f"Wrote {args.out}")
    return 0


def cmd_pull(args: argparse.Namespace) -> int:
    env = jellyfin.load_env()
    client = jellyfin.JellyfinClient.from_env()

    if args.item_id:
        item = client.get_movie(args.item_id)
    else:
        hits = client.search_movies(args.search)
        if not hits:
            print(f"No movie matched {args.search!r}", file=sys.stderr)
            return 1
        if len(hits) > 1 and not args.first:
            print(f"Multiple matches for {args.search!r} (pass --item-id or --first):", file=sys.stderr)
            for h in hits:
                print(f"  {h.get('Name')} ({h.get('ProductionYear')})  id={h.get('Id')}", file=sys.stderr)
            return 1
        item = client.get_movie(hits[0]["Id"])

    meta = jellyfin.extract_movie_metadata(item)
    out_dir = _resolve_media_dir(meta["slug"], args.media_root)
    out_dir.mkdir(parents=True, exist_ok=True)
    meta_path = out_dir / "meta.json"
    meta_path.write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")
    print(f"Pulled metadata: {meta['title']} ({meta['year']}) -> {out_dir}")
    print(f"  cast roles: {len(meta['cast'])}, imdb: {meta.get('imdbId')}")

    srt_path = out_dir / "subtitles.srt"
    if not args.skip_subtitles:
        media_source = (item.get("MediaSources") or [{}])[0]
        sub_stream = jellyfin.select_best_subtitle(
            media_source, prefer_sdh=not args.no_sdh, requested_index=args.subtitle_index
        )
        if sub_stream:
            print(f"  downloading Jellyfin subtitle stream {sub_stream['Index']} ({sub_stream.get('DisplayTitle')})...")
            written = client.download_subtitle(
                item["Id"], meta["mediaSourceId"], sub_stream["Index"], srt_path
            )
            print(f"  wrote {srt_path.name} ({written / 1024:.1f} KB)")
        elif env.get("SUBDL_API_KEY") and meta.get("imdbId"):
            print("  no Jellyfin text subtitle; falling back to SubDL...")
            got = jellyfin.fetch_subdl_subtitle(
                meta["imdbId"], srt_path, env["SUBDL_API_KEY"], prefer_sdh=not args.no_sdh
            )
            if got:
                print(f"  wrote {srt_path.name} from SubDL")
            else:
                print("  warning: no SubDL subtitle found", file=sys.stderr)
        else:
            print("  warning: no text subtitle stream available", file=sys.stderr)

    if not args.skip_audio:
        audio_path = out_dir / "center.mp3"
        if audio_path.exists() and not args.force:
            print(f"  reusing existing {audio_path.name}")
        else:
            media_source = (item.get("MediaSources") or [{}])[0]
            aud_stream = jellyfin.select_best_audio_stream(media_source)
            aud_idx = aud_stream["Index"] if aud_stream else None
            aud_desc = aud_stream.get("DisplayTitle") if aud_stream else "default"
            print(f"  streaming English center-channel audio [{aud_idx}: {aud_desc}] -> center.mp3...")
            client.pull_center_audio(
                item["Id"], meta["mediaSourceId"], audio_path, audio_stream_index=aud_idx
            )
            print(f"  wrote {audio_path.name} ({audio_path.stat().st_size / 1e6:.1f} MB)")

    return 0


def _load_meta(meta_path: Optional[Path], title: Optional[str], year: Optional[int], slug: Optional[str]) -> dict:
    meta = json.loads(meta_path.read_text(encoding="utf-8")) if (meta_path and meta_path.exists()) else {}
    if title:
        meta["title"] = title
    if year:
        meta["year"] = year
    if slug:
        meta["slug"] = slug
    if not meta.get("slug") and meta.get("title"):
        meta["slug"] = jellyfin.slugify(meta["title"], meta.get("year"))
    return meta


def cmd_extract(args: argparse.Namespace) -> int:
    meta = _load_meta(args.meta, args.title, args.year, args.slug)
    cues = srt.load_dialogue(args.srt)
    client = extract.create_client(provider=args.provider)
    safe_model = extract.safe_model_slug(args.model)
    cache_dir = (
        REPO_ROOT / "data" / "work" / (meta.get("slug") or "movie") / f"{safe_model}_{args.mode}"
        if not args.no_cache
        else None
    )
    result = extract.extract_film(
        cues=cues,
        meta=meta,
        client=client,
        model=args.model,
        mode=args.mode,
        audio_path=args.audio,
        video_path=args.video,
        cache_dir=cache_dir,
        strip_sdh=args.strip_sdh,
        window_seconds=args.window_seconds,
        max_cues=args.max_cues,
        workers=args.workers,
        verify=args.verify,
        verify_model=args.verify_model,
        window_limit=args.window_limit,
    )
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    u = result["usage"]
    print(
        f"Extracted {len(result['items'])} cues ({args.model} / {args.mode}) in {u['elapsedSeconds']}s "
        f"| est cost ${u['estimatedCostUsd']:.4f} -> {args.out}"
    )
    return 0


def cmd_export(args: argparse.Namespace) -> int:
    src = json.loads(args.input.read_text(encoding="utf-8"))
    items = src.get("items") or src.get("lines") or []
    meta = src.get("meta") or {}
    if args.meta and args.meta.exists():
        meta = {**meta, **json.loads(args.meta.read_text(encoding="utf-8"))}
    if args.title:
        meta["title"] = args.title
    if args.year:
        meta["year"] = args.year
    if args.imdb_id:
        meta["imdbId"] = args.imdb_id
    if args.poster:
        meta["poster"] = args.poster

    alias_map = (
        json.loads(args.aliases.read_text(encoding="utf-8"))
        if args.aliases and args.aliases.exists()
        else None
    )

    doc = export.build_scriptle_script(
        items=items,
        meta=meta,
        script_id=args.script_id or meta.get("slug") or src.get("id"),
        min_conf=args.min_conf,
        min_run_length=args.min_run_length,
        merge_turns=not args.no_merge_turns,
        alias_map=alias_map,
    )
    report = export.validate_scriptle_script(doc)
    export.write_script(doc, args.out)
    print(
        f"Exported {doc['id']} -> {args.out} "
        f"(lines={report['totalLines']}, cast={report['topSpeakingCastCount']}, "
        f"eligible_targets={report['eligibleTargets']}, valid={report['valid']})"
    )
    for w in report["warnings"]:
        print(f"  WARN: {w}")
    for e in report["errors"]:
        print(f"  ERR : {e}", file=sys.stderr)
    return 0 if report["valid"] else 1


def cmd_validate(args: argparse.Namespace) -> int:
    doc = json.loads(args.script.read_text(encoding="utf-8"))
    report = export.validate_scriptle_script(doc, min_words=args.min_words)
    print(json.dumps(report, indent=2))
    return 0 if report["valid"] else 1


def cmd_benchmark(args: argparse.Namespace) -> int:
    meta = _load_meta(args.meta, args.title, args.year, args.slug)
    client = extract.create_client(provider=args.provider)
    models = [m.strip() for m in args.models.split(",") if m.strip()]
    arms = [a.strip() for a in args.arms.split(",") if a.strip()]
    work_dir = REPO_ROOT / "data" / "work" / f"bench_{meta.get('slug') or 'movie'}"

    report = benchmark.run_benchmark(
        srt_path=args.srt,
        meta=meta,
        client=client,
        models=models,
        arms=arms,
        audio_path=args.audio,
        video_path=args.video,
        reference_script_path=args.reference,
        work_dir=work_dir,
        window_limit=args.window_limit,
        workers=args.workers,
        verify=args.verify,
    )
    print("\n" + benchmark.format_report_table(report) + "\n")
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
        print(f"Wrote {args.out}")
    return 0


def cmd_run(args: argparse.Namespace) -> int:
    """End-to-end: pull (or use existing media dir) -> extract -> validated export."""
    if args.media_dir:
        media_dir = args.media_dir
        meta_path = media_dir / "meta.json"
        meta = _load_meta(meta_path, args.title, args.year, args.slug or media_dir.name)
    else:
        pull_args = argparse.Namespace(
            search=args.search,
            item_id=args.item_id,
            first=args.first,
            media_root=REPO_ROOT / "data" / "media",
            skip_subtitles=False,
            skip_audio=(args.mode == "text"),
            no_sdh=False,
            subtitle_index=None,
            force=False,
        )
        rc = cmd_pull(pull_args)
        if rc != 0:
            return rc
        # Find pulled directory via search/item_id metadata
        jf = jellyfin.JellyfinClient.from_env()
        item = jf.get_movie(args.item_id) if args.item_id else jf.get_movie(jf.search_movies(args.search)[0]["Id"])
        meta = jellyfin.extract_movie_metadata(item)
        media_dir = _resolve_media_dir(meta["slug"])

    srt_path = args.srt or (media_dir / "subtitles.srt")
    audio_path = media_dir / "center.mp3"
    if not audio_path.exists() and (media_dir / "center.flac").exists():
        audio_path = media_dir / "center.flac"
    video_path = media_dir / "video.mp4"
    mode = args.mode
    if mode == "audio" and not audio_path.exists():
        print("center.mp3/center.flac not found; falling back to text mode", file=sys.stderr)
        mode = "text"

    slug = args.script_id or meta.get("slug") or media_dir.name
    work_dir = REPO_ROOT / "data" / "work" / slug
    extracted_path = work_dir / f"extracted_{extract.safe_model_slug(args.model)}_{mode}.json"

    extract_args = argparse.Namespace(
        srt=srt_path,
        meta=media_dir / "meta.json" if (media_dir / "meta.json").exists() else None,
        title=meta.get("title"),
        year=meta.get("year"),
        slug=slug,
        provider=args.provider,
        model=args.model,
        mode=mode,
        audio=audio_path if mode == "audio" else None,
        video=video_path if mode == "video" else None,
        strip_sdh=False,
        window_seconds=extract.DEFAULT_WINDOW_SECONDS,
        max_cues=extract.DEFAULT_MAX_CUES,
        workers=args.workers,
        verify=args.verify,
        verify_model=args.verify_model,
        window_limit=None,
        no_cache=False,
        out=extracted_path,
    )
    rc = cmd_extract(extract_args)
    if rc != 0:
        return rc

    if not args.keep_audio and audio_path.exists():
        audio_path.unlink()
        print(f"  cleaned up temporary {audio_path.name} to save disk space")

    out_path = args.out_dir / f"{slug}.json"
    export_args = argparse.Namespace(
        input=extracted_path,
        meta=media_dir / "meta.json" if (media_dir / "meta.json").exists() else None,
        script_id=slug,
        title=meta.get("title"),
        year=meta.get("year"),
        imdb_id=meta.get("imdbId"),
        poster=meta.get("poster"),
        aliases=None,
        min_conf=args.min_conf,
        min_run_length=3,
        no_merge_turns=False,
        out=out_path,
    )
    return cmd_export(export_args)


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="python3 -m pipeline.cli", description="Scriptle extraction pipeline")
    sub = p.add_subparsers(dest="command", required=True)

    inv = sub.add_parser("inventory", help="Query Jellyfin movie library")
    inv.add_argument("--search", help="Filter titles by substring")
    inv.add_argument("--limit", type=int, default=50)
    inv.add_argument("--out", type=Path, help="Optional JSON dump path")
    inv.set_defaults(func=cmd_inventory)

    pull = sub.add_parser("pull", help="Pull metadata, SRT, and center-channel audio from Jellyfin")
    pull.add_argument("--search", help="Movie title search")
    pull.add_argument("--item-id", help="Jellyfin item ID")
    pull.add_argument("--first", action="store_true", help="Pick first search match automatically")
    pull.add_argument("--media-root", type=Path)
    pull.add_argument("--skip-subtitles", action="store_true")
    pull.add_argument("--skip-audio", action="store_true")
    pull.add_argument("--no-sdh", action="store_true", help="Prefer non-SDH subtitles")
    pull.add_argument("--subtitle-index", type=int)
    pull.add_argument("--force", action="store_true")
    pull.set_defaults(func=cmd_pull)

    ext = sub.add_parser("extract", help="Run multimodal speaker attribution")
    ext.add_argument("--srt", type=Path, required=True)
    ext.add_argument("--meta", type=Path)
    ext.add_argument("--title")
    ext.add_argument("--year", type=int)
    ext.add_argument("--slug")
    ext.add_argument("--provider", choices=["auto", "openrouter", "gemini"], default="auto")
    ext.add_argument("--model", default=extract.DEFAULT_MODEL)
    ext.add_argument("--mode", choices=["text", "audio", "video"], default="audio")
    ext.add_argument("--audio", type=Path)
    ext.add_argument("--video", type=Path)
    ext.add_argument("--strip-sdh", action="store_true")
    ext.add_argument("--window-seconds", type=float, default=extract.DEFAULT_WINDOW_SECONDS)
    ext.add_argument("--max-cues", type=int, default=extract.DEFAULT_MAX_CUES)
    ext.add_argument("--workers", type=int, default=4)
    ext.add_argument("--verify", action="store_true")
    ext.add_argument("--verify-model", default=extract.DEFAULT_VERIFY_MODEL)
    ext.add_argument("--window-limit", type=int)
    ext.add_argument("--no-cache", action="store_true")
    ext.add_argument("--out", type=Path, required=True)
    ext.set_defaults(func=cmd_extract)

    exp = sub.add_parser("export", help="Export validated Scriptle script JSON")
    exp.add_argument("--input", type=Path, required=True)
    exp.add_argument("--meta", type=Path)
    exp.add_argument("--script-id")
    exp.add_argument("--title")
    exp.add_argument("--year", type=int)
    exp.add_argument("--imdb-id")
    exp.add_argument("--poster")
    exp.add_argument("--aliases", type=Path)
    exp.add_argument("--min-conf", type=float, default=0.85)
    exp.add_argument("--min-run-length", type=int, default=3)
    exp.add_argument("--no-merge-turns", action="store_true")
    exp.add_argument("--out", type=Path, required=True)
    exp.set_defaults(func=cmd_export)

    val = sub.add_parser("validate", help="Validate a Scriptle script JSON")
    val.add_argument("script", type=Path)
    val.add_argument("--min-words", type=int, default=5)
    val.set_defaults(func=cmd_validate)

    bench = sub.add_parser("benchmark", help="Benchmark models and modalities against held-out SDH")
    bench.add_argument("--srt", type=Path, required=True)
    bench.add_argument("--meta", type=Path)
    bench.add_argument("--title")
    bench.add_argument("--year", type=int)
    bench.add_argument("--slug")
    bench.add_argument("--provider", choices=["auto", "openrouter", "gemini"], default="auto")
    bench.add_argument("--models", default=extract.DEFAULT_MODEL)
    bench.add_argument("--arms", default="text,audio")
    bench.add_argument("--audio", type=Path)
    bench.add_argument("--video", type=Path)
    bench.add_argument("--reference", type=Path)
    bench.add_argument("--window-limit", type=int)
    bench.add_argument("--workers", type=int, default=4)
    bench.add_argument("--verify", action="store_true")
    bench.add_argument("--out", type=Path)
    bench.set_defaults(func=cmd_benchmark)

    run = sub.add_parser("run", help="End-to-end: Jellyfin -> pull -> extract -> export")
    run.add_argument("--search", help="Movie title on Jellyfin")
    run.add_argument("--item-id", help="Jellyfin item ID")
    run.add_argument("--first", action="store_true")
    run.add_argument("--media-dir", type=Path, help="Use an already-pulled local media directory")
    run.add_argument("--srt", type=Path, help="Override subtitle path")
    run.add_argument("--script-id", help="Output Scriptle script ID")
    run.add_argument("--title")
    run.add_argument("--year", type=int)
    run.add_argument("--slug")
    run.add_argument("--provider", choices=["auto", "openrouter", "gemini"], default="auto")
    run.add_argument("--model", default=extract.DEFAULT_MODEL)
    run.add_argument("--mode", choices=["text", "audio", "video"], default="audio")
    run.add_argument("--min-conf", type=float, default=0.85)
    run.add_argument("--workers", type=int, default=4)
    run.add_argument("--verify", action="store_true")
    run.add_argument("--verify-model", default=extract.DEFAULT_VERIFY_MODEL)
    run.add_argument("--keep-audio", action="store_true", help="Keep temporary center.mp3 after extraction")
    run.add_argument("--out-dir", type=Path, default=REPO_ROOT / "data" / "exports")
    run.set_defaults(func=cmd_run)

    return p


def main(argv: Optional[List[str]] = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        return args.func(args)
    except extract.BillingError as err:
        print(f"\nBILLING ERROR: {err}", file=sys.stderr)
        print("Top up credits at https://ai.studio/projects and re-run (cached chunks are preserved).", file=sys.stderr)
        return 2
    except Exception as err:
        print(f"Error: {err}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
