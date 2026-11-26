"""
Export attributed dialogue into validated Scriptle script JSON format.

Produces files 100% compatible with `public/data/scripts/<id>.json`,
`scripts/update-top-speaking-cast.js`, and `scripts/generate-daily-puzzles.py`.

Key guarantee for Scriptle gameplay:
Scriptle selects `[target, context1, context2]` (requiring 1 line before and 3
lines after the target). Randomly deleting low-confidence cues out of the middle
of a conversation would stitch non-adjacent lines together as fake context.
Instead, `filter_contiguous_runs` preserves ONLY genuine contiguous dialogue runs
of high-confidence cues (length >= `min_run_length`), guaranteeing every context
clue players see is the real next spoken line in the movie!
"""

import json
import re
from collections import Counter
from pathlib import Path
from typing import Dict, List, Optional, Sequence, Tuple

# Kept in exact sync with scripts/generate-daily-puzzles.py
NON_CHARACTER_SPEAKERS = {
    "ALL", "BOTH", "EVERYONE", "CROWD", "UNIDENTIFIED", "VARIOUS", "GROUP",
    "CHORUS", "MAN", "WOMAN", "BOY", "GIRL", "VOICE", "VOICES", "ANNOUNCER",
    "NARRATOR", "OTHERS", "OTHER", "UNKNOWN", "TOGETHER", "YOUNG BOY", "YOUNG GIRL",
}

# Generic unnamed roles kept as conversational context clues (e.g. STORMTROOPER,
# IMPERIAL OFFICER, REBEL PILOT, GUARD 1) but NEVER eligible as guessable targets
# or topSpeakingCast entries.
_GENERIC_ROLE_MODIFIERS = (
    r"(?:IMPERIAL|REBEL|DEATH STAR|SECURITY|POLICE|FIRST|SECOND|THIRD|HEAD|CHIEF|"
    r"LEAD|SENIOR|JUNIOR|YOUNG|OLD|MALE|FEMALE|DECK|CONTROL|BRIDGE|FLIGHT|WING|"
    r"RED|GOLD|BLUE|GREEN|TIE|FIGHTER|X-WING|CANTINA|PALACE|PRISON|JAIL|STORE|"
    r"HOTEL|BANK|HOSPITAL|NEWS|RADIO|TV|PA|INTERCOM|SHIP|CREW|GROUND|FIELD|SWAT|ARMY|"
    r"NAVY|MILITARY|FEDERAL|SECRET|ROYAL|CITY|LOCAL|ANOTHER|AUTOMATED|COMPUTER|"
    r"SHIELD|S\.H\.I\.E\.L\.D\.|NAZI|HYDRA|PHYSICAL|TOWER|MINING|TRIBE|"
    r"DAI LI|DELIVERY|HEALTH|LOAN|REAL ESTATE|SUN WARRIOR|TRAIN)\s+"
)
_GENERIC_ROLE_NOUNS = (
    r"(?:STORMTROOPER|TROOPER|OFFICER|PILOT|GUARD|SOLDIER|COP|DETECTIVE|AGENT|"
    r"DRIVER|WAITER|WAITRESS|BARTENDER|SERVER|CLERK|ATTENDANT|REPORTER|ANCHOR|"
    r"TECHNICIAN|TECH|OPERATOR|CONTROLLER|CREWMAN|GUNNER|NAVIGATOR|ENGINEER|MEDIC|NURSE|"
    r"ANNOUNCER|INTERCOM|COMPUTER|PA|RADIO|VOICE|DISPATCHER|THUG|HENCHMAN|"
    r"PATRON|CUSTOMER|PASSENGER|BYSTANDER|SPECTATOR|PROTESTER|PRISONER|INMATE|"
    r"STUDENT|TEACHER|WORKER|FARMER|MERCHANT|VENDOR|BARKER|HOST|HOSTESS|"
    r"CAPTAIN|COMMANDER|LIEUTENANT|SERGEANT|CORPORAL|PRIVATE|ADMIRAL|GENERAL|"
    r"LEADER|BOSS|DOCTOR|LAWYER|JUDGE|PRIEST|MINISTER|WARRIOR|KNIGHT|"
    r"COUNCILMAN|COUNCILWOMAN|MILITANT|THERAPIST|KEEPER|ELDER|"
    r"ARBITER|ARBITRATOR|CATERER|CHIEF|COACH|CONDUCTOR|EDITOR|FISHERMAN|"
    r"HERBALIST|HITCHHIKER|HOUSEWIFE|INSPECTOR|INVESTIGATOR|LIFEGUARD|MOTHER|"
    r"NEIGHBOR|OFFICIAL|OWNER|PARENT|PROSTITUTE|RECEPTIONIST|SALESMAN|SALESWOMAN|"
    r"TEENAGER|TOURIST|"
    r"MAN|WOMAN|BOY|GIRL|KID|CHILD|STRANGER|ALIEN|DROID|ROBOT|MONSTER|BULLY)"
)
GENERIC_CONTEXT_ROLE_RE = re.compile(
    rf"^(?:{_GENERIC_ROLE_MODIFIERS})*{_GENERIC_ROLE_NOUNS}(?:\s+#?\d+|\s+[A-Z])?$",
    re.IGNORECASE,
)

