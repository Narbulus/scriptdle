"""
Jellyfin & SubDL client for the Scriptle extraction pipeline.

Provides zero-dependency stdlib helpers to:
- Query the Jellyfin movie library and summarize high-value pack opportunities
- Fetch rich film metadata (IMDb ID, year, genres, directors, overview, cast roles)
- Download the best English text subtitle track (preferring SDH SRT), with
  optional SubDL fallback when a Jellyfin release only carries image subtitles
- Stream center-channel mono audio (`center.flac`) without downloading full
  source files or re-encoding 700MB local video unless requested
"""

import io
import json
import re
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
import zipfile
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from pipeline import srt

REPO_ROOT = Path(__file__).resolve().parent.parent

# Suffixes commonly attached to actor role strings in Jellyfin/TMDB metadata.
_ROLE_SUFFIX = re.compile(
    r"\s*\((?:voice|uncredited|archive footage|older|young|cameo)\)\s*$",
    re.IGNORECASE,
)


def load_env(env_path: Optional[Path] = None) -> Dict[str, str]:
    """Load key=value pairs from .env without mutating os.environ."""
    path = env_path or (REPO_ROOT / ".env")
    env: Dict[str, str] = {}
    if not path.exists():
        return env
    for raw in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        env[key.strip()] = value.strip().strip('"').strip("'")
    return env


def slugify(name: str, year: Optional[int] = None) -> str:
    """Build a filesystem- and Scriptle-safe slug."""
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return f"{slug}-{year}" if year else slug


