"""
SRT parsing and normalization for the transcript pipeline.

Turns a subtitle file into dialogue cues suitable for speaker attribution:
strips markup, separates SDH speaker labels and sound descriptions from spoken
text, splits dash-prefixed cues that hold two speakers, and merges cues that a
subtitler split mid-sentence purely for reading speed.
"""

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional

TIMECODE = re.compile(
    r"(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})"
)
MICRODVD = re.compile(r"^\{(\d+)\}\{(\d+)\}(.*)$")
TAG = re.compile(r"<[^>]+>|\{[^}]*\}")
# SDH speaker labels are colon-terminated at the start of a turn:
# ALL-CAPS ("HARRY:", "MRS. WEASLEY:") or Title-Case ("Han:", "Darth Vader:").
SPEAKER_LABEL = re.compile(r"^([A-Z][A-Za-z0-9 .'\-]{1,24}):\s+")
_NON_SPEAKER_PREFIXES = {
    "NOTE", "WARNING", "CAUTION", "REMEMBER", "UPDATE", "CHAPTER", "EPISODE",
    "PART", "SCENE", "ACT", "PREVIOUSLY", "MEANWHILE", "LATER", "NEXT",
    "FIRST", "SECOND", "THIRD", "FINALLY", "ACTUALLY", "LISTEN", "LOOK",
    "WAIT", "PLEASE", "SORRY", "THANKS", "YES", "NO", "WELL", "NOW", "HERE",
    "THERE", "TODAY", "TOMORROW", "YESTERDAY", "QUESTION", "ANSWER", "RULE",
    "FACT", "TIP", "HINT", "TRANSLATION", "SUBTITLES", "CAPTIONS", "MUSIC",
}
_LABEL_QUALIFIER = re.compile(
    r"\s+(?:OVER|ON)\s+(?:COMLINK|RADIO|PA|PHONE|INTERCOM|SPEAKER|TV|SCREEN).*$",
    re.IGNORECASE,
)


def _match_speaker_label(text: str):
    """Match an SDH speaker prefix while rejecting ordinary prose colons."""
    match = SPEAKER_LABEL.match(text)
    if not match:
        return None
    raw = match.group(1).strip().rstrip(".")
    # Reject sentences with too many words or obvious non-speaker lead-ins.
    words = raw.split()
    if len(words) > 4:
        return None
    if words[0].upper() in _NON_SPEAKER_PREFIXES:
        return None
    # Mixed-case labels must start with a capitalized word and stay short;
    # reject if > 1 lowercase non-connector word (e.g. "Here is a clue:").
    connectors = {"of", "the", "on", "over", "in", "at", "to", "and", "off."}
    if not raw.isupper():
        lower_words = [w for w in words[1:] if w[0].islower() and w.lower() not in connectors]
        if len(lower_words) > 1:
            return None
    cleaned = _LABEL_QUALIFIER.sub("", raw).strip().rstrip(".")
    return match, cleaned.upper()
# Whole-line sound descriptions: "[thunder rumbles]", "(gasping)"
SOUND_ONLY = re.compile(r"^[\[(][^\])]*[\])]$")
INLINE_SOUND = re.compile(r"[\[(][^\])]*[\])]")


@dataclass
class Cue:
    index: int
    start: float
    end: float
    text: str
    speaker_label: Optional[str] = None
    is_sound: bool = False
    source_indices: List[int] = field(default_factory=list)

    @property
    def duration(self) -> float:
        return self.end - self.start


def _to_seconds(h: str, m: str, s: str, ms: str) -> float:
    return int(h) * 3600 + int(m) * 60 + int(s) + int(ms) / 1000.0


def decode(data: bytes) -> str:
    """Decode subtitle bytes, honouring BOMs and falling back to cp1252.

    Subtitle files in the wild are frequently UTF-16 or Windows-1252. Decoding
    those as UTF-8 with errors="replace" does not fail loudly -- it yields a
    string of replacement characters in which no timecode matches, so the file
    silently parses to zero cues and looks merely empty.
    """
    for bom, encoding in (
        (b"\xff\xfe", "utf-16-le"),
        (b"\xfe\xff", "utf-16-be"),
        (b"\xef\xbb\xbf", "utf-8-sig"),
    ):
        if data.startswith(bom):
            return data.decode(encoding, errors="replace")

    for encoding in ("utf-8", "cp1252", "latin-1"):
        try:
            return data.decode(encoding)
        except UnicodeDecodeError:
            continue
    return data.decode("utf-8", errors="replace")