# Fully dropped speakers (never kept even as context clues).
DROPPED_SPEAKERS = {"", "OTHER", "OTHERS", "UNKNOWN", "UNIDENTIFIED", "VARIOUS", "CROWD", "ALL", "EVERYONE"}

ANNOTATION_SUFFIX = re.compile(
    r"\s*\((?:V\.?\s?O\.?|O\.?\s?S\.?|O\.?\s?C\.?|CONT['’]?D|CONTINUED|SUBTITLES?|"
    r"PRE-?LAP|FILTERED|ON (?:TV|RADIO|PHONE)|\d+\s+YEARS?\s+OLD)\)\s*$",
    re.IGNORECASE,
)
LEADING_DIRECTION = re.compile(r"^\s*\([^)]*\)\s*")

# Kept in exact sync with scripts/update-top-speaking-cast.js
MIN_CAST_LINES = 5
MIN_CAST_SIZE = 10
MAX_CAST_SIZE = 20


def normalize_character(name: str) -> str:
    """Strip screenplay annotations, 'VOICE OF' prefixes, and normalize whitespace/casing."""
    if not name:
        return ""
    prev = None
    result = name.strip().upper()
    while result != prev:
        prev = result
        result = ANNOTATION_SUFFIX.sub("", result).strip()
        result = re.sub(r"^VOICE\s+OF\s+", "", result).strip()
    return re.sub(r"\s+", " ", result)


_INVISIBLE_CHARS = re.compile(r"[\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]")
_CC_SPEAKER_PREFIX = re.compile(r"(?:^|\s)>>\s*(?:[A-Z][A-Z0-9 .'\-]{0,24}\s*:\s+)?")
_LEADING_SDH_SPEAKER = re.compile(r"^[A-Z][A-Z0-9 .'\-]{1,24}\s*:\s+(?=.*[a-z])")


def clean_line_text(text: str) -> str:
    """Clean dialogue text of caption chevrons, leaked SDH speaker labels, parentheticals, and BiDi chars."""
    if not text:
        return ""
    prev = None
    result = _INVISIBLE_CHARS.sub("", text).strip()
    while result != prev:
        prev = result
        result = _CC_SPEAKER_PREFIX.sub(" ", result).strip()
        result = LEADING_DIRECTION.sub("", result).strip()
        result = _LEADING_SDH_SPEAKER.sub("", result).strip()
    return re.sub(r"\s+", " ", result)


def is_generic_context_role(name: str) -> bool:
    """True for concise unnamed role labels (STORMTROOPER, GUARD, REBEL PILOT)."""
    norm = normalize_character(name)
    if not norm or norm in DROPPED_SPEAKERS:
        return False
    return bool(GENERIC_CONTEXT_ROLE_RE.match(norm))


def is_guessable_character(name: str) -> bool:
    norm = normalize_character(name)
    if not norm or norm in NON_CHARACTER_SPEAKERS:
        return False
    return not is_generic_context_role(norm)


def is_clean_dialogue(text: str) -> bool:
    return bool(text) and "(" not in text and "[" not in text


