#!/usr/bin/env python3
"""
Jellyfin Pull - Stream a film from Jellyfin as a small local working artifact.

Asks Jellyfin to transcode server-side to low-resolution video plus multichannel
audio, then streams that down. The full-size source file is never transferred or
stored locally. The local MP4 is re-encoded with one-second keyframes so the
review tool can seek to arbitrary dialogue without waiting for the next source
keyframe to arrive.

Multichannel audio is requested deliberately: in a 5.1/7.1 mix dialogue sits
almost entirely in the center channel, so extracting it locally gives ASR and
diarization a signal without score or effects mixed in.

Produces, under data/media/<slug>/:
    video.mp4    low-res video for frame grabs and review scrubbing
    center.flac  16kHz mono center-channel audio for ASR/diarization
    subtitles.srt Jellyfin's default text subtitle track for this exact release

Usage:
    python scripts/jellyfin-pull.py --search "Chamber of Secrets"
    python scripts/jellyfin-pull.py --item-id <id> --height 480
    python scripts/jellyfin-pull.py --search "Chamber of Secrets" --subtitle-index 7
"""

import argparse
import json
import re
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path
from typing import Dict, Optional

from jellyfin_subtitles import (
    fetch_subtitle,
    select_subtitle_stream,
    subtitle_endpoint,
    subtitle_label,
)

CLIENT_NAME = "Scriptdle"


def get_repo_root() -> Path:
    """Get the scriptdle repository root directory."""
    return Path(__file__).parent.parent


def load_env() -> Dict[str, str]:
    """Load environment variables from .env file."""
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


