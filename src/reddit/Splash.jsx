import { useEffect, useState } from 'preact/hooks';
import { Play } from 'lucide-preact';
// Order matters: foxing supplies .foxed, splash-paper overrides splash.css
import '../styles/foxing.css';
import './splash.css';
import './splash-paper.css';

const MAX_TEASER_WORDS = 22;
const GUESS_ANGLES = [-2.4, 1.6, -1.1, 2.2, -0.5];
const MOVIE_CYCLE_MS = 6500;
const GUESS_CYCLE_MS = 7500;
const GUESS_ERASE_MS = 850;

export function getQuoteTeaser(text, maxWords = MAX_TEASER_WORDS) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return words;

  const leadingWords = Math.ceil((maxWords - 1) / 2);
  const trailingWords = Math.floor((maxWords - 1) / 2);
  return [
    ...words.slice(0, leadingWords),
    '…',
    ...words.slice(-trailingWords),
  ];
}

export function getCharacterGuesses(metadata, answer) {
  const normalizedAnswer = answer?.trim().toUpperCase();
  const characters = Object.values(metadata?.charactersByMovie || {}).flat();

  return [...new Set(characters
    .map(character => character?.trim())
    .filter(character => {
      if (!character) return false;
      const normalizedCharacter = character.toUpperCase();
      if (!normalizedAnswer) return true;
      return !normalizedAnswer.includes(normalizedCharacter)
        && !normalizedCharacter.includes(normalizedAnswer);
    }))];
}

