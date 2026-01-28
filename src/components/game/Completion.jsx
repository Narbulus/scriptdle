import { computed } from "@preact/signals";
import { guessStats, currentAttempt, isWin, confettiShown, markConfettiShown } from '../../services/game-state.js';
import { getStreak } from '../../utils/completionTracker.js';
import { generateFlower, stringToSeed } from '../../utils/flowerGenerator.js';
import { fireConfetti } from '../../utils/confetti.js';
import { useEffect } from 'preact/hooks';
import { getCurrentDate } from '../../utils/time.js';
import { track } from '../../utils/analytics.js';

export function Completion({ puzzle, pack, packTheme }) {
    const attempts = currentAttempt.value;
    const success = isWin.value;
    const streak = getStreak();

    // Tier Message
    const tierMessages = pack.tierMessages || {};
    const tierMessage = getTierMessage(success, attempts, tierMessages);

    function getTierMessage(isSuccess, attemptCount, messages) {
        if (!isSuccess) {
            return messages.failure || 'Game Over';
        }
        switch (attemptCount) {
            case 1: return messages.perfect || 'Puzzle Completed!';
            case 2: return messages.good || 'Puzzle Completed!';
            case 3: return messages.average || 'Puzzle Completed!';
            default: return messages.barely || 'Puzzle Completed!';
        }
    }

    // Answer Text
    const target = puzzle.targetLine;

    // Fire confetti on mount if win and not already shown
    useEffect(() => {
        if (success && !confettiShown.value) {
            // Determine colors
            const theme = packTheme || {};
            const colors = [
                theme.primary,
                theme.secondary,
                theme.accentColor,
                theme.cardGradientStart,
                theme.cardGradientEnd,
                '#ffffff'
            ].filter(Boolean);

            fireConfetti(colors.length > 1 ? colors : null);
            markConfettiShown();
        }
    }, [success]);

    // Badge Generation
    const renderBadge = () => {
        const today = getCurrentDate();
        const badgeSeed = stringToSeed(pack.id + today);
        const cardColor = packTheme?.cardGradientStart || '#cccccc';

        if (success) {
            const flowerSvg = generateFlower(badgeSeed, cardColor);
            return (
                <div className="completion-badge-wrapper">
                    <div
                        className="completion-flower"
                        style={{ backgroundImage: `url('${flowerSvg}')` }}
                    />
                </div>
            );
        } else {
            const failEmojis = ['💀', '🙊', '🤡', '🤨', '🫣'];
            const emojiIndex = badgeSeed % failEmojis.length;
            return (
                <div
                    className="completion-flower emoji-badge"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '4rem' }}
                >
                    {failEmojis[emojiIndex]}
                </div>
            );
        }
    };

    // Share Logic
    const handleShare = () => {
        const grid = generateShareString();
        track('share_results', {
            pack_id: pack.id,
            success: success,
            attempts: attempts
        });
        const url = window.location.href;
        const shareData = {
            title: `Scriptle - ${pack.name}`,
            text: grid + '\n\n' + url,
            url: url
        };

        if (navigator.share) {
            navigator.share(shareData).catch(() => {
                // Fallback to clipboard
                navigator.clipboard.writeText(shareData.text);
                alert('Result copied to clipboard!');
            });
        } else {
            navigator.clipboard.writeText(shareData.text);
            alert('Result copied to clipboard!');
        }
    };

    const generateShareString = () => {
        let grid = `Scriptle - ${pack.name}\n\n`;
        let movieRow = '';
        let charRow = '';
        const stats = guessStats.value;

        for (let i = 0; i < 5; i++) {
            if (i < stats.length) {
                movieRow += stats[i].movie ? '🟢' : '⚫';
                charRow += stats[i].char ? '🟢' : '⚫';
            } else {
                movieRow += '⚪';
                charRow += '⚪';
            }
        }
        grid += movieRow + '\n' + charRow;
        return grid;
    };

    return (
        <div id="share-container" data-testid="share-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <div className="completion-content">
                <div className="completion-header">
                    <h2 className="completion-title">{tierMessage}</h2>
                    <div className="completion-answer">
                        It was <strong>{target.character}</strong> in <br /><em>{target.movie}</em>
                    </div>
                </div>

                <div className="completion-row">
                    <div className="stat-box">
                        <div className="stat-value">{streak}</div>
                        <div className="stat-label">Day Streak</div>
                    </div>

                    {renderBadge()}

                    <div className="stat-box">
                        <div className="stat-value">{guessStats.value.length}/5</div>
                        <div className="stat-label">Attempts</div>
                    </div>
                </div>

                <div className="share-section">
                    <button id="share-btn" data-testid="share-button" onClick={handleShare}>
                        Share Results
                    </button>

                    {puzzle.imdbId && (
                        <a
                            href={`https://www.imdb.com/title/${puzzle.imdbId}/`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="movie-imdb-link"
                        >
                            View on IMDB
                        </a>
                    )}

                    <a href="/" data-link className="footer-more-movies" style={{ marginTop: '1rem', fontSize: '0.9rem' }}>
                        Back to Menu
                    </a>
                </div>
            </div>
        </div>
    );
}
