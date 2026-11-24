"""
Align an existing speaker-attributed transcript to subtitle cues.

Both sequences follow the film chronologically, so this is a monotonic
alignment rather than a search. A banded dynamic program keeps it cheap and
prevents pathological far-apart matches.

Transcript lines are speaker turns and cues are display units, so the mapping is
many-cues-to-one-line. Similarity is therefore containment of the cue's tokens
within the line's, not symmetric overlap: a short cue fully contained in a long
turn should score 1.0.
"""

import re
from dataclasses import dataclass
from typing import Dict, List, Optional, Sequence, Tuple

# Cost of leaving a cue or a transcript line unmatched. Both sources have real
# coverage gaps (different cuts, missing lines), so gaps must stay affordable
# relative to a bad match, or the aligner forces nonsense pairings.
GAP_COST = 0.6
BAND = 250

_WORD = re.compile(r"[a-z0-9']+")


@dataclass
class Match:
    cue_index: int
    line_index: Optional[int]
    speaker: Optional[str]
    score: float


def tokenize(text: str) -> List[str]:
    return _WORD.findall(text.lower().replace("’", "'"))


def containment(cue_tokens: Sequence[str], line_tokens: Sequence[str]) -> float:
    """Fraction of the cue's tokens present in the transcript line."""
    if not cue_tokens:
        return 0.0
    pool: Dict[str, int] = {}
    for token in line_tokens:
        pool[token] = pool.get(token, 0) + 1
    hit = 0
    for token in cue_tokens:
        if pool.get(token, 0) > 0:
            pool[token] -= 1
            hit += 1
    return hit / len(cue_tokens)


def align(
    cue_texts: Sequence[str],
    line_texts: Sequence[str],
    line_speakers: Sequence[str],
    band: int = BAND,
) -> List[Match]:
    """Align cues to transcript lines, returning one Match per cue."""
    n, m = len(cue_texts), len(line_texts)
    if not n or not m:
        return [Match(i, None, None, 0.0) for i in range(n)]

    cue_tokens = [tokenize(t) for t in cue_texts]
    line_tokens = [tokenize(t) for t in line_texts]
    ratio = m / n

    def band_range(i: int) -> Tuple[int, int]:
        center = int(i * ratio)
        return max(0, center - band), min(m, center + band + 1)

    INF = float("inf")
    # dp[j] = best cost aligning first i cues with first j lines.
    prev_row = [INF] * (m + 1)
    prev_row[0] = 0.0
    for j in range(1, m + 1):
        prev_row[j] = prev_row[j - 1] + GAP_COST

    # Backpointers per cell, needed to recover which line each cue mapped to.
    back: List[Dict[int, Tuple[int, str]]] = []

    for i in range(1, n + 1):
        lo, hi = band_range(i - 1)
        row = [INF] * (m + 1)
        row_back: Dict[int, Tuple[int, str]] = {}

        # Cue i unmatched, consuming no line.
        if prev_row[lo] < INF:
            row[lo] = prev_row[lo] + GAP_COST
            row_back[lo] = (lo, "skip_cue")

        for j in range(lo + 1, hi + 1):
            sim = containment(cue_tokens[i - 1], line_tokens[j - 1])
            cost = 1.0 - sim

            best, op = INF, ""
            # Pair cue with line j (line advances).
            if prev_row[j - 1] < INF:
                best, op = prev_row[j - 1] + cost, "match"
            # Another cue for the same line j (many-to-one).
            if prev_row[j] < INF and prev_row[j] + cost < best:
                best, op = prev_row[j] + cost, "continue"
            # Cue unmatched.
            if prev_row[j] < INF and prev_row[j] + GAP_COST < best:
                best, op = prev_row[j] + GAP_COST, "skip_cue"
            # Line unmatched.
            if row[j - 1] < INF and row[j - 1] + GAP_COST < best:
                best, op = row[j - 1] + GAP_COST, "skip_line"

            if best < INF:
                row[j] = best
                row_back[j] = (j, op)

        back.append(row_back)
        prev_row = row

    end_j = min(range(m + 1), key=lambda j: prev_row[j] if prev_row[j] < INF else INF)

    matches: List[Optional[Match]] = [None] * n
    j = end_j
    for i in range(n, 0, -1):
        entry = back[i - 1].get(j)
        if entry is None:
            matches[i - 1] = Match(i - 1, None, None, 0.0)
            continue
        _, op = entry
        while op == "skip_line" and j > 0:
            j -= 1
            entry = back[i - 1].get(j)
            if entry is None:
                break
            _, op = entry

        if op in ("match", "continue") and 1 <= j <= m:
            score = containment(cue_tokens[i - 1], line_tokens[j - 1])
            matches[i - 1] = Match(i - 1, j - 1, line_speakers[j - 1], score)
            if op == "match":
                j -= 1
        else:
            matches[i - 1] = Match(i - 1, None, None, 0.0)

    return [match or Match(i, None, None, 0.0) for i, match in enumerate(matches)]