class Jellyfin:
    def __init__(self, base_url: str, token: str, user_id: str):
        self.base_url = base_url.rstrip("/")
        self.token = token
        self.user_id = user_id
        self.device_id = f"scriptdle-{uuid.uuid4().hex[:12]}"

    def _open(self, path: str, timeout: int = 60):
        request = urllib.request.Request(f"{self.base_url}{path}")
        request.add_header("Authorization", f'MediaBrowser Token="{self.token}"')
        return urllib.request.urlopen(request, timeout=timeout)

    def get(self, path: str) -> dict:
        with self._open(path) as response:
            return json.loads(response.read())

    def find_movie(self, term: str) -> Optional[dict]:
        """Find a single movie by search term, reporting ambiguity."""
        query = urllib.parse.urlencode({
            "searchTerm": term,
            "IncludeItemTypes": "Movie",
            "Recursive": "true",
            "Limit": "10",
        })
        items = self.get(f"/Users/{self.user_id}/Items?{query}").get("Items", [])
        if not items:
            print(f"No movie matched {term!r}", file=sys.stderr)
            return None
        if len(items) > 1:
            print(f"{len(items)} matches for {term!r}:")
            for item in items:
                print(f"  {item['Name']} ({item.get('ProductionYear')})  id={item['Id']}")
            print("\nNarrow the search or pass --item-id", file=sys.stderr)
            return None
        return items[0]

    def stop_encoding(self, play_session_id: str) -> None:
        """Release the server-side transcode session so it stops early."""
        query = urllib.parse.urlencode({
            "deviceId": self.device_id,
            "playSessionId": play_session_id,
        })
        try:
            request = urllib.request.Request(
                f"{self.base_url}/Videos/ActiveEncodings?{query}", method="DELETE"
            )
            request.add_header("Authorization", f'MediaBrowser Token="{self.token}"')
            urllib.request.urlopen(request, timeout=30).close()
        except (urllib.error.URLError, TimeoutError):
            pass

    def _stream_query(self, height: int, play_session_id: str, media_source_id: str) -> str:
        return urllib.parse.urlencode({
            "VideoCodec": "h264",
            "AudioCodec": "aac",
            "MaxHeight": str(height),
            "VideoBitrate": "600000",
            "AudioBitrate": "320000",
            "MaxAudioChannels": "6",
            "TranscodingContainer": "ts",
            "Static": "false",
            "PlaySessionId": play_session_id,
            "DeviceId": self.device_id,
            "MediaSourceId": media_source_id,
        })

    def probe_channels(self, item_id: str, height: int, media_source_id: str) -> int:
        """Read a few seconds of the transcode to learn the real channel layout.

        The pan filter must be chosen before streaming starts, and asking for 6
        channels does not guarantee getting them -- the server may downmix. A
        short probe costs one extra request and avoids discovering a wrong
        filter after a 17-minute transfer.
        """
        play_session_id = uuid.uuid4().hex
        query = self._stream_query(height, play_session_id, media_source_id)
        sample = b""
        try:
            with self._open(f"/Videos/{item_id}/stream.ts?{query}", timeout=120) as response:
                while len(sample) < (1 << 21):
                    chunk = response.read(1 << 16)
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

    def stream_transcode(
        self,
        item_id: str,
        out_dir: Path,
        height: int,
        channels: int,
        media_source_id: str,
        audio_only: bool = False,
    ) -> bool:
        """Pipe the download straight through ffmpeg, writing working artifacts.

        Transcoding happens during the transfer rather than after it, so no
        multi-gigabyte intermediate is ever written and the artifacts are ready
        when the download ends. Pass ``audio_only=True`` to write only 16kHz
        mono ``center.flac`` and skip local video re-encoding (~4-6x faster).
        """
        pan = "pan=mono|c0=FC" if channels >= 3 else "pan=mono|c0=0.5*FL+0.5*FR"
        print(f"  audio has {channels} channels; using {pan}{' (audio-only)' if audio_only else ''}")

        audio_path = out_dir / "center.flac"
        video_path = out_dir / "video.mp4"
        play_session_id = uuid.uuid4().hex
        query = self._stream_query(height, play_session_id, media_source_id)

        ffmpeg_cmd = [
            "ffmpeg", "-y", "-v", "error",
            "-analyzeduration", "20M", "-probesize", "20M",
            "-i", "pipe:0",
            # s16 is forced because decoding AAC yields float, and ffmpeg would
            # otherwise write 24-bit FLAC: triple the data and encode time to
            # store precision a lossy source never had.
            "-map", "0:a:0", "-vn", "-af", pan, "-ar", "16000", "-ac", "1",
            "-sample_fmt", "s16", "-c:a", "flac", str(audio_path),
        ]
        if not audio_only:
            ffmpeg_cmd.extend([
                "-map", "0:v:0", "-map", "0:a:0",
                "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
                "-g", "24", "-keyint_min", "24", "-sc_threshold", "0",
                "-pix_fmt", "yuv420p",
                "-c:a", "aac", "-b:a", "128k", "-ac", "2",
                "-movflags", "+faststart", str(video_path),
            ])

        proc = subprocess.Popen(
            ffmpeg_cmd,
            stdin=subprocess.PIPE, stderr=subprocess.PIPE,
        )

        started = time.time()
        written = 0
        failed = False
        try:
            with self._open(f"/Videos/{item_id}/stream.ts?{query}", timeout=300) as response:
                last_report = 0.0
                while True:
                    chunk = response.read(1 << 20)
                    if not chunk:
                        break
                    proc.stdin.write(chunk)
                    written += len(chunk)
                    elapsed = time.time() - started
                    if elapsed - last_report >= 30:
                        print(f"  {written / 1e6:7.0f} MB  "
                              f"{written / 1e6 / elapsed:.2f} MB/s  {elapsed / 60:.1f} min")
                        last_report = elapsed
        except (urllib.error.URLError, TimeoutError, urllib.error.HTTPError, BrokenPipeError) as e:
            print(f"\nTransfer failed after {written / 1e6:.0f} MB: {e}", file=sys.stderr)
            failed = True
        finally:
            self.stop_encoding(play_session_id)
            try:
                proc.stdin.close()
            except BrokenPipeError:
                pass
            stderr = proc.stderr.read().decode(errors="replace")
            if proc.wait() != 0:
                print(stderr[-1500:], file=sys.stderr)
                failed = True

        if failed:
            return False
        print(f"  done: {written / 1e6:.0f} MB in {(time.time() - started) / 60:.1f} min")
        return True


