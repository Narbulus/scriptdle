"""
Audit shipped transcripts against subtitles of the actual films.

Several Scriptdle packs are built from script-derived datasets, which contain
lines that were written but never filmed. Those ship as puzzle quotes players
cannot have heard.

A line is only reported as absent when its content words appear in NONE of the
subtitle releases fetched for that film. Unioning several releases means an
extended cut or an alternate edit resolves in the transcript's favour, so the
result is a conservative lower bound on contamination rather than a guess.
"""

import io
import json
import re
import sys
import time
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path
from typing import Dict, List, Optional, Set

sys.path.insert(0, str(Path(__file__).parent.parent))

from pipeline import align, srt  # noqa: E402

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36"
SUBS_PER_FILM = 3
# SubDL throttles a sustained crawl. These keep a 71-film pass inside its limits.
BACKOFF_BASE = 8.0
PER_REQUEST_DELAY = 2.5
PER_FILM_DELAY = 4.0
# Below this share of content words present, treat the line as not in the film.
PRESENCE_FLOOR = 0.5
STOPWORDS = set(
    "a an the and or but if of to in on at is are was were be been being it its "
    "he she they them we you i my your his her their this that these those for "
    "with as by from not no do does did so up out".split()
)


def get_repo_root() -> Path:
    return Path(__file__).parent.parent


def load_env() -> Dict[str, str]:
    env_file = get_repo_root() / ".env"
    env_vars = {}
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            env_vars[key.strip()] = value.strip().strip('"').strip("'")
    return env_vars


def search_subtitles(api_key: str, imdb_id: str) -> List[dict]:
    query = urllib.parse.urlencode({
        "api_key": api_key,
        "imdb_id": imdb_id,
        "languages": "EN",
        "type": "movie",
        "subs_per_page": "30",
    })
    url = f"https://api.subdl.com/api/v1/subtitles?{query}"
    with urllib.request.urlopen(url, timeout=30) as response:
        return json.loads(response.read()).get("subtitles") or []


class RateLimited(Exception):
    """The API throttled us. Distinct from a film genuinely having no subtitles."""


def download_srt(entry: dict, dest: Path, attempts: int = 4) -> Optional[Path]:
    """Download and unpack one subtitle, backing off when throttled.

    Throttling must not be swallowed: treating a 429 as "no subtitles" turns a
    retryable condition into a permanent-looking verdict, which is exactly how
    an earlier full-corpus run reported 54 films as having no subtitles at all.
    """
    request = urllib.request.Request("https://dl.subdl.com" + entry["url"])
    request.add_header("User-Agent", UA)

    for attempt in range(1, attempts + 1):
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                payload = response.read()
            archive = zipfile.ZipFile(io.BytesIO(payload))
            names = [n for n in archive.namelist() if n.lower().endswith((".srt", ".sub"))]
            if not names:
                return None
            dest.write_bytes(archive.read(names[0]))
            return dest
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503, 504):
                if attempt == attempts:
                    raise RateLimited(f"HTTP {e.code} after {attempts} attempts")
                time.sleep(BACKOFF_BASE * (2 ** (attempt - 1)))
                continue
            return None
        except (zipfile.BadZipFile, urllib.error.URLError, TimeoutError):
            if attempt == attempts:
                return None
            time.sleep(BACKOFF_BASE)
    return None


def rank_entries(entries: List[dict]) -> List[dict]:
    """Prefer SDH releases, which carry speaker labels and fuller coverage."""
    return sorted(entries, key=lambda e: (not e.get("hi"), e.get("release_name") or ""))


def subtitle_vocabulary(path: Path) -> Set[str]:
    """Extract every spoken word from a subtitle file, whatever its format.

    The audit only asks whether a word occurs anywhere in the film, so timing is
    irrelevant. Skipping the cue parser makes this tolerant of MicroDVD, SubViewer
    and malformed SRT alike -- formats that are common in the wild and that a
    strict parser silently reduces to zero cues.
    """
    text = srt.decode(path.read_bytes())
    text = re.sub(r"<[^>]+>|\{[^}]*\}", " ", text)          # markup, MicroDVD markers
    text = re.sub(r"\d{1,2}:\d{2}:\d{2}[,.]\d{3}", " ", text)  # SRT timecodes
    text = re.sub(r"^\s*\d+\s*$", " ", text, flags=re.M)     # cue numbers
    text = re.sub(r"\[[^\]]*\]|\([^)]*\)", " ", text)        # sound descriptions
    return set(align.tokenize(text))


def content_words(text: str) -> List[str]:
    return [w for w in align.tokenize(text) if w not in STOPWORDS]


