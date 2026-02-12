import { computed } from "@preact/signals";
import { useMemo, useRef, useState, useEffect, useLayoutEffect, useCallback } from "preact/hooks";
import { currentAttempt, isGameOver, revealGeneration } from '../../services/game-state.js';
import { ScriptLine } from './ScriptLine.jsx';

function isReddit() {
    return typeof window !== 'undefined' && !!window.SCRIPTLE_SHARE_HANDLER;
}

function ScriptToggleButton({ scrollRef }) {
    const [canScrollDown, setCanScrollDown] = useState(false);
    const [footerHidden, setFooterHidden] = useState(false);
    const gameOver = isGameOver.value;

    const updateScrollState = useCallback(() => {
        const el = scrollRef.current;
        if (!el) return;
        const hasOverflow = el.scrollHeight > el.clientHeight + 4;
        setCanScrollDown(hasOverflow && el.scrollTop + el.clientHeight < el.scrollHeight - 4);
    }, []);

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
    }, [updateScrollState]);

    // Re-check after renders (content changes)
    useEffect(() => { updateScrollState(); });

    if (gameOver) {
        // After completion: single button toggles footer visibility
        const toggle = () => {
            const gameArea = document.getElementById('game-area');
            const footer = gameArea?.querySelector('.game-footer');
            if (!gameArea || !footer) return;
            const willHide = !footerHidden;
            // Cancel the keyframe animation so inline max-height takes effect
            footer.style.animation = 'none';
            if (willHide) {
                // Measure how much space the script content needs
                const scriptContent = scrollRef.current?.querySelector('.script-content');
                const navBar = gameArea.querySelector('.reddit-nav-bar');
                const navHeight = navBar ? navBar.offsetHeight : 0;
                const scriptHeight = scriptContent ? scriptContent.scrollHeight : 0;
                const viewportHeight = gameArea.offsetHeight;
                const remainingForFooter = Math.max(0, viewportHeight - navHeight - scriptHeight);
                // Set current height first so transition has a start point
                footer.style.maxHeight = footer.offsetHeight + 'px';
                footer.offsetHeight;
                footer.style.maxHeight = remainingForFooter + 'px';
            } else {
                // Animate back to full size
                const currentHeight = footer.offsetHeight;
                footer.style.maxHeight = currentHeight + 'px';
                footer.offsetHeight;
                footer.style.maxHeight = '100vh';
            }
            setFooterHidden(willHide);
        };

        return (
            <button
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
        // At bottom or no overflow — show up arrow if there's something to scroll back to
        const el = scrollRef.current;
        const canScrollUp = el && el.scrollTop > 4;
        if (!canScrollUp) return null;

        return (
            <button
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

    // Progressive reveal: Always peek next quote in shimmer
    // Context 1: Always visible from start
    const showContext1 = useMemo(() => computed(() => true), []);
    // Context 2: In Reddit mode, always render (but text hidden until attempt 2).
    // In web mode, visible after 2nd attempt.
    const showContext2 = useMemo(() => computed(() => isReddit() || isGameOver.value || currentAttempt.value >= 2), []);

    const revealTargetChar = useMemo(() => computed(() => isGameOver.value), []);
    // Context 1 text revealed after 1st attempt
    const revealContext1Text = useMemo(() => computed(() => isGameOver.value || currentAttempt.value >= 1), []);
    // Context 1 character revealed after 2nd attempt
    const revealContext1Char = useMemo(() => computed(() => isGameOver.value || currentAttempt.value >= 2), []);
    // Context 2 text revealed after 3rd attempt
    const revealContext2Text = useMemo(() => computed(() => isGameOver.value || currentAttempt.value >= 3), []);
    // Context 2 character revealed after 4th attempt
    const revealContext2Char = useMemo(() => computed(() => isGameOver.value || currentAttempt.value >= 4), []);

    // Only animate context2 entrance when it first appears due to gameplay action (web only)
    const prevShowContext2 = useRef(showContext2.value);
    const prevGenRef = useRef(revealGeneration.value);
    const [animateContext2, setAnimateContext2] = useState(false);

    useLayoutEffect(() => {
        if (isReddit()) return; // No entrance animation in Reddit mode
        const isNewAction = revealGeneration.value > prevGenRef.current;
        if (isNewAction && !prevShowContext2.current && showContext2.value && !isGameOver.value) {
            setAnimateContext2(true);
        }
        prevShowContext2.current = showContext2.value;
        prevGenRef.current = revealGeneration.value;
    }, [showContext2.value, revealGeneration.value]);

    // Auto-scroll to bottom when 3rd line text is revealed (Reddit only)
    useEffect(() => {
        if (!isReddit()) return;
        if (revealContext2Text.value && scrollRef.current) {
            scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
        }
    }, [revealContext2Text.value]);

    // Scroll back to top on game over (Reddit only)
    useEffect(() => {
        if (!isReddit()) return;
        if (isGameOver.value && scrollRef.current) {
            scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, [isGameOver.value]);

    const scriptContent = (
        <div id="script-display" data-testid="script-display">

            <ScriptLine
                character={target.character}
                text={target.text}
                revealChar={revealTargetChar.value}
                revealText={true}
                isTarget={true}
                revealGeneration={revealGeneration.value}
            />

            {contextLines.length > 0 && showContext1.value && (
                <ScriptLine
                    character={contextLines[0].character}
                    text={contextLines[0].text}
                    revealChar={revealContext1Char.value}
                    revealText={revealContext1Text.value}
                    isTarget={false}
                    revealGeneration={revealGeneration.value}
                />
            )}

            {contextLines.length > 1 && showContext2.value && (
                <div className={animateContext2 ? 'clue-peek-enter' : ''}>
                    <ScriptLine
                        character={contextLines[1].character}
                        text={contextLines[1].text}
                        revealChar={revealContext2Char.value}
                        revealText={revealContext2Text.value}
                        isTarget={false}
                        revealGeneration={revealGeneration.value}
                    />
                </div>
            )}

        </div>
    );

    if (isReddit()) {
        return (
            <div className={`script-area playing-${currentAttempt.value}`} data-theme="script" data-testid="script-area">
                <div className="script-scroll-wrapper">
                    <div className="script-scroll-inner" ref={scrollRef}>
                        <div className="script-content">
                            {scriptContent}
                        </div>
                    </div>
                    <ScriptToggleButton scrollRef={scrollRef} />
                </div>
            </div>
        );
    }

    return (
        <div className={`script-area playing-${currentAttempt.value}`} data-theme="script" data-testid="script-area">
            <div className="script-content">
                {scriptContent}
            </div>
        </div>
    );
}