def slugify(name: str, year: Optional[int]) -> str:
    """Build a filesystem-safe slug matching the repo's script-id style."""
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return f"{slug}-{year}" if year else slug


def main() -> int:
    parser = argparse.ArgumentParser(description="Pull a downsampled film from Jellyfin")
    parser.add_argument("--search", help="Movie title to search for")
    parser.add_argument("--item-id", help="Jellyfin item id (skips search)")
    parser.add_argument("--height", type=int, default=360, help="Max video height")
    parser.add_argument(
        "--audio-only", action="store_true",
        help="Write only 16kHz mono center.flac and subtitles (skip local video encode)",
    )
    parser.add_argument(
        "--no-subtitles", action="store_true", help="Skip downloading a Jellyfin text subtitle track"
    )
    parser.add_argument(
        "--subtitle-index", type=int,
        help="Use this Jellyfin text subtitle stream index instead of its default track",
    )
    args = parser.parse_args()

    if not args.search and not args.item_id:
        parser.error("pass --search or --item-id")

    env = load_env()
    if not all(env.get(k) for k in ("JELLYFIN_URL", "JELLYFIN_TOKEN", "JELLYFIN_USER_ID")):
        print("Error: run scripts/jellyfin-auth.py first", file=sys.stderr)
        return 1

    client = Jellyfin(env["JELLYFIN_URL"], env["JELLYFIN_TOKEN"], env["JELLYFIN_USER_ID"])

    if args.item_id:
        item = client.get(f"/Users/{client.user_id}/Items/{args.item_id}?Fields=MediaSources")
    else:
        item = client.find_movie(args.search)
        if not item:
            return 1

    # Search results omit media streams, so reload the selected movie with the
    # source metadata that identifies the release we will stream.
    if not item.get("MediaSources"):
        item = client.get(f"/Users/{client.user_id}/Items/{item['Id']}?Fields=MediaSources")
    media_sources = item.get("MediaSources") or []
    if not media_sources:
        print("Jellyfin did not provide media-source metadata", file=sys.stderr)
        return 1
    media_source = media_sources[0]
    media_source_id = media_source.get("Id") or item["Id"]

    runtime_s = (item.get("RunTimeTicks") or 0) / 1e7
    slug = slugify(item["Name"], item.get("ProductionYear"))
    out_dir = get_repo_root() / "data" / "media" / slug
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"{item['Name']} ({item.get('ProductionYear')})  {runtime_s / 60:.0f} min")
    print(f"  -> {out_dir}")
    print(f"Requesting {args.height}p transcode from server...")

    print("Probing audio layout...")
    channels = client.probe_channels(item["Id"], args.height, media_source_id)
    if not channels:
        print("Could not determine channel layout", file=sys.stderr)
        return 1

    if not client.stream_transcode(
        item["Id"], out_dir, args.height, channels, media_source_id, audio_only=args.audio_only
    ):
        return 1

    if not args.no_subtitles:
        subtitle = select_subtitle_stream(media_source, args.subtitle_index)
        if not subtitle:
            requested = f" index {args.subtitle_index}" if args.subtitle_index is not None else ""
            print(f"No compatible text subtitle stream{requested} was available", file=sys.stderr)
            return 1
        else:
            print(f"Downloading Jellyfin subtitle stream {subtitle['Index']} ({subtitle_label(subtitle)})...")
            endpoint = subtitle_endpoint(
                client.base_url, item["Id"], media_source_id, subtitle["Index"]
            )
            try:
                fetch_subtitle(endpoint, client.token, out_dir / "subtitles.srt")
            except RuntimeError as error:
                print(f"Could not download subtitles: {error}", file=sys.stderr)
                return 1

    for f in sorted(out_dir.iterdir()):
        print(f"  {f.name:14} {f.stat().st_size / 1e6:8.1f} MB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