def audit_film(
    script_path: Path, api_key: str, cache: Path, offline: bool = False
) -> Optional[dict]:
    doc = json.loads(script_path.read_text())
    imdb_id = doc.get("imdbId")
    lines = doc.get("lines", [])
    if not imdb_id or not lines:
        return None

    if offline:
        # Recompute from whatever is already cached, without touching the API.
        # Lets a throttled or partial crawl still yield results for the films
        # already fetched.
        # Match only a numeric suffix: a plain glob would let "back-to-the-future"
        # also pick up "back-to-the-future-part-ii", pooling a sequel's dialogue
        # into this film's vocabulary and hiding real absences.
        suffix = re.compile(rf"^{re.escape(script_path.stem)}-\d+\.srt$")
        cached = sorted(p for p in cache.glob(f"{script_path.stem}-*.srt")
                        if suffix.match(p.name))
        vocabulary: Set[str] = set()
        used = []
        for path in cached:
            tokens = subtitle_vocabulary(path)
            if len(tokens) < 200:
                continue
            vocabulary |= tokens
            used.append(path.name)
        return _score(doc, lines, vocabulary, used, imdb_id, entries_found=bool(cached))

    entries = rank_entries(search_subtitles(api_key, imdb_id))
    vocabulary: Set[str] = set()
    used = []
    for position, entry in enumerate(entries):
        if len(used) >= SUBS_PER_FILM:
            break
        # Key the cache on the entry's position, not on how many succeeded:
        # otherwise one unparseable file is rewritten and re-read forever.
        target = cache / f"{script_path.stem}-{position}.srt"
        if not target.exists():
            if not download_srt(entry, target):
                continue
            time.sleep(PER_REQUEST_DELAY)
        tokens = subtitle_vocabulary(target)
        if len(tokens) < 200:
            continue
        vocabulary |= tokens
        used.append(entry.get("release_name") or "?")

    return _score(doc, lines, vocabulary, used, imdb_id, entries_found=bool(entries))


def _score(
    doc: dict,
    lines: List[dict],
    vocabulary: Set[str],
    used: List[str],
    imdb_id: str,
    entries_found: bool,
) -> dict:
    """Flag transcript lines whose words appear nowhere in the film's subtitles."""
    if not used:
        reason = "no subtitles found" if entries_found else "imdb id not recognised"
        return {"id": doc.get("id"), "error": reason, "imdbId": imdb_id}

    absent = []
    for index, line in enumerate(lines):
        words = content_words(line.get("text", ""))
        if len(words) < 3:
            continue
        present = sum(1 for w in words if w in vocabulary) / len(words)
        if present < PRESENCE_FLOOR:
            absent.append({
                "index": index,
                "character": line.get("character"),
                "present": round(present, 2),
                "words": len(words),
            })

    return {
        "id": doc.get("id"),
        "title": doc.get("title"),
        "lines": len(lines),
        "subtitleReleases": len(used),
        "absent": len(absent),
        "absentPct": round(100 * len(absent) / max(len(lines), 1), 1),
        "detail": absent,
    }


def main() -> int:
    env = load_env()
    api_key = env.get("SUBDL_API_KEY")
    if not api_key:
        print("Error: SUBDL_API_KEY not in .env", file=sys.stderr)
        return 1

    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    offline = "--offline" in sys.argv
    pattern = args[0] if args else "hp-*.json"
    scripts = sorted((get_repo_root() / "public" / "data" / "scripts").glob(pattern))
    cache = get_repo_root() / "data" / "subs" / "audit"
    cache.mkdir(parents=True, exist_ok=True)

    results = []
    print(f"{'film':34} {'lines':>6} {'subs':>5} {'absent':>7} {'pct':>6}")
    for path in scripts:
        try:
            result = audit_film(path, api_key, cache, offline=offline)
        except RateLimited as e:
            # Continuing while throttled would mark every remaining film as
            # having no subtitles, which is indistinguishable from a real
            # result in the output. Stop instead and keep what is already valid.
            print(f"\nABORTED at {path.stem}: rate limited ({e})")
            print("Cached subtitles are kept; re-run later to resume.")
            break
        except Exception as e:
            print(f"{path.stem:34} ERROR {type(e).__name__}: {e}")
            continue
        if not offline:
            time.sleep(PER_FILM_DELAY)
        if not result:
            continue
        if result.get("error"):
            print(f"{result['id']:34} {result['error']}")
            continue
        results.append(result)
        print(f"{result['id']:34} {result['lines']:6} {result['subtitleReleases']:5} "
              f"{result['absent']:7} {result['absentPct']:5}%")

    out = get_repo_root() / "data" / "evidence" / "pack-audit.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    if not results:
        # An aborted or fully-throttled run must not replace a good report with
        # an empty one -- that is how the previous run destroyed valid results.
        print("No films scored; leaving the existing report untouched.")
        return 1
    out.write_text(json.dumps(results, indent=1))

    total_lines = sum(r["lines"] for r in results)
    total_absent = sum(r["absent"] for r in results)
    print(f"\n{'TOTAL':34} {total_lines:6} {'':5} {total_absent:7} "
          f"{100 * total_absent / max(total_lines, 1):5.1f}%")
    print(f"wrote {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