def compute_top_speaking_cast(lines: Sequence[dict], min_target_words: int = 5) -> List[str]:
    """Compute topSpeakingCast matching scripts/update-top-speaking-cast.js.

    Also requires at least one substantive line (>= min_target_words) so
    purely non-verbal characters (e.g. Chewbacca growls) don't clutter dropdowns.
    """
    counts = Counter(
        line["character"]
        for line in lines
        if is_guessable_character(line.get("character", ""))
    )
    has_substantive = {
        line["character"]
        for line in lines
        if is_guessable_character(line.get("character", ""))
        and len(clean_line_text(line.get("text", "")).split()) >= min_target_words
    }
    ranked = sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))
    qualified = [char for char, cnt in ranked if cnt >= MIN_CAST_LINES and char in has_substantive]
    if len(qualified) > MAX_CAST_SIZE:
        return qualified[:MAX_CAST_SIZE]
    return qualified


def merge_adjacent_same_speaker(
    items: Sequence[dict],
    max_gap: float = 1.5,
) -> List[dict]:
    """Combine split subtitle display cues from the same speaker within max_gap."""
    if not items:
        return []
    merged: List[dict] = [dict(items[0])]
    for item in items[1:]:
        prev = merged[-1]
        same = prev.get("speaker") == item.get("speaker")
        gap = float(item.get("start", 0.0)) - float(prev.get("end", 0.0))
        if same and 0.0 <= gap <= max_gap and prev.get("clean", True) and item.get("clean", True):
            prev["text"] = f"{prev['text']} {item['text']}".strip()
            prev["end"] = item.get("end", prev.get("end", 0.0))
            prev["conf"] = min(float(prev.get("conf", 1.0)), float(item.get("conf", 1.0)))
        else:
            merged.append(dict(item))
    return merged


def filter_contiguous_runs(
    items: Sequence[dict],
    min_conf: float = 0.85,
    min_run_length: int = 3,
    drop_non_character: bool = True,
    allow_context_roles: bool = True,
    max_scene_gap: float = 12.0,
) -> List[dict]:
    """Keep only contiguous, same-scene runs of high-confidence dialogue lines.

    If a line fails confidence/cleanliness/speaker checks, or follows a scene
    break (`> max_scene_gap` seconds), the current run ends and is kept only if
    it has at least `min_run_length` lines and at least one guessable named
    character. Every kept line receives an integer `scene` ID so puzzle
    selection never crosses a scene boundary.
    """
    runs: List[List[dict]] = []
    current: List[dict] = []

    def flush() -> None:
        nonlocal current
        if len(current) >= min_run_length and any(
            is_guessable_character(line["character"]) for line in current
        ):
            runs.append(current)
        current = []

    for item in items:
        speaker = normalize_character(item.get("speaker") or item.get("character") or "")
        text = clean_line_text(item.get("text") or "")
        conf = float(item.get("conf", item.get("confidence", 1.0)))
        clean = bool(item.get("clean", True)) and is_clean_dialogue(text)

        if not drop_non_character:
            valid_speaker = bool(speaker)
        elif allow_context_roles:
            valid_speaker = (
                bool(speaker)
                and speaker not in DROPPED_SPEAKERS
                and (is_guessable_character(speaker) or is_generic_context_role(speaker))
            )
        else:
            valid_speaker = is_guessable_character(speaker)

        ok = bool(text) and valid_speaker and clean and conf >= min_conf

        if not ok:
            flush()
            continue

        if current and item.get("start") is not None and current[-1].get("end") is not None:
            if float(item["start"]) - float(current[-1]["end"]) > max_scene_gap:
                flush()

        current.append({
            "character": speaker,
            "text": text,
            "start": item.get("start"),
            "end": item.get("end"),
            "conf": conf,
        })

    flush()

    out: List[dict] = []
    for scene_idx, run in enumerate(runs):
        for line in run:
            out.append({**line, "scene": scene_idx})
    return out


