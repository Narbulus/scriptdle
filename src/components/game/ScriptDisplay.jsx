import { computed } from "@preact/signals";
import { currentAttempt, isGameOver } from '../../services/game-state.js';
import { ScriptLine } from './ScriptLine.jsx';

export function ScriptDisplay({ puzzle }) {
    const target = puzzle.targetLine;
    const contextLines = puzzle.contextAfter || [];

    // computed visibility states
    // computed visibility states
    const showContext1 = computed(() => isGameOver.value || currentAttempt.value >= 1);
    const showContext2 = computed(() => isGameOver.value || currentAttempt.value >= 2);

    // computed reveal states (Text/Char)
    // 0 = Target hidden
    // 1 = Context 1 Text (Attempt 1)
    // 2 = Context 1 Char, Context 2 Text (Attempt 2)
    // 3 = Context 2 Char (Attempt 3)

    const revealTargetChar = computed(() => isGameOver.value);

    // Show Context 1 after 1st failed attempt (Attempt #1)
    const revealContext1Text = computed(() => isGameOver.value || currentAttempt.value >= 1);
    const revealContext1Char = computed(() => isGameOver.value || currentAttempt.value >= 2);

    // Show Context 2 after 2nd failed attempt (Attempt #2)
    const revealContext2Text = computed(() => isGameOver.value || currentAttempt.value >= 2);
    const revealContext2Char = computed(() => isGameOver.value || currentAttempt.value >= 3);

    return (
        <div className={`script-area playing-${currentAttempt.value}`} data-theme="script" data-testid="script-area">
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
