#!/usr/bin/env python3
"""
Generate daily puzzle files for Scriptle game.
Replicates the exact RNG logic from Game.js to ensure consistency.
"""

import json
import os
import argparse
from datetime import datetime, timedelta
from pathlib import Path


class PuzzleGenerator:
    def __init__(self, data_dir='public/data'):
        self.data_dir = Path(data_dir)
        self.scripts_dir = self.data_dir / 'scripts'
        self.packs_dir = self.data_dir / 'packs'
        self.daily_dir = self.data_dir / 'daily'

    def mulberry32(self, seed):
        """Seeded RNG - matches Game.js exactly"""
        def random():
            nonlocal seed
            # JavaScript: seed += 0x6D2B79F5
            seed = (seed + 0x6D2B79F5) & 0xFFFFFFFF
            # JavaScript: t = Math.imul(t ^ (t >>> 15), t | 1)
            t = seed
            t = ((t ^ (t >> 15)) * (t | 1)) & 0xFFFFFFFF
            # JavaScript: t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
            t = (t ^ (t + ((t ^ (t >> 7)) * (t | 61)))) & 0xFFFFFFFF
            # JavaScript: return ((t ^ (t >>> 14)) >>> 0) / 4294967296
            return ((t ^ (t >> 14)) >> 0) / 4294967296
        return random

    def hash_string(self, s):
        """Hash a string - matches Game.js hashString exactly"""
        hash_val = 0
        for c in s:
            # JavaScript: hash = ((hash << 5) - hash) + char
            hash_val = ((hash_val << 5) - hash_val + ord(c)) & 0xFFFFFFFF
            # Convert to signed 32-bit integer (JavaScript |= 0)
            if hash_val >= 0x80000000:
                hash_val -= 0x100000000
        return abs(hash_val)

    def get_date_seed(self, date_str):
        """Get seed from date string - matches Game.js getDateSeed exactly"""
        return self.hash_string(date_str)

    def build_significant_lines_index(self, scripts, all_lines):
        """
        Build index of line indices where character is significant.
        Returns dict mapping movie_id to list of valid line indices.
        This enables movie-balanced selection.
        """
        # Build set of significant characters per movie
        significant_by_movie = {}
        for movie_id, script in scripts.items():
            # Try both topSpeakingCast (new format) and topCast (legacy)
            top_cast = script.get('topSpeakingCast', script.get('topCast', []))
            significant_by_movie[movie_id] = set(top_cast)

        # Find indices of lines from significant characters, grouped by movie
        indices_by_movie = {}
        for idx, line in enumerate(all_lines):
            movie_id = line['movieId']
            character = line['character']
            if character in significant_by_movie.get(movie_id, set()):
                # Also check padding: need 1 before, 3 after
                if idx >= 1 and idx < len(all_lines) - 3:
                    if movie_id not in indices_by_movie:
                        indices_by_movie[movie_id] = []
                    indices_by_movie[movie_id].append(idx)

        return indices_by_movie

    def select_target_index(self, pack_id, date_str, indices_by_movie, pack_movie_order):
        """
        Select target line index using movie-balanced selection.
        First picks a movie, then picks a line from that movie.
        This ensures each movie has equal probability regardless of line count.
        Uses the pack's original movie order for consistent selection.
        """
        if not indices_by_movie:
            raise ValueError("No significant character lines available!")

        date_seed = self.get_date_seed(date_str)
        pack_hash = self.hash_string(pack_id)
        combined_seed = date_seed + pack_hash

        rng = self.mulberry32(combined_seed)

        # Step 1: Pick a movie (each movie has equal probability)
        # Use pack's original order, filtering to only movies with valid indices
        movie_ids = [m for m in pack_movie_order if m in indices_by_movie]
        movie_random = rng()
        selected_movie_idx = int(movie_random * len(movie_ids))
        selected_movie = movie_ids[selected_movie_idx]

        # Step 2: Pick a line from that movie
        movie_indices = indices_by_movie[selected_movie]
        line_random = rng()
        selected_line_idx = int(line_random * len(movie_indices))
        target_index = movie_indices[selected_line_idx]

        # Calculate total lines for logging
        total_lines = sum(len(indices) for indices in indices_by_movie.values())

        print(f"  Date: {date_str}, DateSeed: {date_seed}, PackHash: {pack_hash}, Combined: {combined_seed}")
        print(f"  Movie RNG: {movie_random:.6f} -> {selected_movie} (movie {selected_movie_idx + 1}/{len(movie_ids)})")
        print(f"  Line RNG: {line_random:.6f} -> index {target_index} (line {selected_line_idx + 1}/{len(movie_indices)} in movie)")
        print(f"  Total significant lines across all movies: {total_lines}")

        return target_index

    def load_pack(self, pack_id):
        """Load pack definition"""
        pack_file = self.packs_dir / f'{pack_id}.json'
        with open(pack_file, 'r', encoding='utf-8') as f:
            return json.load(f)

    def load_scripts(self, movie_ids):
        """Load all scripts for a pack"""
        scripts = {}
        for movie_id in movie_ids:
            script_file = self.scripts_dir / f'{movie_id}.json'
            with open(script_file, 'r', encoding='utf-8') as f:
                scripts[movie_id] = json.load(f)
        return scripts

    def flatten_lines(self, scripts):
        """
        Flatten all lines from all scripts into one array.
        Matches Game.js constructor logic exactly.
        """
        all_lines = []
        # Sort by movieId to ensure consistent ordering
        sorted_movies = sorted(scripts.items(), key=lambda x: x[0])

        for movie_id, script in sorted_movies:
            for idx, line in enumerate(script['lines']):
                all_lines.append({
                    'character': line['character'],
                    'text': line['text'],
                    'movie': script['title'],
                    'movieId': movie_id,
                    'originalIndex': idx,
                    'year': script.get('year')
                })

        return all_lines

    def build_metadata(self, all_lines, scripts):
        """Build metadata with significant characters only"""
        movies_with_year = {}
        movies_with_title = {}
        movies_with_poster = {}
        significant_by_movie = {}

        # Get significant characters from script metadata
        for movie_id, script in scripts.items():
            # Try both topSpeakingCast (new format) and topCast (legacy)
            top_cast = script.get('topSpeakingCast', script.get('topCast', []))
            significant_by_movie[movie_id] = top_cast
            movies_with_year[movie_id] = script.get('year')
            movies_with_title[movie_id] = script.get('title')
            movies_with_poster[movie_id] = script.get('poster')

        # Collect all movie IDs from lines
        movies = set(line['movieId'] for line in all_lines)

        # Sort movies by year (if available), then alphabetically
        # Movies without year go to the end
        sorted_movies = sorted(
            movies,
            key=lambda m: (movies_with_year.get(m) is None, movies_with_year.get(m) or 0, m)
        )

        return {
            'movies': sorted_movies,
            'movieYears': {m: year for m, year in movies_with_year.items() if year},
            'movieTitles': {m: title for m, title in movies_with_title.items() if title},
            'moviePosters': {m: poster for m, poster in movies_with_poster.items() if poster},
            'charactersByMovie': {
                movie: sorted(significant_by_movie.get(movie, []))
                for movie in sorted_movies
            }
        }

    def generate_daily_puzzle(self, pack_id, date_str, all_lines, indices_by_movie, metadata, pack_movie_order):
        """Generate puzzle data for a specific date"""
        target_index = self.select_target_index(pack_id, date_str, indices_by_movie, pack_movie_order)

        # Extract target line and context
        target_line = all_lines[target_index]
        context_before = all_lines[target_index - 1] if target_index > 0 else None
        context_after = []
        for i in range(1, 4):  # Changed from 6 to 4 (only 3 lines after)
            if target_index + i < len(all_lines):
                context_after.append(all_lines[target_index + i])

        puzzle_data = {
            'version': 1,
            'date': date_str,
            'packId': pack_id,
            'puzzle': {
                'targetLine': {
                    'character': target_line['character'],
                    'text': target_line['text'],
                    'movie': target_line['movie']
                },
                'contextBefore': {
                    'character': context_before['character'],
                    'text': context_before['text']
                } if context_before else None,
                'contextAfter': [
                    {
                        'character': line['character'],
                        'text': line['text']
                    }
                    for line in context_after
                ]
            },
            'metadata': metadata
        }

        return puzzle_data

    def generate_manifest(self, pack, start_date, end_date, total_lines):
        """Generate manifest file for a pack"""
        manifest = {
            'packId': pack['id'],
            'packName': pack['name'],
            'generatedAt': datetime.now().isoformat(),
            'dateRange': {
                'start': start_date,
                'end': end_date
            },
            'totalPuzzles': (datetime.fromisoformat(end_date) - datetime.fromisoformat(start_date)).days + 1,
            'cycleLength': total_lines
        }

        # Include tierMessages if present in pack definition
        if 'tierMessages' in pack:
            manifest['tierMessages'] = pack['tierMessages']

        return manifest

    def generate_for_pack(self, pack_id, days=365):
        """Generate daily puzzles for a pack"""
        print(f"\n{'='*60}")
        print(f"Generating puzzles for pack: {pack_id}")
        print(f"{'='*60}")

        # Load pack and scripts
        pack = self.load_pack(pack_id)
        scripts = self.load_scripts(pack['movies'])

        # Flatten lines and build significant lines index
        all_lines = self.flatten_lines(scripts)
        indices_by_movie = self.build_significant_lines_index(scripts, all_lines)
        metadata = self.build_metadata(all_lines, scripts)

        total_significant = sum(len(indices) for indices in indices_by_movie.values())
        print(f"Total lines: {len(all_lines)}")
        print(f"Significant character lines: {total_significant}")
        print(f"Movies: {len(metadata['movies'])}")
        print(f"Lines per movie: {', '.join(f'{movie}: {len(indices)}' for movie, indices in sorted(indices_by_movie.items()))}")

        # Create output directory
        pack_daily_dir = self.daily_dir / pack_id
        pack_daily_dir.mkdir(parents=True, exist_ok=True)

        # Generate puzzles
        # Start from yesterday to handle timezone differences
        # (build server runs in UTC, users may be in earlier timezones like EST/PST)
        start_date = datetime.now().date() - timedelta(days=1)
        end_date = start_date + timedelta(days=days)

        current_date = start_date
        generated_count = 0

        while current_date <= end_date:
            date_str = current_date.isoformat()

            # Generate puzzle
            puzzle_data = self.generate_daily_puzzle(pack_id, date_str, all_lines, indices_by_movie, metadata, pack['movies'])

            # Write puzzle file
            puzzle_file = pack_daily_dir / f'{date_str}.json'
            with open(puzzle_file, 'w', encoding='utf-8') as f:
                json.dump(puzzle_data, f, indent=2, ensure_ascii=False)

            generated_count += 1
            if generated_count % 30 == 0:
                print(f"Generated {generated_count}/{days} puzzles...")

            current_date += timedelta(days=1)

        # Generate manifest
        manifest = self.generate_manifest(
            pack,
            start_date.isoformat(),
            end_date.isoformat(),
            len(all_lines)
        )
        manifest_file = pack_daily_dir / 'manifest.json'
        with open(manifest_file, 'w', encoding='utf-8') as f:
            json.dump(manifest, f, indent=2, ensure_ascii=False)

        print(f"\nGenerated {generated_count} puzzle files for {pack_id}")
        print(f"Date range: {start_date} to {end_date}")
        print(f"Output directory: {pack_daily_dir}")

    def generate_consolidated_daily_files(self, days=365):
        """
        Generate consolidated daily files that combine all pack puzzles for each date.
        Results in /data/daily-all/{date}.json files.
        """
        print(f"\n{'='*60}")
        print(f"Generating consolidated daily files...")
        print(f"{'='*60}")

        # Create output directory
        daily_all_dir = self.daily_dir.parent / 'daily-all'
        daily_all_dir.mkdir(parents=True, exist_ok=True)

        # Find all pack IDs
        pack_files = list(self.packs_dir.glob('*.json'))
        pack_ids = [p.stem for p in pack_files]

        # Load all manifests
        manifests = {}
        for pack_id in pack_ids:
            manifest_file = self.daily_dir / pack_id / 'manifest.json'
            if manifest_file.exists():
                with open(manifest_file, 'r', encoding='utf-8') as f:
                    manifests[pack_id] = json.load(f)

        # Generate consolidated files for each date
        start_date = datetime.now().date() - timedelta(days=1)
        end_date = start_date + timedelta(days=days)
        current_date = start_date
        generated_count = 0

        while current_date <= end_date:
            date_str = current_date.isoformat()
            consolidated = {
                'date': date_str,
                'puzzles': {},
                'manifests': manifests
            }

            # Load each pack's puzzle for this date
            for pack_id in pack_ids:
                puzzle_file = self.daily_dir / pack_id / f'{date_str}.json'
                if puzzle_file.exists():
                    with open(puzzle_file, 'r', encoding='utf-8') as f:
                        puzzle_data = json.load(f)
                        # Include full puzzle data (with metadata for gameplay)
                        consolidated['puzzles'][pack_id] = puzzle_data

            # Write consolidated file
            output_file = daily_all_dir / f'{date_str}.json'
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(consolidated, f, ensure_ascii=False)

            generated_count += 1
            if generated_count % 30 == 0:
                print(f"Generated {generated_count}/{days} consolidated files...")

            current_date += timedelta(days=1)

        print(f"\nGenerated {generated_count} consolidated daily files")
        print(f"Output directory: {daily_all_dir}")

    def generate_themes_file(self):
        """Generate themes.js file with all pack themes"""
        print(f"\n{'='*60}")
        print(f"Generating themes.js...")
        print(f"{'='*60}")

        # Find all pack files
        pack_files = list(self.packs_dir.glob('*.json'))
        themes = {}

        for pack_file in pack_files:
            pack_id = pack_file.stem
            try:
                pack = self.load_pack(pack_id)
                if 'theme' in pack:
                    themes[pack_id] = pack['theme']
                    # Add metadata for optimistic rendering
                    themes[pack_id]['name'] = pack.get('name', pack_id)
                    themes[pack_id]['movieCount'] = len(pack.get('movies', []))
                    print(f"  Loaded theme for {pack_id}")
            except Exception as e:
                print(f"  Warning: Failed to load theme for {pack_id}: {e}")

        # Generate JavaScript file
        js_content = "// Auto-generated theme data - DO NOT EDIT\n"
        js_content += "// Run 'python scripts/generate-daily-puzzles.py' to regenerate\n\n"
        js_content += "window.SCRIPTLE_THEMES = " + json.dumps(themes, indent=2) + ";\n"

        # Write to public directory
        themes_file = Path('public/themes.js')
        with open(themes_file, 'w', encoding='utf-8') as f:
            f.write(js_content)

        print(f"\nGenerated themes.js with {len(themes)} pack(s)")
        print(f"Output file: {themes_file}")

    def generate_all(self, days=365):
        """Generate puzzles for all packs"""
        # Find all pack files
        pack_files = list(self.packs_dir.glob('*.json'))

        print(f"Found {len(pack_files)} pack(s)")

        for pack_file in pack_files:
            pack_id = pack_file.stem
            try:
                self.generate_for_pack(pack_id, days)
            except Exception as e:
                print(f"Error generating puzzles for {pack_id}: {e}")
                raise

        # Generate themes file
        self.generate_themes_file()

        # Generate consolidated daily files (combines all packs per date)
        self.generate_consolidated_daily_files(days)

        print(f"\n{'='*60}")
        print(f"Generation complete!")
        print(f"{'='*60}")


def main():
    parser = argparse.ArgumentParser(description='Generate daily Scriptle puzzles')
    parser.add_argument('--days', type=int, default=365, help='Number of days to generate (default: 365)')
    parser.add_argument('--pack', type=str, help='Generate for specific pack only')
    parser.add_argument('--data-dir', type=str, default='public/data', help='Data directory path')

    args = parser.parse_args()

    generator = PuzzleGenerator(data_dir=args.data_dir)

    if args.pack:
        generator.generate_for_pack(args.pack, args.days)
        # Also regenerate themes file
        generator.generate_themes_file()
    else:
        generator.generate_all(args.days)


if __name__ == '__main__':
    main()
