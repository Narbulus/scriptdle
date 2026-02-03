#!/usr/bin/env python3
"""
Analyze the impact of minimum word length filter on puzzle pool sizes.
"""

import json
from pathlib import Path


class FilterImpactAnalyzer:
    def __init__(self, data_dir='public/data'):
        self.data_dir = Path(data_dir)
        self.packs_dir = self.data_dir / 'packs'
        self.scripts_dir = self.data_dir / 'scripts'

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
            if script_file.exists():
                with open(script_file, 'r', encoding='utf-8') as f:
                    scripts[movie_id] = json.load(f)
        return scripts

    def flatten_lines(self, scripts):
        """Flatten all lines from all scripts"""
        all_lines = []
        sorted_movies = sorted(scripts.items(), key=lambda x: x[0])

        for movie_id, script in sorted_movies:
            for idx, line in enumerate(script['lines']):
                all_lines.append({
                    'character': line['character'],
                    'text': line['text'],
                    'movie': script['title'],
                    'movieId': movie_id,
                    'originalIndex': idx,
                    'word_count': len(line['text'].split())
                })

        return all_lines

    def build_significant_lines_index(self, scripts, all_lines, min_words=0):
        """Build index with word count filter"""
        # Build set of significant characters per movie
        significant_by_movie = {}
        for movie_id, script in scripts.items():
            top_cast = script.get('topSpeakingCast', script.get('topCast', []))
            significant_by_movie[movie_id] = set(top_cast)

        # Find indices of lines from significant characters, grouped by movie
        indices_by_movie = {}
        filtered_lines = []

        for idx, line in enumerate(all_lines):
            movie_id = line['movieId']
            character = line['character']

            if character in significant_by_movie.get(movie_id, set()):
                # Check minimum word count
                if line['word_count'] < min_words:
                    continue

                # Check padding: need 1 before, 3 after
                if idx >= 1 and idx < len(all_lines) - 3:
                    if movie_id not in indices_by_movie:
                        indices_by_movie[movie_id] = []
                    indices_by_movie[movie_id].append(idx)
                    filtered_lines.append(line)

        return indices_by_movie, filtered_lines

    def analyze_pack(self, pack_id, word_minimums=[0, 3, 5, 7, 10]):
        """Analyze impact of different word minimums on a pack"""
        print(f"\n{'='*70}")
        print(f"Pack: {pack_id}")
        print(f"{'='*70}")

        pack = self.load_pack(pack_id)
        scripts = self.load_scripts(pack['movies'])
        all_lines = self.flatten_lines(scripts)

        print(f"Pack Name: {pack['name']}")
        print(f"Movies: {len(pack['movies'])}")
        print(f"Total Lines: {len(all_lines)}")

        results = {}
        for min_words in word_minimums:
            indices_by_movie, filtered_lines = self.build_significant_lines_index(
                scripts, all_lines, min_words=min_words
            )

            total_eligible = sum(len(indices) for indices in indices_by_movie.values())

            # Calculate word count distribution
            if filtered_lines:
                word_counts = [line['word_count'] for line in filtered_lines]
                avg_words = sum(word_counts) / len(word_counts)
                min_line_words = min(word_counts)
                max_line_words = max(word_counts)
            else:
                avg_words = 0
                min_line_words = 0
                max_line_words = 0

            results[min_words] = {
                'total_eligible': total_eligible,
                'indices_by_movie': {m: len(indices) for m, indices in indices_by_movie.items()},
                'avg_words': avg_words,
                'min_words': min_line_words,
                'max_words': max_line_words,
                'movies_with_lines': len(indices_by_movie)
            }

        # Print comparison table
        print(f"\n{'Min Words':<12} {'Eligible':<12} {'% of Base':<12} {'Avg Words':<12} {'Movies':<10}")
        print("-" * 70)

        base_eligible = results[0]['total_eligible']
        for min_words in word_minimums:
            r = results[min_words]
            percentage = (r['total_eligible'] / base_eligible * 100) if base_eligible > 0 else 0
            print(f"{min_words:<12} {r['total_eligible']:<12} {percentage:>6.1f}%      {r['avg_words']:>6.1f}       {r['movies_with_lines']:<10}")

        # Check for severely limited packs
        current_min = 5
        if current_min in results:
            eligible_5 = results[current_min]['total_eligible']
            if eligible_5 < 100:
                print(f"\n⚠️  WARNING: Only {eligible_5} eligible lines with 5-word minimum!")
                print(f"    This may cause puzzle repetition within {eligible_5} days.")
            elif eligible_5 < 365:
                print(f"\n⚠️  CAUTION: Only {eligible_5} eligible lines with 5-word minimum.")
                print(f"    Puzzles will repeat after {eligible_5} days.")

        return results

    def analyze_all_packs(self, word_minimums=[0, 3, 5, 7, 10]):
        """Analyze all packs and generate summary"""
        pack_files = list(self.packs_dir.glob('*.json'))
        pack_ids = [p.stem for p in pack_files]

        all_results = {}
        for pack_id in sorted(pack_ids):
            try:
                all_results[pack_id] = self.analyze_pack(pack_id, word_minimums)
            except Exception as e:
                print(f"Error analyzing {pack_id}: {e}")

        # Generate summary
        print(f"\n\n{'='*70}")
        print(f"SUMMARY: Impact of 5-word minimum across all packs")
        print(f"{'='*70}")
        print(f"\n{'Pack':<25} {'No Filter':<12} {'5-Word Min':<12} {'% Retained':<12} {'Days Until Repeat':<20}")
        print("-" * 90)

        for pack_id in sorted(pack_ids):
            if pack_id in all_results:
                r = all_results[pack_id]
                base = r[0]['total_eligible']
                filtered = r[5]['total_eligible']
                percentage = (filtered / base * 100) if base > 0 else 0

                # Load pack name
                try:
                    pack = self.load_pack(pack_id)
                    name = pack['name'][:24]
                except:
                    name = pack_id[:24]

                print(f"{name:<25} {base:<12} {filtered:<12} {percentage:>6.1f}%       {filtered} days")

        print("\n")


def main():
    analyzer = FilterImpactAnalyzer()
    analyzer.analyze_all_packs(word_minimums=[0, 3, 5, 7, 10])


if __name__ == '__main__':
    main()
