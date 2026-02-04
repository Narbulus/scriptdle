/**
 * ScriptLine Component
 * Renders a single line of dialogue with configurable masking for character and text.
 * 
 * @param {Object} props
 * @param {string} props.character - Character name
 * @param {string} props.text - Dialogue text
 * @param {boolean} props.revealChar - Whether to reveal character name
 * @param {boolean} props.revealText - Whether to reveal dialogue text
 * @param {boolean} props.isTarget - Whether this is the main target line (has different styling/behavior)
 * @param {boolean} props.animate - Whether to animate the reveal
 */
export function ScriptLine({ character, text, revealChar, revealText, isTarget, animate }) {

    // Character Name Rendering
    const renderCharacter = () => {
        if (revealChar) {
            return (
                <div className="character-name">
                    {character}
                </div>
            );
        }

        // Masked State
        if (isTarget) {
            // Target line usually has "???"
            return (
                <div className="character-name">
                    <span className="character-placeholder">???</span>
                </div>
            );
        }

        // Context lines use shimmer - render placeholder text instead of actual character
        // to prevent flash of real name during initial paint in Firefox mobile
        const placeholderText = character.replace(/[^\s]/g, '█');
        return (
            <div className="character-name">
                <span className="shimmer-text">{placeholderText}</span>
            </div>
        );
    };

    // Dialogue Text Rendering
    const renderText = () => {
        if (revealText) {
            return (
                <div className="dialogue-text">
                    {text}
                </div>
            );
        }

        // Masked State - render placeholder text instead of actual text
        // to prevent flash of real content during initial paint in Firefox mobile
        const placeholderText = text.replace(/[^\s\n]/g, '█');
        return (
            <div className="dialogue-text">
                <span className="shimmer-text">{placeholderText}</span>
            </div>
        );
    };

    return (
        <div className={`script-line ${isTarget ? '' : 'context-line'} ${animate ? 'reveal-animate' : ''}`}>
            {renderCharacter()}
            {renderText()}
        </div>
    );
}