def canonical_role(role: str) -> str:
    """Normalize a Jellyfin/TMDB role string into a clean ALL-CAPS character name."""
    cleaned = _ROLE_SUFFIX.sub("", (role or "").strip())
    cleaned = re.sub(r"^voice\s+of\s+", "", cleaned, flags=re.IGNORECASE)
    # Strip dual-role secondary aliases like "Obi-Wan 'Ben' Kenobi / Old Ben"
    if " / " in cleaned:
        cleaned = cleaned.split(" / ", 1)[0].strip()
    # Remove quoted nicknames like Obi-Wan "Ben" Kenobi or Ben 'Obi-Wan' Kenobi
    cleaned = re.sub(r'\s*["“][^"”]+["”]\s*', " ", cleaned)
    cleaned = re.sub(r"\s*'[^']+'\s*", " ", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned.upper()


def select_best_audio_stream(
    media_source: dict,
    requested_index: Optional[int] = None,
) -> Optional[dict]:
    """Choose the best English non-commentary audio stream (preferring surround for center-channel dialogue)."""
    audio_streams = [
        s for s in (media_source.get("MediaStreams") or [])
        if s.get("Type") == "Audio"
    ]
    if not audio_streams:
        return None
    if requested_index is not None:
        return next((s for s in audio_streams if s.get("Index") == requested_index), None)

    def is_commentary(stream: dict) -> bool:
        title = (stream.get("DisplayTitle") or stream.get("Title") or "").lower()
        return any(k in title for k in ("commentary", "description", "descriptive", "isolated score"))

    eng = [
        s for s in audio_streams
        if (s.get("Language") or "").lower() in ("eng", "en")
    ]
    pool = eng or [s for s in audio_streams if not (s.get("Language") or "").strip()] or audio_streams
    non_comm = [s for s in pool if not is_commentary(s)] or pool

    # Prefer 6ch/8ch surround (clean center channel), then default, then stream order
    def rank(stream: dict) -> tuple:
        ch = int(stream.get("Channels") or 0)
        has_center = 1 if ch >= 3 else 0
        is_def = 1 if stream.get("IsDefault") else 0
        return (has_center, ch, is_def, -int(stream.get("Index") or 0))

    return max(non_comm, key=rank)


def select_best_subtitle(
    media_source: dict,
    prefer_sdh: bool = True,
    requested_index: Optional[int] = None,
) -> Optional[dict]:
    """Choose the best English dialogue text subtitle stream from a Jellyfin media source.

    Returns None if only non-English, commentary, or signs/forced tracks exist,
    so callers cleanly fall back to SubDL instead of pulling Hebrew/Arabic/signs tracks.
    """
    text_subs = [
        s for s in (media_source.get("MediaStreams") or [])
        if s.get("Type") == "Subtitle" and s.get("IsTextSubtitleStream")
    ]
    if requested_index is not None:
        return next((s for s in text_subs if s.get("Index") == requested_index), None)

    eng_subs = [
        s for s in text_subs
        if (s.get("Language") or "").lower() in ("eng", "en", "")
    ]
    if not eng_subs:
        return None

    def is_sdh(stream: dict) -> bool:
        title = (stream.get("DisplayTitle") or stream.get("Title") or "").lower()
        return bool(stream.get("IsHearingImpaired")) or "sdh" in title or "cc" in title

    def is_non_dialogue(stream: dict) -> bool:
        title = (stream.get("DisplayTitle") or stream.get("Title") or "").lower()
        return (
            bool(stream.get("IsForced"))
            or any(k in title for k in ("commentary", "forced", "signs", "songs"))
        )

    dialogue = [s for s in eng_subs if not is_non_dialogue(s)]
    if not dialogue:
        return None

    if prefer_sdh:
        sdh_streams = [s for s in dialogue if is_sdh(s)]
        if sdh_streams:
            return sdh_streams[0]
    default_stream = next((s for s in dialogue if s.get("IsDefault")), None)
    return default_stream or dialogue[0]


def extract_movie_metadata(item: dict) -> dict:
    """Convert a raw Jellyfin movie item into a normalized pipeline metadata dict."""
    media_sources = item.get("MediaSources") or []
    media_source = media_sources[0] if media_sources else {}
    streams = media_source.get("MediaStreams") or []

    cast = []
    seen_roles = set()
    for person in item.get("People") or []:
        if person.get("Type") != "Actor":
            continue
        role = (person.get("Role") or "").strip()
        actor = (person.get("Name") or "").strip()
        if not role:
            continue
        canon = canonical_role(role)
        if not canon or canon in seen_roles:
            continue
        seen_roles.add(canon)
        cast.append({"actor": actor, "role": role, "canonical": canon})

    directors = [
        p.get("Name") for p in (item.get("People") or [])
        if p.get("Type") == "Director" and p.get("Name")
    ]
    runtime_min = round((item.get("RunTimeTicks") or 0) / 1e7 / 60)
    year = item.get("ProductionYear")
    name = item.get("Name") or ""

    sub_streams = [
        {
            "index": s.get("Index"),
            "codec": s.get("Codec"),
            "lang": s.get("Language"),
            "title": s.get("DisplayTitle") or s.get("Title"),
            "isText": bool(s.get("IsTextSubtitleStream")),
            "isDefault": bool(s.get("IsDefault")),
            "isSdh": bool(s.get("IsHearingImpaired")) or "sdh" in (
                (s.get("DisplayTitle") or s.get("Title") or "").lower()
            ),
        }
        for s in streams
        if s.get("Type") == "Subtitle"
        and (s.get("Language") or "").lower() in ("eng", "en", "")
    ]
    audio_streams = [
        {
            "index": s.get("Index"),
            "codec": s.get("Codec"),
            "channels": s.get("Channels"),
            "lang": s.get("Language"),
            "title": s.get("DisplayTitle"),
        }
        for s in streams
        if s.get("Type") == "Audio"
    ][:4]

    return {
        "jellyfinId": item.get("Id"),
        "mediaSourceId": media_source.get("Id") or item.get("Id"),
        "slug": slugify(name, year),
        "title": name,
        "year": year,
        "imdbId": (item.get("ProviderIds") or {}).get("Imdb"),
        "tmdbId": (item.get("ProviderIds") or {}).get("Tmdb"),
        "rated": item.get("OfficialRating") or "",
        "runtime": f"{runtime_min} min" if runtime_min else "",
        "runtimeMin": runtime_min,
        "genre": ", ".join(item.get("Genres") or []),
        "director": ", ".join(directors),
        "overview": item.get("Overview") or "",
        "cast": cast[:35],
        "subtitleStreams": sub_streams,
        "audioStreams": audio_streams,
    }


class JellyfinClient:
    """Minimal stdlib Jellyfin REST client for read-only inventory & media pulls."""

    def __init__(self, base_url: str, token: str, user_id: str):
        self.base_url = base_url.rstrip("/")
        self.token = token
        self.user_id = user_id
        self.device_id = f"scriptle-{uuid.uuid4().hex[:12]}"

    @classmethod
    def from_env(cls, env_path: Optional[Path] = None) -> "JellyfinClient":
        env = load_env(env_path)
        missing = [k for k in ("JELLYFIN_URL", "JELLYFIN_TOKEN", "JELLYFIN_USER_ID") if not env.get(k)]
        if missing:
            raise RuntimeError(f"Missing {', '.join(missing)} in .env (run scripts/jellyfin-auth.py)")
        return cls(env["JELLYFIN_URL"], env["JELLYFIN_TOKEN"], env["JELLYFIN_USER_ID"])

    def _open(self, path: str, timeout: int = 60, method: str = "GET"):
        req = urllib.request.Request(f"{self.base_url}{path}", method=method)
        req.add_header("Authorization", f'MediaBrowser Token="{self.token}"')
        return urllib.request.urlopen(req, timeout=timeout)

    def get_json(self, path: str, timeout: int = 60) -> dict:
        with self._open(path, timeout=timeout) as resp:
            return json.loads(resp.read())

    def list_movies(self, page_size: int = 200) -> List[dict]:
        """List all movies on the Jellyfin server using lightweight pagination."""
        movies: List[dict] = []
        start = 0
        while True:
            q = urllib.parse.urlencode({
                "IncludeItemTypes": "Movie",
                "Recursive": "true",
                "Fields": "ProductionYear,Genres,ProviderIds,RunTimeTicks,Studios,OfficialRating",
                "SortBy": "SortName",
                "SortOrder": "Ascending",
                "StartIndex": start,
                "Limit": page_size,
            })
            data = self.get_json(f"/Users/{self.user_id}/Items?{q}", timeout=60)
            batch = data.get("Items", [])
            total = data.get("TotalRecordCount", 0)
            movies.extend(batch)
            if not batch or len(movies) >= total:
                break
            start += page_size
        return movies

    def search_movies(self, term: str, limit: int = 10) -> List[dict]:
        q = urllib.parse.urlencode({
            "searchTerm": term,
            "IncludeItemTypes": "Movie",
            "Recursive": "true",
            "Fields": "ProductionYear,ProviderIds",
            "Limit": str(limit),
        })
        return self.get_json(f"/Users/{self.user_id}/Items?{q}").get("Items", [])

    def get_movie(self, item_id: str) -> dict:
        fields = "People,Overview,MediaSources,ProviderIds,Genres,OfficialRating,RunTimeTicks"
        return self.get_json(f"/Users/{self.user_id}/Items/{item_id}?Fields={fields}")

    def stop_encoding(self, play_session_id: str) -> None:
        q = urllib.parse.urlencode({
            "deviceId": self.device_id,
            "playSessionId": play_session_id,
        })
        try:
            with self._open(f"/Videos/ActiveEncodings?{q}", timeout=30, method="DELETE"):
                pass
        except (urllib.error.URLError, TimeoutError):
            pass

    def download_subtitle(
        self,
        item_id: str,
        media_source_id: str,
        stream_index: int,
        out_path: Path,
        attempts: int = 6,
        backoff_seconds: int = 45,
    ) -> int:
        """Download an embedded text subtitle stream as SRT, retrying 504 proxy timeouts."""
        out_path.parent.mkdir(parents=True, exist_ok=True)
        tmp_path = out_path.with_suffix(out_path.suffix + ".partial")
        path = f"/Videos/{item_id}/{media_source_id}/Subtitles/{stream_index}/0/Stream.srt"

        for attempt in range(1, attempts + 1):
            try:
                written = 0
                with self._open(path, timeout=600) as resp:
                    with open(tmp_path, "wb") as f:
                        while chunk := resp.read(1 << 20):
                            f.write(chunk)
                            written += len(chunk)
                tmp_path.replace(out_path)
                return written
            except urllib.error.HTTPError as err:
                if err.code not in (429, 500, 502, 503, 504):
                    raise RuntimeError(f"Subtitle HTTP {err.code}: {err.reason}") from err
            except (urllib.error.URLError, TimeoutError):
                pass
            finally:
                if tmp_path.exists():
                    tmp_path.unlink()
            if attempt < attempts:
                time.sleep(backoff_seconds)
        raise RuntimeError("Jellyfin subtitle extraction timed out after retries")

    def _audio_stream_query(
        self,
        play_session_id: str,
        media_source_id: str,
        audio_stream_index: Optional[int] = None,
    ) -> str:
        params = {
            "AudioCodec": "aac",
            "AudioBitRate": "320000",
            "MaxAudioChannels": "6",
            "Static": "false",
            "PlaySessionId": play_session_id,
            "DeviceId": self.device_id,
            "MediaSourceId": media_source_id,
        }
        if audio_stream_index is not None:
            params["AudioStreamIndex"] = str(audio_stream_index)
        return urllib.parse.urlencode(params)

    def probe_audio_channels(
        self,
        item_id: str,
        media_source_id: str,
        audio_stream_index: Optional[int] = None,
    ) -> int:
        play_session_id = uuid.uuid4().hex
        q = self._audio_stream_query(
            play_session_id, media_source_id, audio_stream_index=audio_stream_index
        )
        sample = b""
        try:
            with self._open(f"/Audio/{item_id}/stream.aac?{q}", timeout=60) as resp:
                while len(sample) < (256 << 10):
                    chunk = resp.read(1 << 16)
                    if not chunk:
                        break
                    sample += chunk
        except (urllib.error.URLError, TimeoutError, urllib.error.HTTPError):
            return 0
        finally:
            self.stop_encoding(play_session_id)

        probe = subprocess.run(
            ["ffprobe", "-v", "error", "-select_streams", "a:0",
             "-show_entries", "stream=channels", "-of", "csv=p=0", "-"],
            input=sample, capture_output=True,
        )
        counts = [c.strip() for c in probe.stdout.decode().splitlines() if c.strip()]
        return int(counts[0]) if counts else 0

    def pull_center_audio(
        self,
        item_id: str,
        media_source_id: str,
        out_path: Path,
        channels: Optional[int] = None,
        audio_stream_index: Optional[int] = None,
    ) -> Path:
        """Stream 5.1/stereo audio-only AAC from Jellyfin (zero video transcoding, ~24x realtime)
        and write 16kHz mono center-channel MP3/FLAC.
        """
        out_path.parent.mkdir(parents=True, exist_ok=True)
        if channels is None:
            channels = self.probe_audio_channels(
                item_id, media_source_id, audio_stream_index=audio_stream_index
            ) or 2
        pan = "pan=mono|c0=FC" if channels >= 3 else "pan=mono|c0=0.5*FL+0.5*FR"

        play_session_id = uuid.uuid4().hex
        q = self._audio_stream_query(
            play_session_id, media_source_id, audio_stream_index=audio_stream_index
        )
        is_mp3 = out_path.suffix.lower() == ".mp3"
        tmp_path = out_path.with_suffix(".partial.mp3" if is_mp3 else ".partial.flac")
        codec_args = ["-c:a", "libmp3lame", "-b:a", "24k"] if is_mp3 else ["-sample_fmt", "s16", "-c:a", "flac"]
        proc = subprocess.Popen(
            [
                "ffmpeg", "-y", "-v", "error",
                "-i", "pipe:0",
                "-vn", "-af", pan,
                "-ar", "16000", "-ac", "1",
                *codec_args, str(tmp_path),
            ],
            stdin=subprocess.PIPE, stderr=subprocess.PIPE,
        )
        failed = False
        try:
            with self._open(f"/Audio/{item_id}/stream.aac?{q}", timeout=300) as resp:
                while chunk := resp.read(1 << 20):
                    proc.stdin.write(chunk)
        except (urllib.error.URLError, TimeoutError, urllib.error.HTTPError, BrokenPipeError) as exc:
            failed = True
            raise RuntimeError(f"Audio stream transfer failed: {exc}") from exc
        finally:
            self.stop_encoding(play_session_id)
            try:
                proc.stdin.close()
            except BrokenPipeError:
                pass
            stderr = proc.stderr.read().decode(errors="replace")
            rc = proc.wait()
            if rc != 0 and not failed:
                if tmp_path.exists():
                    tmp_path.unlink()
                raise RuntimeError(f"ffmpeg failed ({rc}): {stderr[-800:]}")

        tmp_path.replace(out_path)
        return out_path


def _subdl_query(params: dict, retries: int = 3) -> dict:
    """Call SubDL API with gentle 429 retry/backoff."""
    q = urllib.parse.urlencode(params)
    url = f"https://api.subdl.com/api/v1/subtitles?{q}"
    for attempt in range(1, retries + 1):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "ScriptlePipeline/2.0"})
            with urllib.request.urlopen(req, timeout=30) as resp:
                return json.loads(resp.read())
        except urllib.error.HTTPError as err:
            err.close()
            if err.code == 429 and attempt < retries:
                time.sleep(15.0 * attempt)
                continue
            raise
    return {}