export function formatCharacterGuess(name) {
  return name
    .trim()
    .toLocaleLowerCase()
    .replace(/(^|[\s(/.'’-])([a-z])/g, (_, prefix, letter) => `${prefix}${letter.toUpperCase()}`)
    .replace(/\bMc([a-z])/g, (_, letter) => `Mc${letter.toUpperCase()}`)
    .split(' ')
    .map(word => (/\d/.test(word) ? word.toUpperCase() : word))
    .join(' ');
}

function getGuessSizeClass(name) {
  if (name.length > 29) return 'is-extra-compact';
  if (name.length > 22) return 'is-compact';
  if (name.length > 15) return 'is-long';
  return 'is-regular';
}

function RotatingMovieTitle({ movieTitles }) {
  const titles = movieTitles?.filter(Boolean) || [];
  const [titleIndex, setTitleIndex] = useState(0);

  useEffect(() => {
    setTitleIndex(0);

    const reducedMotion = document.documentElement.hasAttribute('data-reduced-motion');
    if (titles.length < 2 || reducedMotion) return undefined;

    const rotationTimer = window.setInterval(() => {
      setTitleIndex(currentIndex => (currentIndex + 1) % titles.length);
    }, MOVIE_CYCLE_MS);

    return () => window.clearInterval(rotationTimer);
  }, [movieTitles]);

  if (titles.length === 0) return null;

  const wheelPositions = titles.length === 1 ? [0] : (titles.length === 2 ? [0, 1] : [-1, 0, 1]);

  return (
    <div
      className="splash-movie-wheel"
      aria-label={`Movies in today's scene pool: ${titles.join(', ')}`}
    >
      {wheelPositions.map(position => {
        const wheelIndex = (titleIndex + position + titles.length) % titles.length;
        const positionName = position < 0 ? 'previous' : (position > 0 ? 'next' : 'current');
        return (
          <span
            key={titles[wheelIndex]}
            className={`splash-movie-title is-${positionName}`}
            aria-hidden="true"
          >
            {titles[wheelIndex]}
          </span>
        );
      })}
    </div>
  );
}

function HandwrittenGuess({ characterGuesses }) {
  const guesses = characterGuesses?.filter(Boolean) || [];
  const [guessIndex, setGuessIndex] = useState(() => (
    guesses.length > 1 ? Math.floor(Math.random() * guesses.length) : 0
  ));
  const [angleIndex, setAngleIndex] = useState(() => Math.floor(Math.random() * GUESS_ANGLES.length));
  const [isErasing, setIsErasing] = useState(false);

  useEffect(() => {
    const reducedMotion = document.documentElement.hasAttribute('data-reduced-motion');
    if (guesses.length < 2 || reducedMotion) return undefined;

    let eraseTimer;
    const guessTimer = window.setInterval(() => {
      setIsErasing(true);
      eraseTimer = window.setTimeout(() => {
        setGuessIndex(currentIndex => {
          const nextOffset = 1 + Math.floor(Math.random() * (guesses.length - 1));
          return (currentIndex + nextOffset) % guesses.length;
        });
        setAngleIndex(() => Math.floor(Math.random() * GUESS_ANGLES.length));
        setIsErasing(false);
      }, GUESS_ERASE_MS);
    }, GUESS_CYCLE_MS);

    return () => {
      window.clearInterval(guessTimer);
      window.clearTimeout(eraseTimer);
    };
  }, [characterGuesses]);

  const displayGuess = guesses.length > 0 ? formatCharacterGuess(guesses[guessIndex]) : '';

  return (
    <div
      className={`splash-guess-area${isErasing ? ' is-erasing' : ''}`}
      aria-label="A handwritten character guess changes periodically"
    >
      {displayGuess && (
        <span
          key={guesses[guessIndex]}
          className={`splash-handwritten-guess ${getGuessSizeClass(displayGuess)}`}
          style={{ '--guess-angle': `${GUESS_ANGLES[angleIndex]}deg` }}
          aria-hidden="true"
        >
          {displayGuess}
        </span>
      )}
    </div>
  );
}

export function Splash({ characterGuesses, movieTitles, quote, onStart, ready = true }) {
  const [isExiting, setIsExiting] = useState(false);
  const teaserWords = getQuoteTeaser(quote);

  function handleStart() {
    if (!ready || isExiting) return;
    setIsExiting(true);

    const reducedMotion = document.documentElement.hasAttribute('data-reduced-motion');
    if (reducedMotion) {
      onStart();
      return;
    }

    window.setTimeout(onStart, 420);
  }

  return (
    <main
      className={`reddit-splash${isExiting ? ' is-exiting' : ''}`}
      data-testid="reddit-splash"
      data-theme="pack"
      aria-busy={!ready}
    >
      <div className="splash-light splash-light-one" aria-hidden="true" />
      <div className="splash-light splash-light-two" aria-hidden="true" />

      <section className="splash-content" aria-label="Today’s Scriptle scene">
        <div className="splash-brand">/r/scriptle</div>
        <RotatingMovieTitle movieTitles={movieTitles} />

        <div className="splash-script-card foxed" data-theme="script">
          <div className="splash-paper-edge splash-paper-edge-top" aria-hidden="true" />
          <p className="splash-quote" aria-label={quote}>
            <span aria-hidden="true">“</span>
            <span className="splash-quote-words" aria-hidden="true">
              {teaserWords.map((word, index) => (
                <span
                  key={`${word}-${index}`}
                  className="splash-quote-word"
                  style={{ '--word-index': index }}
                >
                  {word}{index < teaserWords.length - 1 ? ' ' : ''}
                </span>
              ))}
            </span>
            <span aria-hidden="true">”</span>
          </p>

          <HandwrittenGuess characterGuesses={characterGuesses} />

          <div className="splash-paper-edge splash-paper-edge-bottom" aria-hidden="true" />
        </div>

        <p className="splash-prompt">Name the movie. Name the character.</p>

        <button
          type="button"
          className="splash-start-button"
          onClick={handleStart}
          disabled={!ready || isExiting}
          data-testid="splash-start"
        >
          <Play size={18} fill="currentColor" aria-hidden="true" />
          <span>Guess Today’s Scene</span>
        </button>
      </section>
    </main>
  );
}
