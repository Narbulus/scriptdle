import { h, render } from 'preact';
import { afterEach, describe, expect, test } from 'vitest';
import {
  formatCharacterGuess,
  getCharacterGuesses,
  getQuoteTeaser,
  Splash,
} from './Splash.jsx';

let container;

afterEach(() => {
  if (container) render(null, container);
  container = null;
  document.documentElement.removeAttribute('data-reduced-motion');
  delete globalThis.React;
});

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

describe('Reddit splash presentation', () => {
  test('centers the quote without screenplay filler and uses the updated call to action', () => {
    document.documentElement.setAttribute('data-reduced-motion', '');
    globalThis.React = { createElement: h };
    container = document.createElement('div');

    render(h(Splash, {
      characterGuesses: ['Obi-Wan Kenobi'],
      movieTitles: ['The Phantom Menace', 'The Force Awakens'],
      quote: 'May the Force be with you.',
      onStart: () => {},
    }), container);

    expect(container.textContent).toContain('/r/scriptle');
    expect(container.textContent).toContain('The Phantom Menace');
    expect(container.textContent).toContain('Obi-Wan Kenobi');
    expect(container.textContent).toContain('Guess Today’s Scene');
    expect(container.textContent).not.toContain('INT. UNKNOWN SCENE');
    expect(container.querySelector('.splash-redaction')).toBeNull();
  });

  test('builds unique decoy guesses without revealing the answer', () => {
    const metadata = {
      charactersByMovie: {
        first: ['LUKE', 'LEIA', 'LUKE', 'HARRY'],
        second: ['HAN', ' LEIA '],
      },
    };

    expect(getCharacterGuesses(metadata, 'Leia')).toEqual(['LUKE', 'HARRY', 'HAN']);
    expect(getCharacterGuesses(metadata, 'Harry Potter')).toEqual(['LUKE', 'LEIA', 'HAN']);
  });

  test('formats screenplay character names like handwriting', () => {
    expect(formatCharacterGuess('MINERVA MCGONAGALL')).toBe('Minerva McGonagall');
    expect(formatCharacterGuess('C-3PO')).toBe('C-3PO');
    expect(formatCharacterGuess("ALASTOR 'MAD-EYE' MOODY")).toBe("Alastor 'Mad-Eye' Moody");
  });
});
