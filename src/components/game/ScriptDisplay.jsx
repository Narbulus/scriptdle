import { computed } from "@preact/signals";
import { useMemo } from "preact/hooks";
import { currentAttempt, isGameOver } from '../../services/game-state.js';
import { ScriptLine } from './ScriptLine.jsx';

export function ScriptDisplay({ puzzle }) {
    const target = puzzle.targetLine;
    const contextLines = puzzle.contextAfter || [];

    // Progressive reveal: Always peek next quote in shimmer
    // Context 1: Always visible from start
    const showContext1 = useMemo(() => computed(() => true), []);
    // Context 2: Visible after 2nd attempt (when context 1 fully revealed)
    const showContext2 = useMemo(() => computed(() => isGameOver.value || currentAttempt.value >= 2), []);

    const revealTargetChar = useMemo(() => computed(() => isGameOver.value), []);
    // Context 1 text revealed after 1st attempt
    const revealContext1Text = useMemo(() => computed(() => isGameOver.value || currentAttempt.value >= 1), []);
    // Context 1 character revealed after 2nd attempt
    const revealContext1Char = useMemo(() => computed(() => isGameOver.value || currentAttempt.value >= 2), []);
    // Context 2 text revealed after 3rd attempt
    const revealContext2Text = useMemo(() => computed(() => isGameOver.value || currentAttempt.value >= 3), []);
    // Context 2 character revealed after 4th attempt
    const revealContext2Char = useMemo(() => computed(() => isGameOver.value || currentAttempt.value >= 4), []);

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
