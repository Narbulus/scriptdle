import { computed } from "@preact/signals";
import { useMemo } from "preact/hooks";
import { currentAttempt, isGameOver } from '../../services/game-state.js';
import { ScriptLine } from './ScriptLine.jsx';

export function ScriptDisplay({ puzzle }) {
    const target = puzzle.targetLine;
    const contextLines = puzzle.contextAfter || [];

    // Always show next context line (in shimmer state as a peek)
    // Context 1: Always visible, text revealed after 1st attempt
    const showContext1 = useMemo(() => computed(() => true), []);
    // Context 2: Visible after 1st attempt (peek), text revealed after 2nd attempt
    const showContext2 = useMemo(() => computed(() => isGameOver.value || currentAttempt.value >= 1), []);

    const revealTargetChar = useMemo(() => computed(() => isGameOver.value), []);
    const revealContext1Text = useMemo(() => computed(() => isGameOver.value || currentAttempt.value >= 1), []);
    const revealContext1Char = useMemo(() => computed(() => isGameOver.value || currentAttempt.value >= 2), []);
    const revealContext2Text = useMemo(() => computed(() => isGameOver.value || currentAttempt.value >= 2), []);
    const revealContext2Char = useMemo(() => computed(() => isGameOver.value || currentAttempt.value >= 3), []);

    return (
        <div className={`script-area playing-${currentAttempt.value}`} data-theme="script" data-testid="script-area">
            <div className="script-content">
                <div id="script-display" data-testid="script-display">

                    <ScriptLine
                        character={target.character}
                        text={target.text}
                        revealChar={revealTargetChar.value}
                        revealText={true}
                        isTarget={true}
                    />

                    {contextLines.length > 0 && showContext1.value && (
                        <ScriptLine
                            character={contextLines[0].character}
                            text={contextLines[0].text}
                            revealChar={revealContext1Char.value}
                            revealText={revealContext1Text.value}
                            isTarget={false}
                            animate={true}
                        />
                    )}

                    {contextLines.length > 1 && showContext2.value && (
                        <ScriptLine
                            character={contextLines[1].character}
                            text={contextLines[1].text}
                            revealChar={revealContext2Char.value}
                            revealText={revealContext2Text.value}
                            isTarget={false}
                            animate={true}
                        />
                    )}

                </div>
            </div>
        </div>
    );
}
