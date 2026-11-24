"""Shared helpers for selecting and downloading Jellyfin subtitle streams."""

import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Dict, Optional

MAX_ATTEMPTS = 8
BACKOFF_SECONDS = 90


def select_subtitle_stream(
    media_source: dict, requested_index: Optional[int] = None
) -> Optional[dict]:
    """Select a text subtitle stream from one Jellyfin media source.

    ``IsDefault`` is Jellyfin's own default-track choice.  We only accept text
    subtitles because the pipeline consumes SRT; image tracks such as PGS/SUP
    cannot be converted to dialogue text without OCR.  If the default is an
    image track, fall back to the first text track from the same release.
    """
    subtitles = [
        stream
        for stream in media_source.get("MediaStreams", [])
        if stream.get("Type") == "Subtitle" and stream.get("IsTextSubtitleStream")
    ]
    if requested_index is not None:
        return next((stream for stream in subtitles if stream.get("Index") == requested_index), None)

    return next(
        (stream for stream in subtitles if stream.get("IsDefault")),
        subtitles[0] if subtitles else None,
    )


def subtitle_label(stream: dict) -> str:
    """Return a compact description suitable for command-line status output."""
    language = stream.get("Language") or "und"
    title = stream.get("DisplayTitle") or stream.get("Title")
    return f"{language} ({title})" if title else language


def subtitle_endpoint(base_url: str, item_id: str, media_source_id: str, index: int) -> str:
    """Build Jellyfin's SRT subtitle-stream endpoint for one media source."""
    return (
        f"{base_url.rstrip('/')}/Videos/{item_id}/{media_source_id}"
        f"/Subtitles/{index}/0/Stream.srt"
    )


def fetch_subtitle(
    endpoint: str,
    token: str,
    out_path: Path,
    attempts: int = MAX_ATTEMPTS,
    backoff_seconds: int = BACKOFF_SECONDS,
) -> int:
    """Download a Jellyfin subtitle rendition, retrying slow server extraction.

    Embedded subtitle extraction can outlast a reverse proxy timeout.  Jellyfin
    continues extracting in the background and caches the result, so a retry
    normally succeeds without downloading a different subtitle release.
    """
    out_path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = out_path.with_suffix(out_path.suffix + ".partial")

    for attempt in range(1, attempts + 1):
        started = time.time()
        try:
            request = urllib.request.Request(endpoint)
            request.add_header("Authorization", f'MediaBrowser Token="{token}"')
            written = 0
            with urllib.request.urlopen(request, timeout=900) as response:
                with open(tmp_path, "wb") as subtitle_file:
                    while chunk := response.read(1 << 20):
                        subtitle_file.write(chunk)
                        written += len(chunk)
            tmp_path.replace(out_path)
            print(f"  subtitles: {written / 1e6:.1f} MB -> {out_path.name} (attempt {attempt})")
            return written
        except urllib.error.HTTPError as error:
            reason = f"HTTP {error.code}"
            if error.code not in (429, 500, 502, 503, 504):
                raise RuntimeError(f"{reason} {error.reason}") from error
        except (urllib.error.URLError, TimeoutError) as error:
            reason = type(error).__name__
        finally:
            if tmp_path.exists():
                tmp_path.unlink()

        elapsed = time.time() - started
        print(f"  subtitle attempt {attempt}: {reason} after {elapsed:.0f}s; retrying extraction")
        if attempt < attempts:
            time.sleep(backoff_seconds)

    raise RuntimeError("subtitle extraction did not complete in time")
