import { computed } from "@preact/signals";
import { useMemo, useRef, useState, useEffect, useCallback } from "preact/hooks";
import { currentAttempt, isGameOver, revealGeneration } from '../../services/game-state.js';
import { ScriptLine } from './ScriptLine.jsx';

function ScriptToggleButton({ scrollRef }) {
    const [canScrollDown, setCanScrollDown] = useState(false);
    const [canScrollUp, setCanScrollUp] = useState(false);
    const [footerHidden, setFooterHidden] = useState(false);
    const gameOver = isGameOver.value;

    const updateScrollState = useCallback(() => {
        const el = scrollRef.current;
        if (!el) return;
        const hasOverflow = el.scrollHeight > el.clientHeight + 4;
        setCanScrollDown(hasOverflow && el.scrollTop + el.clientHeight < el.scrollHeight - 4);
        setCanScrollUp(el.scrollTop > 4);
    }, [scrollRef]);

    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        updateScrollState();
        el.addEventListener('scroll', updateScrollState, { passive: true });
        const ro = new ResizeObserver(updateScrollState);
        ro.observe(el);
        return () => {
            el.removeEventListener('scroll', updateScrollState);
            ro.disconnect();
        };
    }, [scrollRef, updateScrollState]);

    // Re-check after renders (content changes)
    useEffect(() => { updateScrollState(); });

    // Reset drawer inline styles if game state resets (e.g., DebugMenu clear)
    useEffect(() => {
        if (!gameOver) {
            setFooterHidden(false);
            const footer = document.querySelector('#game-area .game-footer');
            if (footer) {
                footer.style.animation = '';
                footer.style.maxHeight = '';
            }
        }
    }, [gameOver]);

    if (gameOver) {
        // After completion: single button toggles completion drawer visibility
        const toggle = () => {
            const gameArea = document.getElementById('game-area');
            const footer = gameArea?.querySelector('.game-footer');
            const gameContainer = footer?.parentElement;
            if (!gameContainer || !footer) return;
            const willHide = !footerHidden;
            // Cancel the keyframe animation so inline max-height takes effect
            footer.style.animation = 'none';
            if (willHide) {
                const scriptContent = scrollRef.current?.querySelector('.script-content');
                const scriptHeight = scriptContent ? scriptContent.scrollHeight : 0;
                const availableHeight = gameContainer.clientHeight;
                const remainingForFooter = Math.max(0, availableHeight - scriptHeight);
                // Set current height first so transition has a start point
                footer.style.maxHeight = footer.offsetHeight + 'px';
                footer.offsetHeight;
                footer.style.maxHeight = remainingForFooter + 'px';
            } else {
                const currentHeight = footer.offsetHeight;
                footer.style.maxHeight = currentHeight + 'px';
                footer.offsetHeight;
                footer.style.maxHeight = '100dvh';
            }
            setFooterHidden(willHide);
        };

        return (
            <button
                type="button"
                className="script-scroll-btn script-scroll-down"
                onClick={toggle}
                aria-label={footerHidden ? 'Show completion stats' : 'Show full script'}
            >
                {footerHidden ? '▲' : '▼'}
            </button>
        );
    }

    // During gameplay: toggle between scroll to bottom / scroll to top
    if (!canScrollDown) {
        if (!canScrollUp) return null;

        return (
            <button
                type="button"
                className="script-scroll-btn script-scroll-down"
                onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
                aria-label="Scroll script up"
            >
                ▲
            </button>
        );
    }

    return (
        <button
            type="button"
            className="script-scroll-btn script-scroll-down"
            onClick={() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })}
            aria-label="Scroll script down"
        >
            ▼
        </button>
    );
}

export function ScriptDisplay({ puzzle }) {
    const target = puzzle.targetLine;
    const contextLines = puzzle.contextAfter || [];
    const scrollRef = useRef(null);

    const revealTargetChar = useMemo(() => computed(() => isGameOver.value), []);
    // Context 1 text revealed after 1st attempt
    const revealContext1Text = useMemo(() => computed(() => isGameOver.value || currentAttempt.value >= 1), []);
    // Context 1 character revealed after 2nd attempt
    const revealContext1Char = useMemo(() => computed(() => isGameOver.value || currentAttempt.value >= 2), []);
    // Context 2 text revealed after 3rd attempt
    const revealContext2Text = useMemo(() => computed(() => isGameOver.value || currentAttempt.value >= 3), []);
    // Context 2 character revealed after 4th attempt
    const revealContext2Char = useMemo(() => computed(() => isGameOver.value || currentAttempt.value >= 4), []);

    // Auto-scroll to bottom when the third line is revealed
    useEffect(() => {
        if (revealContext2Text.value && scrollRef.current) {
            scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
        }
    }, [revealContext2Text.value]);

    // Scroll back to the answer on game over
    useEffect(() => {
        if (isGameOver.value && scrollRef.current) {
            scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, [isGameOver.value]);

    return (
        <div className="script-area foxed" data-theme="script" data-testid="script-area">
            <div className="script-scroll-wrapper">
                <div className="script-scroll-inner" ref={scrollRef}>
                    <div className="script-content">
                        <div id="script-display" data-testid="script-display">
                            <ScriptLine
                                character={target.character}
                                text={target.text}
                                revealChar={revealTargetChar.value}
                                revealText={true}
                                isTarget={true}
                                revealGeneration={revealGeneration.value}
                            />

                            {contextLines.length > 0 && (
                                <ScriptLine
                                    character={contextLines[0].character}
                                    text={contextLines[0].text}
                                    revealChar={revealContext1Char.value}
                                    revealText={revealContext1Text.value}
                                    isTarget={false}
                                    revealGeneration={revealGeneration.value}
                                    distance={1}
                                />
                            )}

                            {contextLines.length > 1 && (
                                <ScriptLine
                                    character={contextLines[1].character}
                                    text={contextLines[1].text}
                                    revealChar={revealContext2Char.value}
                                    revealText={revealContext2Text.value}
                                    isTarget={false}
                                    revealGeneration={revealGeneration.value}
                                    distance={2}
                                />
                            )}
                        </div>
                    </div>
                </div>
                <ScriptToggleButton scrollRef={scrollRef} />
            </div>
        </div>
    );
}
