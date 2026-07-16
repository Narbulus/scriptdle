/**
 * ScriptLine Component
 * Renders a single line of dialogue with a persistent mask overlay system.
 * The real text is always in the DOM; a mask covers it when hidden, and
 * animates away (wipe) on gameplay reveals. No DOM swaps between states.
 *
 * @param {Object} props
 * @param {string} props.character - Character name
 * @param {string} props.text - Dialogue text
 * @param {boolean} props.revealChar - Whether to reveal character name
 * @param {boolean} props.revealText - Whether to reveal dialogue text
 * @param {boolean} props.isTarget - Whether this is the main target line
 * @param {number} props.revealGeneration - Counter incremented on each gameplay action
 */
import { useRef, useState, useEffect } from 'preact/hooks';

export function ScriptLine({ character, text, revealChar, revealText, isTarget, revealGeneration = 0 }) {
    const prevGeneration = useRef(revealGeneration);
    const [textState, setTextState] = useState(revealText ? 'revealed' : 'hidden');
    const [charState, setCharState] = useState(revealChar ? 'revealed' : 'hidden');

    // Computed once per render before effects run
    const isNewAction = revealGeneration > prevGeneration.current;

    useEffect(() => {
        if (revealText && textState === 'hidden') {
            setTextState(isNewAction ? 'wiping' : 'revealed');
        }
    }, [revealText, revealGeneration]);

    useEffect(() => {
        if (revealChar && charState === 'hidden') {
            setCharState(isNewAction ? 'wiping' : 'revealed');
        }
    }, [revealChar, revealGeneration]);

    // Update ref after the above effects have used it
    useEffect(() => {
        prevGeneration.current = revealGeneration;
    }, [revealGeneration]);

    // Character Name Rendering
    const renderCharacter = () => {
        if (isTarget) {
            // Target line: "???" when hidden, yow pop when revealing, plain when revealed
            if (charState === 'wiping') {
                return (
                    <div className="character-name">
                        <span className="yow-reveal"
                              onAnimationEnd={() => setCharState('revealed')}>
                            {character}
                        </span>
                    </div>
                );
            }
            if (charState === 'revealed') {
                return <div className="character-name">{character}</div>;
            }
            return (
                <div className="character-name">
                    <span className="character-placeholder">???</span>
                </div>
            );
        }

        // Context lines: persistent background mask
        return (
            <div className="character-name">
                <span className="text-reveal" data-state={charState}
                      onAnimationEnd={charState === 'wiping' ? () => setCharState('revealed') : undefined}>
                    <span className="text-content">{character}</span>
                </span>
            </div>
        );
    };

    // Dialogue Text Rendering
    const renderText = () => {
        if (isTarget) {
            // Target text is always revealed
            return <div className="dialogue-text">{text}</div>;
        }

        // Context lines: per-line background mask
        const lines = text.split('\n');
        return (
            <div className="dialogue-text">
                {lines.map((line, i, arr) => (
                    <span key={i}>
                        {i > 0 && '\n'}
                        <span className="text-reveal" data-state={textState}
                              onAnimationEnd={
                                  textState === 'wiping' && i === arr.length - 1
                                      ? () => setTextState('revealed')
                                      : undefined
                              }>
                            <span className="text-content">{line}</span>
                        </span>
                    </span>
                ))}
            </div>
        );
    };

    return (
        <div className={`script-line ${isTarget ? '' : 'context-line'}`}>
            {renderCharacter()}
            {renderText()}
        </div>
    );
}
