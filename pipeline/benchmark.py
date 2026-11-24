"""
Rigorous speaker attribution & Scriptle puzzle-window benchmark harness.

Replaces the legacy 5-second-block `ablate.py` with a zero-leakage benchmark
measuring what Scriptle actually cares about:
1. Held-out SDH anchor accuracy (with SDH labels strictly stripped from inputs)
2. Precision @ Confidence tiers (>=0.95, >=0.90, >=0.85, >=0.80, all) + coverage
3. 3-line Scriptle puzzle-window accuracy ([target, context1, context2] from
   topSpeakingCast >= 5 words) against aligned reference scripts
4. Per-movie runtime, token usage, and USD cost economics
"""

import json
import re
from pathlib import Path
from typing import Dict, List, Optional, Sequence, Tuple

from pipeline import align, export, extract, srt

DEFAULT_THRESHOLDS = (0.0, 0.80, 0.85, 0.90, 0.95)

# Titles / generic words that must NEVER trigger a false token-overlap match.
_TITLE_WORDS = {
    "MR", "MRS", "MS", "MISS", "DR", "DOCTOR", "PROFESSOR", "PROF",
    "SIR", "LADY", "LORD", "KING", "QUEEN", "PRINCE", "PRINCESS",
    "CAPTAIN", "CAPT", "GENERAL", "GEN", "COMMANDER", "MAJOR", "COLONEL",
    "GRAND", "MOFF", "DARTH", "MASTER", "AUNT", "UNCLE", "FATHER", "MOTHER",
    "AGENT", "DETECTIVE", "OFFICER", "SERGEANT", "LIEUTENANT", "CHIEF",
    "THE", "OLD", "YOUNG",
}

_GENERIC_ROLES = {
    "MAN", "WOMAN", "BOY", "GIRL", "VOICE", "VOICES", "GUARD", "SOLDIER",
    "STORMTROOPER", "TROOPER", "PILOT", "OFFICER", "ANNOUNCER", "CROWD",
    "NEWSCASTER", "REPORTER", "TEACHER", "STUDENT", "DOCTOR", "NURSE",
    "DRIVER", "WAITRESS", "WAITER", "BARTENDER", "OTHER", "UNKNOWN",
    "LEADER", "RED", "GOLD", "BLUE", "GREEN", "ONE", "TWO", "THREE",
}

# Well-known film nicknames/alternate cues for fair evaluation matching.
_ALIAS_EQUIV = {
    "BEN": "OBI-WAN",
    "THREEPIO": "C-3PO",
    "C3PO": "C-3PO",
    "ARTOO": "R2-D2",
    "R2D2": "R2-D2",
    "DOC": "EMMETT",
    "EMMETT": "EMMETT",
    "VOLDEMORT": "TOM RIDDLE",
    "LUKE": "LUKE",
}