def build_scriptle_script(
    items: Sequence[dict],
    meta: dict,
    script_id: Optional[str] = None,
    min_conf: float = 0.85,
    min_run_length: int = 3,
    merge_turns: bool = True,
    alias_map: Optional[Dict[str, str]] = None,
    allow_context_roles: bool = True,
    max_scene_gap: float = 12.0,
) -> dict:
    """Build a complete Scriptle script JSON document from extracted items."""
    aliases = {k.upper(): v.upper() for k, v in (alias_map or {}).items()}

    normalized: List[dict] = []
    for raw in items:
        spk = normalize_character(raw.get("speaker") or raw.get("character") or "")
        spk = aliases.get(spk, spk)
        row = dict(raw)
        row["speaker"] = spk
        normalized.append(row)

    if merge_turns:
        normalized = merge_adjacent_same_speaker(normalized)

    filtered = filter_contiguous_runs(
        normalized,
        min_conf=min_conf,
        min_run_length=min_run_length,
        drop_non_character=True,
        allow_context_roles=allow_context_roles,
        max_scene_gap=max_scene_gap,
    )

    lines = [
        {"character": r["character"], "text": r["text"], "scene": r["scene"]}
        for r in filtered
    ]
    characters = sorted({line["character"] for line in lines if is_guessable_character(line["character"])})
    top_speaking_cast = compute_top_speaking_cast(lines)

    doc = {
        "id": script_id or meta.get("slug") or "unknown-movie",
        "title": meta.get("title") or "",
        "year": meta.get("year"),
        "characters": characters,
        "lines": lines,
        "lineCount": len(lines),
        "characterCount": len(characters),
        "imdbId": meta.get("imdbId") or "",
        "poster": meta.get("poster") or "",
        "rated": meta.get("rated") or "",
        "runtime": meta.get("runtime") or "",
        "genre": meta.get("genre") or "",
        "director": meta.get("director") or "",
        "topSpeakingCast": top_speaking_cast,
    }
    return doc


def validate_scriptle_script(doc: dict, min_words: int = 5) -> dict:
    """Validate a Scriptle script JSON against generate-daily-puzzles.py rules."""
    errors: List[str] = []
    warnings: List[str] = []

    for req_field in ("id", "title", "year", "characters", "lines", "topSpeakingCast"):
        if not doc.get(req_field):
            errors.append(f"Missing or empty required field: {req_field}")

    for meta_field in ("imdbId", "poster", "rated", "runtime", "genre", "director"):
        if not doc.get(meta_field):
            warnings.append(f"Missing optional metadata field: {meta_field}")

    lines = doc.get("lines") or []
    top_cast = set(doc.get("topSpeakingCast") or [])

    eligible = 0
    non_char_leaks = 0
    context_role_lines = 0
    by_char: Counter = Counter()
    scenes = {line["scene"] for line in lines if "scene" in line}

    for char in top_cast:
        if not is_guessable_character(char):
            non_char_leaks += 1

    for idx, line in enumerate(lines):
        char = normalize_character(line.get("character") or "")
        text = clean_line_text(line.get("text") or "")
        if not is_guessable_character(char):
            if is_generic_context_role(char):
                context_role_lines += 1
            else:
                non_char_leaks += 1
        same_scene = True
        if "scene" in line and idx + 2 < len(lines):
            sc = line["scene"]
            same_scene = lines[idx + 1].get("scene") == sc and lines[idx + 2].get("scene") == sc
        if (
            char in top_cast
            and is_guessable_character(char)
            and is_clean_dialogue(text)
            and len(text.split()) >= min_words
            and idx >= 1
            and idx < len(lines) - 3
            and same_scene
        ):
            eligible += 1
            by_char[char] += 1

    if eligible < 150:
        warnings.append(f"Low eligible puzzle targets ({eligible} < 150)")
    if eligible < 50:
        errors.append(f"Critically low eligible puzzle targets ({eligible} < 50)")
    if len(top_cast) < 4:
        errors.append(f"Too few topSpeakingCast characters ({len(top_cast)} < 4)")
    if non_char_leaks > 0:
        warnings.append(f"{non_char_leaks} non-character leaks found")

    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "warnings": warnings,
        "totalLines": len(lines),
        "sceneCount": len(scenes),
        "contextRoleLines": context_role_lines,
        "characterCount": len(doc.get("characters") or []),
        "topSpeakingCastCount": len(top_cast),
        "eligibleTargets": eligible,
        "nonCharacterLeaks": non_char_leaks,
        "topTargetCharacters": by_char.most_common(10),
    }


def write_script(doc: dict, out_path: Path) -> Path:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(doc, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return out_path
