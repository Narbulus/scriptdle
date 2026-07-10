import { useState } from 'preact/hooks';
import { Play } from 'lucide-preact';
import './splash.css';

const MAX_TEASER_WORDS = 22;

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

export function Splash({ packName, quote, onStart }) {
  const [isExiting, setIsExiting] = useState(false);
  const teaserWords = getQuoteTeaser(quote);

  function handleStart() {
    if (isExiting) return;
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
    >
      <div className="splash-light splash-light-one" aria-hidden="true" />
      <div className="splash-light splash-light-two" aria-hidden="true" />

      <section className="splash-content" aria-labelledby="splash-title">
        <div className="splash-brand">SCRIPTLE</div>
        <div className="splash-pack-name">{packName}</div>

        <div className="splash-script-card" data-theme="script">
          <div className="splash-paper-edge splash-paper-edge-top" aria-hidden="true" />
          <div className="splash-scene-heading">INT. UNKNOWN SCENE — TODAY</div>

          <div className="splash-redaction splash-redaction-short" aria-hidden="true" />
          <div className="splash-redaction splash-redaction-long" aria-hidden="true" />

          <h1 id="splash-title" className="splash-character">???</h1>
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
            <span className="splash-cursor" aria-hidden="true" />
          </p>

          <div className="splash-redaction splash-redaction-medium" aria-hidden="true" />
          <div className="splash-paper-edge splash-paper-edge-bottom" aria-hidden="true" />
        </div>

        <p className="splash-prompt">Name the movie. Name the character.</p>

        <button
          type="button"
          className="splash-start-button"
          onClick={handleStart}
          disabled={isExiting}
          data-testid="splash-start"
        >
          <Play size={18} fill="currentColor" aria-hidden="true" />
          <span>Play Today’s Scene</span>
        </button>
      </section>
    </main>
  );
}
