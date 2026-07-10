import { describe, expect, test } from 'vitest';
import { getQuoteTeaser } from './Splash.jsx';

describe('Reddit splash quote teaser', () => {
  test('keeps short quotes intact', () => {
    expect(getQuoteTeaser('May the Force be with you.')).toEqual([
      'May', 'the', 'Force', 'be', 'with', 'you.',
    ]);
  });

  test('truncates long quotes while preserving both ends', () => {
    const words = Array.from({ length: 30 }, (_, index) => `word${index + 1}`);
    const teaser = getQuoteTeaser(words.join(' '), 10);

    expect(teaser).toHaveLength(10);
    expect(teaser.slice(0, 5)).toEqual(['word1', 'word2', 'word3', 'word4', 'word5']);
    expect(teaser[5]).toBe('…');
    expect(teaser.slice(-4)).toEqual(['word27', 'word28', 'word29', 'word30']);
  });
});
