"""Transfer SDH labels onto the subtitle release whose timing matches the media."""

import argparse
import json
import sys
from pathlib import Path
from typing import Sequence

sys.path.insert(0, str(Path(__file__).parent.parent))

from pipeline import align, srt  # noqa: E402

MIN_TRANSFER_SCORE = 0.7
MIN_DRIFT_SCORE = 0.85


def timing_model(reference_cues: Sequence, label_cues: Sequence, matches) -> dict:
    pairs = []
    for reference, match in zip(reference_cues, matches):
        if match.line_index is None or match.score < MIN_DRIFT_SCORE:
            continue
        source = label_cues[match.line_index]
        pairs.append((
            (source.start + source.end) / 2.0,
            (reference.start + reference.end) / 2.0,
        ))
    if len(pairs) < 3:
        return {"scale": 1.0, "offset": 0.0, "pairs": len(pairs), "medianError": None}

    import numpy as np

    values = np.asarray(pairs, dtype=float)
    kept = np.ones(len(values), dtype=bool)
    scale, offset = 1.0, 0.0
    for _ in range(4):
        scale, offset = np.polyfit(values[kept, 0], values[kept, 1], 1)
        errors = np.abs(values[:, 0] * scale + offset - values[:, 1])
        median = float(np.median(errors[kept]))
        threshold = max(1.0, median * 4.0)
        updated = errors <= threshold
        if updated.sum() < 3 or np.array_equal(updated, kept):
            break
        kept = updated
    errors = np.abs(values[:, 0] * scale + offset - values[:, 1])
    return {
        "scale": round(float(scale), 7),
        "offset": round(float(offset), 3),
        "pairs": int(kept.sum()),
        "medianError": round(float(np.median(errors[kept])), 3),
    }


def merge(reference_path: Path, labels_path: Path) -> tuple:
    reference = srt.load_dialogue(reference_path)
    labels = srt.load_dialogue(labels_path)
    matches = align.align(
        [cue.text for cue in reference],
        [cue.text for cue in labels],
        [cue.speaker_label or "" for cue in labels],
    )
    reverse = align.align(
        [cue.text for cue in labels],
        [cue.text for cue in reference],
        [str(index) for index in range(len(reference))],
    )
    source_by_reference = {}
    for source_cue, match in zip(labels, reverse):
        if (
            source_cue.speaker_label
            and match.line_index is not None
            and match.score >= MIN_TRANSFER_SCORE
        ):
            source_by_reference.setdefault(match.line_index, []).append(source_cue)

    transferred = 0
    split_count = 0
    merged_cues = []
    for reference_index, (cue, match) in enumerate(zip(reference, matches)):
        source_turns = source_by_reference.get(reference_index, [])
        distinct_speakers = {turn.speaker_label for turn in source_turns}
        combined_tokens = [
            token
            for turn in source_turns
            for token in align.tokenize(turn.text)
        ]
        combined_coverage = align.containment(
            align.tokenize(cue.text), combined_tokens
        )
        if len(source_turns) >= 2 and len(distinct_speakers) >= 2 and combined_coverage >= 0.7:
            for source_turn in source_turns:
                merged_cues.append(srt.Cue(
                    index=len(merged_cues),
                    start=cue.start,
                    end=cue.end,
                    text=source_turn.text,
                    speaker_label=source_turn.speaker_label,
                    source_indices=cue.source_indices,
                ))
                transferred += 1
            split_count += 1
            continue
        if match.speaker and match.score >= MIN_TRANSFER_SCORE:
            cue.speaker_label = match.speaker
            transferred += 1
        cue.index = len(merged_cues)
        merged_cues.append(cue)
    report = {
        "reference": str(reference_path),
        "labels": str(labels_path),
        "referenceCues": len(reference),
        "labelCues": len(labels),
        "labelsTransferred": transferred,
        "multiSpeakerCuesSplit": split_count,
        "timing": timing_model(reference, labels, matches),
    }
    return merged_cues, report


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Transfer labels between text-aligned subtitle releases"
    )
    parser.add_argument("--reference", type=Path, required=True)
    parser.add_argument("--labels", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()

    cues, report = merge(args.reference, args.labels)
    srt.write(args.out, cues)
    report_path = args.report or args.out.with_suffix(".merge.json")
    report_path.write_text(json.dumps(report, indent=1))
    timing = report["timing"]
    print(f"labels transferred : {report['labelsTransferred']}")
    print(
        f"timing model       : reference = {timing['scale']:.6f} * labels "
        f"+ {timing['offset']:.3f}s; median error {timing['medianError']}s"
    )
    print(f"wrote {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
