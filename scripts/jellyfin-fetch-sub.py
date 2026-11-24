#!/usr/bin/env python3
"""
Fetch a subtitle stream from Jellyfin, retrying past proxy timeouts.

Jellyfin extracts subtitle tracks on demand, which requires a full scan of the
source file. On large remuxes that scan outlasts the reverse proxy's timeout and
returns 504 even though extraction continues server-side and is cached when it
finishes. This retries with backoff so a later attempt hits the cache.

Usage:
    python scripts/jellyfin-fetch-sub.py <item-id> <stream-index> <output-path>
    python scripts/jellyfin-fetch-sub.py <item-id> <stream-index> <output-path> --media-source-id <id>
"""

import argparse
import sys
from pathlib import Path
from typing import Dict

from jellyfin_subtitles import fetch_subtitle, subtitle_endpoint


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


def main() -> int:
    parser = argparse.ArgumentParser(description="Download a Jellyfin subtitle stream as SRT")
    parser.add_argument("item_id")
    parser.add_argument("stream_index", type=int)
    parser.add_argument("output_path", type=Path)
    parser.add_argument("--media-source-id", help="Media source containing the subtitle (defaults to item id)")
    args = parser.parse_args()

    env = load_env()
    base_url, token = env.get("JELLYFIN_URL"), env.get("JELLYFIN_TOKEN")
    if not base_url or not token:
        print("Error: run scripts/jellyfin-auth.py first", file=sys.stderr)
        return 1

    endpoint = subtitle_endpoint(
        base_url, args.item_id, args.media_source_id or args.item_id, args.stream_index
    )
    try:
        fetch_subtitle(endpoint, token, args.output_path)
    except RuntimeError as error:
        print(f"Could not download subtitles: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
