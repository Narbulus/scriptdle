#!/usr/bin/env python3
"""
Add IMDB IDs to movie JSON files from a mapping
"""

import json
from pathlib import Path

# IMDB ID mappings from web search
IMDB_IDS = {
    "big-hero-6": "tt2245084",
    "cars-2": "tt1216475",
    "coco": "tt2380307",
    "encanto": "tt2953050",
    "finding-nemo": "tt0266543",
    "frozen-2": "tt4520988",
    "hp-chamber-of-secrets": "tt0295297",
    "hp-deathly-hallows-1": "tt0926084",
    "hp-deathly-hallows-2": "tt1201607",
    "hp-goblet-of-fire": "tt0330373",
    "hp-half-blood-prince": "tt0417741",
    "hp-order-of-phoenix": "tt0373889",
    "hp-prisoner-of-azkaban": "tt0304141",
    "hp-sorcerers-stone": "tt0241527",
    "incredibles-1": "tt0317705",
    "incredibles-2": "tt3606756",
    "monsters-inc": "tt0198781",
    "monsters-university": "tt1453405",
    "ralph-breaks-the-internet": "tt5848272",
    "ratatouille": "tt0382932",
    "shrek-1": "tt0126029",
    "shrek-2": "tt0298148",
    "shrek-3": "tt0413267",
    "shrek-4": "tt0892791",
    "star-wars-episode-i-the-phantom-menace": "tt0120915",
    "star-wars-episode-ii-attack-of-the-clones": "tt0121765",
    "star-wars-episode-iii-revenge-of-the-sith": "tt0121766",
    "star-wars-episode-iv-a-new-hope": "tt0076759",
    "star-wars-episode-ix-the-rise-of-skywalker": "tt2527338",
    "star-wars-episode-vii-the-force-awakens": "tt2488496",
    "star-wars-episode-viii-the-last-jedi": "tt2527336",
    "tangled": "tt0398286",
    "the-lord-of-the-rings-fotr": "tt0120737",
    "the-lord-of-the-rings-rotk": "tt0167260",
    "the-lord-of-the-rings-ttt": "tt0167261",
    "toy-story-2": "tt0120363",
    "toy-story-3": "tt0435761",
    "toy-story-4": "tt1979376",
    "toy-story": "tt0114709",
    "wreck-it-ralph": "tt1772341",
    "zootopia": "tt2948356"
}


def get_repo_root() -> Path:
    """Get the scriptdle repository root directory."""
    return Path(__file__).parent.parent


def load_json(file_path: Path) -> dict:
    """Load JSON from a file."""
    with open(file_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def save_json(data: dict, file_path: Path) -> None:
    """Save JSON to a file with pretty formatting."""
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write('\n')


def main():
    scripts_dir = get_repo_root() / "public" / "data" / "scripts"

    updated = 0
    skipped = 0

    for movie_id, imdb_id in IMDB_IDS.items():
        script_file = scripts_dir / f"{movie_id}.json"

        if not script_file.exists():
            print(f"✗ {movie_id}: File not found")
            continue

        data = load_json(script_file)

        if data.get('imdbId'):
            print(f"⊙ {movie_id}: Already has IMDB ID")
            skipped += 1
            continue

        # Add IMDB ID
        data['imdbId'] = imdb_id
        save_json(data, script_file)
        print(f"✓ {movie_id}: Added IMDB ID {imdb_id}")
        updated += 1

    print(f"\n{'=' * 60}")
    print(f"Updated: {updated}")
    print(f"Skipped: {skipped}")
    print(f"Total: {len(IMDB_IDS)}")


if __name__ == '__main__':
    main()
