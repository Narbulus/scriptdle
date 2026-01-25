import { computed } from "@preact/signals";
import { currentAttempt, isGameOver, isWin } from '../../services/game-state.js';
import { ScriptLine } from './ScriptLine.jsx';

export function ScriptDisplay({ puzzle }) {
    const target = puzzle.targetLine;
    const contextLines = puzzle.contextAfter || [];

    // computed visibility states
    const showContext1 = computed(() => isGameOver.value || currentAttempt.value >= 1);
    const showContext2 = computed(() => isGameOver.value || currentAttempt.value >= 3);

    // computed reveal states (Text/Char)
    const revealTargetChar = computed(() => isGameOver.value);

    const revealContext1Text = computed(() => isGameOver.value || currentAttempt.value >= 1);
    const revealContext1Char = computed(() => isGameOver.value || currentAttempt.value >= 2);

    const revealContext2Text = computed(() => isGameOver.value || currentAttempt.value >= 3);
    const revealContext2Char = computed(() => isGameOver.value || currentAttempt.value >= 4);

    return (
        <div className="script-area" data-theme="script" data-testid="script-area">
            <div className="script-content">
                <div id="script-display" data-testid="script-display">

                    {/* Target Line - Always Visible */}
                    <ScriptLine
                        character={target.character}
                        text={target.text}
                        revealChar={revealTargetChar.value}
                        revealText={true}
                        isTarget={true}
                    />

                    {/* Context Line 1 */}
                    {contextLines.length > 0 && showContext1.value && (
                        <ScriptLine
                            character={contextLines[0].character}
                            text={contextLines[0].text}
                            revealChar={revealContext1Char.value}
                            revealText={revealContext1Text.value}
                            isTarget={false}
                            animate={true} // Simple fade-in via CSS class
                        />
                    )}

                    {/* Context Line 2 */}
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