def fetch_subdl_subtitle(
    imdb_id: str,
    out_path: Path,
    api_key: str,
    prefer_sdh: bool = True,
) -> Optional[Path]:
    """Fallback: download an English SRT from SubDL when Jellyfin has only PGS subs."""
    if not imdb_id or not api_key:
        return None
    try:
        data = _subdl_query({
            "api_key": api_key,
            "imdb_id": imdb_id,
            "languages": "EN",
            "type": "movie",
            "subs_per_page": "15",
        })
    except urllib.error.HTTPError as err:
        print(f"  [WARN] SubDL HTTP {err.code} for {imdb_id}", flush=True)
        return None

    subs = data.get("subtitles") or []
    if not subs:
        return None

    def score_sub(item: dict) -> Tuple[int, int]:
        name = (item.get("release_name") or item.get("name") or "").lower()
        hi = 1 if (item.get("hi") or "sdh" in name) else 0
        bluray = 1 if any(k in name for k in ("bluray", "remux", "bdrip", "web")) else 0
        return (hi if prefer_sdh else (1 - hi), bluray)

    subs.sort(key=score_sub, reverse=True)
    for sub in subs[:5]:
        dl_url = sub.get("url")
        if not dl_url:
            continue
        full_url = dl_url if dl_url.startswith("http") else f"https://dl.subdl.com{dl_url}"
        try:
            dl_req = urllib.request.Request(full_url, headers={"User-Agent": "ScriptlePipeline/2.0"})
            with urllib.request.urlopen(dl_req, timeout=45) as resp:
                archive_bytes = resp.read()
            with zipfile.ZipFile(io.BytesIO(archive_bytes)) as zf:
                srt_names = [n for n in zf.namelist() if n.lower().endswith(".srt")]
                if not srt_names:
                    continue
                raw = zf.read(srt_names[0])
                out_path.parent.mkdir(parents=True, exist_ok=True)
                out_path.write_bytes(raw)
                if len(srt.load_dialogue(out_path)) >= 50:
                    return out_path
        except Exception:
            continue
    return None