def normalize_speaker(label: str) -> str:
    """Normalize an SDH or model speaker label."""
    text = re.sub(r"'S VOICE$|^THE ", "", (label or "").upper().strip().rstrip("."))
    text = re.sub(r"[^A-Z0-9\s\-']", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _core_tokens(label: str) -> List[str]:
    norm = normalize_speaker(label)
    if norm in _ALIAS_EQUIV:
        norm = _ALIAS_EQUIV[norm]
    raw_tokens = [t for t in re.findall(r"[A-Z0-9\-]+", norm) if t]
    stripped = [t for t in raw_tokens if t not in _TITLE_WORDS]
    tokens = stripped or raw_tokens
    return [_ALIAS_EQUIV.get(t, t) for t in tokens]


def speakers_match(predicted: Optional[str], truth: Optional[str]) -> bool:
    """Return True if predicted and truth clearly refer to the same character.

    Avoids two classic scoring bugs:
    - False positives on shared family surnames (RON WEASLEY vs GINNY WEASLEY)
    - False positives on shared titles/roles (DARTH VADER vs DARTH SIDIOUS,
      RED LEADER vs GOLD LEADER)
    """
    if not predicted or not truth:
        return False
    pn = normalize_speaker(predicted)
    tn = normalize_speaker(truth)
    if not pn or not tn:
        return False
    if pn == tn:
        return True

    pt = _core_tokens(pn)
    tt = _core_tokens(tn)
    if not pt or not tt:
        return False
    if pt == tt:
        return True

    # If both have >= 2 core tokens (e.g., RON WEASLEY vs GINNY WEASLEY),
    # require their first core token to match (prevents surname collisions).
    if len(pt) >= 2 and len(tt) >= 2:
        return pt[0] == tt[0] and (pt[-1] == tt[-1] or pt[0] not in _GENERIC_ROLES)

    # One side is a single distinctive token (e.g., HARRY vs HARRY POTTER,
    # SNAPE vs SEVERUS SNAPE, VADER vs DARTH VADER, TARKIN vs GRAND MOFF TARKIN).
    short, long_toks = (pt, tt) if len(pt) == 1 else (tt, pt)
    tok = short[0]
    if tok in _GENERIC_ROLES:
        return False
    return tok in long_toks


def score_sdh_anchors(
    items: Sequence[dict],
    cues: Sequence[srt.Cue],
    thresholds: Sequence[float] = DEFAULT_THRESHOLDS,
) -> dict:
    """Score extracted items against held-out SDH labels across confidence tiers."""
    by_id = {int(item["id"]): item for item in items}
    anchors = [c for c in cues if c.speaker_label]
    total_items = len(items)

    tiers = {}
    errors_high_conf = []

    for thr in thresholds:
        correct = wrong = skipped = 0
        retained_all = sum(
            1 for it in items
            if float(it.get("conf", 0.0)) >= thr
            and export.is_guessable_character(it.get("speaker", ""))
        )
        for cue in anchors:
            pred = by_id.get(cue.index)
            if pred is None:
                skipped += 1
                continue
            conf = float(pred.get("conf", 0.0))
            spk = pred.get("speaker", "")
            if conf < thr or (thr > 0.0 and not export.is_guessable_character(spk)):
                skipped += 1
                continue
            if speakers_match(spk, cue.speaker_label):
                correct += 1
            else:
                wrong += 1
                if thr == 0.90 and len(errors_high_conf) < 15:
                    errors_high_conf.append({
                        "id": cue.index,
                        "start": round(cue.start, 1),
                        "text": cue.text[:80],
                        "truth": cue.speaker_label,
                        "pred": spk,
                        "conf": conf,
                    })
        scored = correct + wrong
        tiers[f"{thr:.2f}"] = {
            "threshold": thr,
            "correct": correct,
            "wrong": wrong,
            "scored": scored,
            "precisionPct": round(100.0 * correct / scored, 1) if scored else 0.0,
            "anchorCoveragePct": round(100.0 * scored / len(anchors), 1) if anchors else 0.0,
            "filmLineCoveragePct": round(100.0 * retained_all / total_items, 1) if total_items else 0.0,
            "retainedLines": retained_all,
        }

    return {
        "totalCues": len(cues),
        "totalAnchors": len(anchors),
        "tiers": tiers,
        "highConfErrors": errors_high_conf,
    }


def score_puzzle_windows(
    items: Sequence[dict],
    meta: dict,
    reference_lines: Sequence[dict],
    min_conf: float = 0.85,
    min_align_score: float = 0.70,
    min_words: int = 5,
) -> dict:
    """Measure target & 3-line [target, ctx1, ctx2] accuracy on exported Scriptle script."""
    doc = export.build_scriptle_script(
        items, meta, min_conf=min_conf, min_run_length=3, merge_turns=True
    )
    val = export.validate_scriptle_script(doc, min_words=min_words)
    exported_lines = doc["lines"]
    top_cast = set(doc["topSpeakingCast"])

    if not exported_lines or not reference_lines:
        return {
            "minConf": min_conf,
            "exportedLines": len(exported_lines),
            "eligibleTargets": val["eligibleTargets"],
            "alignedTargets": 0,
            "targetPrecisionPct": 0.0,
            "window3Aligned": 0,
            "window3PrecisionPct": 0.0,
        }

    matches = align.align(
        [line["text"] for line in exported_lines],
        [line.get("text", "") for line in reference_lines],
        [line.get("character", "") for line in reference_lines],
    )

    ref_speaker_for: Dict[int, str] = {}
    for i, m in enumerate(matches):
        if m.line_index is not None and m.score >= min_align_score and m.speaker:
            ref_speaker_for[i] = m.speaker

    target_ok = target_total = 0
    win3_ok = win3_total = 0

    for idx, line in enumerate(exported_lines):
        same_scene = True
        if "scene" in line and idx + 2 < len(exported_lines):
            sc = line["scene"]
            same_scene = (
                exported_lines[idx + 1].get("scene") == sc
                and exported_lines[idx + 2].get("scene") == sc
            )
        if (
            line["character"] not in top_cast
            or not export.is_clean_dialogue(line["text"])
            or len(line["text"].split()) < min_words
            or idx < 1
            or idx >= len(exported_lines) - 3
            or not same_scene
        ):
            continue

        if idx in ref_speaker_for:
            target_total += 1
            if speakers_match(line["character"], ref_speaker_for[idx]):
                target_ok += 1

        if idx in ref_speaker_for and (idx + 1) in ref_speaker_for and (idx + 2) in ref_speaker_for:
            win3_total += 1
            all3 = all(
                speakers_match(exported_lines[j]["character"], ref_speaker_for[j])
                for j in (idx, idx + 1, idx + 2)
            )
            if all3:
                win3_ok += 1

    return {
        "minConf": min_conf,
        "exportedLines": len(exported_lines),
        "topSpeakingCastCount": len(top_cast),
        "eligibleTargets": val["eligibleTargets"],
        "alignedTargets": target_total,
        "targetPrecisionPct": round(100.0 * target_ok / target_total, 1) if target_total else 0.0,
        "window3Aligned": win3_total,
        "window3PrecisionPct": round(100.0 * win3_ok / win3_total, 1) if win3_total else 0.0,
    }


def run_benchmark(
    srt_path: Path,
    meta: dict,
    client: extract.GeminiClient,
    models: Sequence[str],
    arms: Sequence[str],
    audio_path: Optional[Path] = None,
    video_path: Optional[Path] = None,
    reference_script_path: Optional[Path] = None,
    work_dir: Optional[Path] = None,
    window_limit: Optional[int] = None,
    workers: int = 4,
    verify: bool = False,
) -> dict:
    """Run controlled zero-leakage benchmarks across models and modalities."""
    cues = srt.load_dialogue(srt_path)
    ref_lines: List[dict] = []
    if reference_script_path and reference_script_path.exists():
        ref_lines = json.loads(reference_script_path.read_text(encoding="utf-8")).get("lines", [])

    runs = []
    for model in models:
        for arm in arms:
            safe_model = extract.safe_model_slug(model)
            cache = (work_dir / f"{safe_model}_{arm}{'_v' if verify else ''}") if work_dir else None
            result = extract.extract_film(
                cues=cues,
                meta=meta,
                client=client,
                model=model,
                mode=arm,
                audio_path=audio_path,
                video_path=video_path,
                cache_dir=cache,
                strip_sdh=True,  # Strictly zero leakage!
                workers=workers,
                verify=verify,
                window_limit=window_limit,
            )
            scored_cues = cues[: len(result["items"])]
            sdh_report = score_sdh_anchors(result["items"], scored_cues)
            puzzle_85 = score_puzzle_windows(result["items"], meta, ref_lines, min_conf=0.85)
            puzzle_90 = score_puzzle_windows(result["items"], meta, ref_lines, min_conf=0.90)
            runs.append({
                "model": model,
                "arm": arm,
                "verify": verify,
                "usage": result["usage"],
                "sdh": sdh_report,
                "puzzleWindows085": puzzle_85,
                "puzzleWindows090": puzzle_90,
            })

    return {
        "film": meta.get("title"),
        "slug": meta.get("slug"),
        "srt": str(srt_path),
        "windowLimit": window_limit,
        "runs": runs,
    }


def format_report_table(report: dict) -> str:
    """Format a compact markdown comparison table for terminal or summary output."""
    lines = [
        f"Benchmark: {report.get('film')} ({report.get('slug')})",
        "| Model | Arm | All SDH | >=0.85 Prec (Cov) | >=0.90 Prec (Cov) | >=0.95 Prec (Cov) | 3-Line Win@0.90 | Time | Est $/film |",
        "|---|---|---:|---:|---:|---:|---:|---:|---:|",
    ]
    for r in report.get("runs", []):
        tiers = r["sdh"]["tiers"]
        t0 = tiers["0.00"]
        t85 = tiers["0.85"]
        t90 = tiers["0.90"]
        t95 = tiers["0.95"]
        pw = r["puzzleWindows090"]
        u = r["usage"]
        lines.append(
            f"| {r['model']} | {r['arm']}{'+v' if r.get('verify') else ''} "
            f"| {t0['precisionPct']:.1f}% ({t0['correct']}/{t0['scored']}) "
            f"| {t85['precisionPct']:.1f}% ({t85['anchorCoveragePct']:.0f}%) "
            f"| {t90['precisionPct']:.1f}% ({t90['anchorCoveragePct']:.0f}%) "
            f"| {t95['precisionPct']:.1f}% ({t95['anchorCoveragePct']:.0f}%) "
            f"| {pw['window3PrecisionPct']:.1f}% ({pw['eligibleTargets']} tgt) "
            f"| {u['elapsedSeconds']:.0f}s "
            f"| ${u['estimatedCostUsd']:.3f} |"
        )
    return "\n".join(lines)
