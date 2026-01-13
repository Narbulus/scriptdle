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

    def select_target_index(self, pack_id, date_str, total_lines):
        """
        Select target line index for a given pack and date.
        Matches Game.js selectTarget() logic exactly.
        """
        date_seed = self.get_date_seed(date_str)
        pack_hash = self.hash_string(pack_id)
        combined_seed = date_seed + pack_hash

        rng = self.mulberry32(combined_seed)

        # Need padding for context lines
        min_index = 1
        max_index = total_lines - 6

        if max_index < min_index:
            return 0

        random_value = rng()
        target_index = min_index + int(random_value * (max_index - min_index))

        print(f"  Date: {date_str}, DateSeed: {date_seed}, PackHash: {pack_hash}, Combined: {combined_seed}")
        print(f"  RNG value: {random_value:.6f}, Target index: {target_index}, Total lines: {total_lines}")

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
                    'originalIndex': idx
                })

        return all_lines

    def build_metadata(self, all_lines):
        """Build character lists per movie"""
        movies = set()
        characters_by_movie = {}

        for line in all_lines:
            movie = line['movie']
            movies.add(movie)
            if movie not in characters_by_movie:
                characters_by_movie[movie] = set()
            characters_by_movie[movie].add(line['character'])

        return {
            'movies': sorted(list(movies)),
            'charactersByMovie': {
                movie: sorted(list(chars))
                for movie, chars in characters_by_movie.items()
            }
        }

    def generate_daily_puzzle(self, pack_id, date_str, all_lines, metadata):
        """Generate puzzle data for a specific date"""
        target_index = self.select_target_index(pack_id, date_str, len(all_lines))

        # Extract target line and context
        target_line = all_lines[target_index]
        context_before = all_lines[target_index - 1] if target_index > 0 else None
        context_after = []
        for i in range(1, 6):
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
        return {
            'packId': pack['id'],
            'packName': pack['name'],
            'generatedAt': datetime.now().isoformat(),
            'dateRange': {
                'start': start_date,
                'end': end_date
            },
            'totalPuzzles': (datetime.fromisoformat(end_date) - datetime.fromisoformat(start_date)).days + 1,
            'cycleLength': total_lines,
            'theme': pack.get('theme', {})
        }

    def generate_for_pack(self, pack_id, days=365):
        """Generate daily puzzles for a pack"""
        print(f"\n{'='*60}")
        print(f"Generating puzzles for pack: {pack_id}")
        print(f"{'='*60}")

        # Load pack and scripts
        pack = self.load_pack(pack_id)
        scripts = self.load_scripts(pack['movies'])

        # Flatten lines and build metadata
        all_lines = self.flatten_lines(scripts)
        metadata = self.build_metadata(all_lines)

        print(f"Total lines: {len(all_lines)}")
        print(f"Movies: {len(metadata['movies'])}")

        # Create output directory
        pack_daily_dir = self.daily_dir / pack_id
        pack_daily_dir.mkdir(parents=True, exist_ok=True)

        # Generate puzzles
        start_date = datetime.now().date()
        end_date = start_date + timedelta(days=days - 1)

        current_date = start_date
        generated_count = 0

        while current_date <= end_date:
            date_str = current_date.isoformat()

            # Generate puzzle
            puzzle_data = self.generate_daily_puzzle(pack_id, date_str, all_lines, metadata)

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
    else:
        generator.generate_all(args.days)


if __name__ == '__main__':
    main()