def parse(path: Path) -> List[Cue]:
    """Parse an SRT file into raw cues, one per subtitle block."""
    raw = decode(path.read_bytes())
    raw = raw.replace("\r\n", "\n").replace("\r", "\n")

    cues: List[Cue] = []
    for block in re.split(r"\n\s*\n", raw.strip()):
        lines = [line for line in block.split("\n") if line.strip()]
        if len(lines) < 2:
            continue
        match = next((TIMECODE.search(line) for line in lines[:2] if TIMECODE.search(line)), None)
        if not match:
            continue
        body_start = 1 + next(i for i, line in enumerate(lines[:2]) if TIMECODE.search(line))
        text = "\n".join(lines[body_start:]).strip()
        if not text:
            continue
        g = match.groups()
        cues.append(Cue(
            index=len(cues),
            start=_to_seconds(*g[:4]),
            end=_to_seconds(*g[4:]),
            text=text,
        ))
    if cues:
        return cues

    # SubDL archives often label MicroDVD frame-based files as `.srt`. They are
    # still valuable as independent quote evidence even when they are not the
    # timing reference. A `{1}{1}23.976` header supplies FPS when present;
    # otherwise 25 fps is the conventional fallback.
    micro_rows = []
    fps = 25.0
    for line in raw.split("\n"):
        match = MICRODVD.match(line.strip())
        if not match:
            continue
        start_frame, end_frame, text = match.groups()
        if start_frame == end_frame == "1":
            try:
                fps = float(text.strip())
                continue
            except ValueError:
                pass
        micro_rows.append((int(start_frame), int(end_frame), text))
    for start_frame, end_frame, text in micro_rows:
        text = text.replace("|", "\n").strip()
        if not text:
            continue
        cues.append(Cue(
            index=len(cues),
            start=start_frame / fps,
            end=end_frame / fps,
            text=text,
        ))
    return cues


def _split_speaker_turns(text: str) -> List[str]:
    """Split a cue into turns. A leading dash on 2+ lines marks distinct speakers."""
    lines = [line.strip() for line in text.split("\n") if line.strip()]
    named = [line for line in lines if _match_speaker_label(line)]
    if len(named) >= 2:
        return lines
    dashed = [line for line in lines if line.startswith(("-", "–", "—"))]
    if len(dashed) >= 2:
        return [re.sub(r"^[-–—]\s*", "", line) for line in lines]
    return [" ".join(lines)]


def normalize(cues: List[Cue]) -> List[Cue]:
    """Clean markup, pull out SDH labels, and flag non-dialogue sound cues."""
    out: List[Cue] = []
    for cue in cues:
        text = TAG.sub("", cue.text)
        for turn in _split_speaker_turns(text):
            turn = turn.strip()
            if not turn:
                continue

            if SOUND_ONLY.match(turn):
                out.append(Cue(len(out), cue.start, cue.end, turn,
                               is_sound=True, source_indices=[cue.index]))
                continue

            speaker = None
            label = _match_speaker_label(turn)
            if label:
                match, speaker = label
                turn = turn[match.end():].strip()

            # An inline sound gloss can precede dialogue: "[softly] Come here."
            turn = INLINE_SOUND.sub(" ", turn).strip()
            turn = re.sub(r"\s+", " ", turn)
            if not turn:
                continue

            out.append(Cue(len(out), cue.start, cue.end, turn,
                           speaker_label=speaker, source_indices=[cue.index]))
    return out


def _is_continuation(prev: Cue, nxt: Cue, max_gap: float) -> bool:
    """True when nxt continues prev's sentence rather than starting a new turn."""
    if prev.is_sound or nxt.is_sound:
        return False
    if nxt.start - prev.end > max_gap:
        return False
    if nxt.speaker_label:
        return False
    # A completed sentence ends a turn; a dangling clause continues one.
    if re.search(r"[.!?…\"'”]\s*$", prev.text):
        return False
    # A new sentence normally starts capitalized; lower case implies continuation.
    return bool(re.match(r"^[a-z,]", nxt.text))


def merge_continuations(cues: List[Cue], max_gap: float = 2.0) -> List[Cue]:
    """Rejoin sentences the subtitler split across cues for reading speed."""
    if not cues:
        return []

    merged = [cues[0]]
    for cue in cues[1:]:
        prev = merged[-1]
        if _is_continuation(prev, cue, max_gap):
            prev.text = f"{prev.text} {cue.text}".strip()
            prev.end = cue.end
            prev.source_indices.extend(cue.source_indices)
        else:
            merged.append(cue)

    for i, cue in enumerate(merged):
        cue.index = i
    return merged


def load_dialogue(path: Path) -> List[Cue]:
    """Full pipeline: parse, normalize, merge, and drop non-dialogue cues."""
    cues = merge_continuations(normalize(parse(path)))
    return [c for c in cues if not c.is_sound]


def format_time(seconds: float) -> str:
    milliseconds = max(0, round(seconds * 1000))
    hours, milliseconds = divmod(milliseconds, 3_600_000)
    minutes, milliseconds = divmod(milliseconds, 60_000)
    whole_seconds, milliseconds = divmod(milliseconds, 1000)
    return f"{hours:02d}:{minutes:02d}:{whole_seconds:02d},{milliseconds:03d}"


def write(path: Path, cues: List[Cue]) -> None:
    blocks = []
    for index, cue in enumerate(cues, 1):
        text = f"{cue.speaker_label}: {cue.text}" if cue.speaker_label else cue.text
        blocks.append(
            f"{index}\n{format_time(cue.start)} --> {format_time(cue.end)}\n{text}"
        )
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n\n".join(blocks) + "\n")
