#!/usr/bin/env python3
"""
Analyze character representation with word filters.
"""

import json
from pathlib import Path
from collections import Counter


class CharacterCoverageAnalyzer:
    def __init__(self, data_dir='public/data'):
        self.data_dir = Path(data_dir)
        self.packs_dir = self.data_dir / 'packs'
        self.scripts_dir = self.data_dir / 'scripts'

    def load_pack(self, pack_id):
        pack_file = self.packs_dir / f'{pack_id}.json'
        with open(pack_file, 'r', encoding='utf-8') as f:
            return json.load(f)

    def load_scripts(self, movie_ids):
        scripts = {}
        for movie_id in movie_ids:
            script_file = self.scripts_dir / f'{movie_id}.json'
            if script_file.exists():
                with open(script_file, 'r', encoding='utf-8') as f:
                    scripts[movie_id] = json.load(f)
        return scripts

    def flatten_lines(self, scripts):
        all_lines = []
        for movie_id, script in sorted(scripts.items()):
            for idx, line in enumerate(script['lines']):
                all_lines.append({
                    'character': line['character'],
                    'text': line['text'],
                    'movieId': movie_id,
                    'word_count': len(line['text'].split())
                })
        return all_lines

    def get_character_stats(self, scripts, all_lines, min_words=0):
        """Get eligible line counts per character"""
        # Build set of significant characters per movie
        significant_chars = set()
        for movie_id, script in scripts.items():
            top_cast = script.get('topSpeakingCast', script.get('topCast', []))
            significant_chars.update(top_cast)

        # Count eligible lines per character
        char_counts = Counter()
        for idx, line in enumerate(all_lines):
            character = line['character']
            if character in significant_chars:
                # Check word count and padding
                if line['word_count'] >= min_words:
                    if idx >= 1 and idx < len(all_lines) - 3:
                        char_counts[character] += 1

        return char_counts, significant_chars

    def analyze_pack(self, pack_id):
        """Analyze character coverage for a pack"""
        print(f"\n{'='*80}")
        print(f"Pack: {pack_id}")
        print(f"{'='*80}")

        pack = self.load_pack(pack_id)
        scripts = self.load_scripts(pack['movies'])
        all_lines = self.flatten_lines(scripts)

        # Analyze at 0 words (baseline) and 5 words (current default)
        baseline_counts, significant_chars = self.get_character_stats(scripts, all_lines, min_words=0)
        filtered_counts, _ = self.get_character_stats(scripts, all_lines, min_words=5)

        print(f"Pack Name: {pack['name']}")
        print(f"Significant Characters: {len(significant_chars)}")

        # Check for characters that lost ALL representation
        lost_chars = [char for char in significant_chars if baseline_counts[char] > 0 and filtered_counts[char] == 0]
        severely_reduced = [char for char in significant_chars
                           if baseline_counts[char] > 0 and
                           filtered_counts[char] > 0 and
                           (filtered_counts[char] / baseline_counts[char]) < 0.3]

        if lost_chars:
            print(f"\n⚠️  LOST REPRESENTATION ({len(lost_chars)} characters have 0 eligible lines):")
            for char in lost_chars:
                print(f"   - {char}: had {baseline_counts[char]} lines, now 0")

        if severely_reduced:
            print(f"\n⚠️  SEVERELY REDUCED ({len(severely_reduced)} characters lost >70% of lines):")
            for char in severely_reduced[:5]:  # Show top 5
                before = baseline_counts[char]
                after = filtered_counts[char]
                reduction = (1 - after/before) * 100
                print(f"   - {char}: {before} → {after} lines ({reduction:.0f}% reduction)")

        # Show top characters
        print(f"\n✅ Top 10 Characters by Eligible Lines (5-word minimum):")
        print(f"   {'Character':<30} {'No Filter':<12} {'5-Word Min':<12} {'% Retained':<12}")
        print(f"   {'-'*70}")

        for char, count_5 in filtered_counts.most_common(10):
            count_0 = baseline_counts[char]
            percentage = (count_5 / count_0 * 100) if count_0 > 0 else 0
            print(f"   {char:<30} {count_0:<12} {count_5:<12} {percentage:>6.1f}%")

        return {
            'lost_chars': lost_chars,
            'severely_reduced': severely_reduced,
            'total_significant': len(significant_chars)
        }

    def analyze_all_packs(self):
        """Analyze all packs"""
        pack_files = list(self.packs_dir.glob('*.json'))
        pack_ids = [p.stem for p in pack_files]

        summary = {}
        for pack_id in sorted(pack_ids):
            try:
                summary[pack_id] = self.analyze_pack(pack_id)
            except Exception as e:
                print(f"Error analyzing {pack_id}: {e}")

        # Summary
        print(f"\n\n{'='*80}")
        print(f"SUMMARY: Character Coverage Impact")
        print(f"{'='*80}\n")
        print(f"{'Pack':<25} {'Significant':<15} {'Lost All Lines':<18} {'Severely Reduced':<18}")
        print("-" * 80)

        for pack_id in sorted(pack_ids):
            if pack_id in summary:
                s = summary[pack_id]
                try:
                    pack = self.load_pack(pack_id)
                    name = pack['name'][:24]
                except:
                    name = pack_id[:24]

                lost = len(s['lost_chars'])
                reduced = len(s['severely_reduced'])

                print(f"{name:<25} {s['total_significant']:<15} {lost:<18} {reduced:<18}")


def main():
    analyzer = CharacterCoverageAnalyzer()
    analyzer.analyze_all_packs()


if __name__ == '__main__':
    main()