def fetch_subdl_tv_season(
    imdb_id: str,
    season_number: int,
    out_dir: Path,
    api_key: str,
    prefer_sdh: bool = True,
) -> Dict[int, Path]:
    """Download a full-season English SRT zip (or per-episode SRTs) from SubDL for a TV season.

    Returns {episode_number: Path} for every unpacked episode SRT in out_dir.
    """
    if not imdb_id or not api_key:
        return {}
    try:
        data = _subdl_query({
            "api_key": api_key,
            "imdb_id": imdb_id,
            "languages": "EN",
            "type": "tv",
            "season_number": str(season_number),
            "full_season": "1",
            "subs_per_page": "15",
        })
    except urllib.error.HTTPError as err:
        print(f"  [WARN] SubDL TV HTTP {err.code} for {imdb_id} S{season_number:02d}", flush=True)
        return {}

    subs = data.get("subtitles") or []
    if not subs:
        return {}

    def score_sub(item: dict) -> Tuple[int, int, int]:
        name = (item.get("release_name") or item.get("name") or "").lower()
        full = 1 if item.get("full_season") else 0
        hi = 1 if (item.get("hi") or "sdh" in name) else 0
        bluray = 1 if any(k in name for k in ("bluray", "remux", "bdrip", "web")) else 0
        return (full, hi if prefer_sdh else (1 - hi), bluray)

    subs.sort(key=score_sub, reverse=True)
    ep_re = re.compile(rf"(?:S0?{season_number}E(\d{{1,2}})|{season_number}x(\d{{1,2}}))", re.IGNORECASE)
    found: Dict[int, Path] = {}

    for sub in subs[:6]:
        dl_url = sub.get("url")
        if not dl_url:
            continue
        full_url = dl_url if dl_url.startswith("http") else f"https://dl.subdl.com{dl_url}"
        try:
            dl_req = urllib.request.Request(full_url, headers={"User-Agent": "ScriptlePipeline/2.0"})
            with urllib.request.urlopen(dl_req, timeout=60) as resp:
                archive_bytes = resp.read()
            with zipfile.ZipFile(io.BytesIO(archive_bytes)) as zf:
                for member in zf.namelist():
                    if not member.lower().endswith(".srt") or "__MACOSX" in member:
                        continue
                    m = ep_re.search(member)
                    if not m:
                        continue
                    ep_num = int(m.group(1) or m.group(2))
                    if ep_num in found:
                        continue
                    dest = out_dir / f"s{season_number:02d}e{ep_num:02d}.srt"
                    dest.parent.mkdir(parents=True, exist_ok=True)
                    dest.write_bytes(zf.read(member))
                    if len(srt.load_dialogue(dest)) >= 30:
                        found[ep_num] = dest
                    else:
                        dest.unlink(missing_ok=True)
            if len(found) >= 4:
                return found
        except Exception:
            continue
    return found
