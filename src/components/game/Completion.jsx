import { guessStats, currentAttempt, isWin, confettiShown, markConfettiShown, gameMessage, showMessage } from '../../services/game-state.js';
import { getStreak } from '../../utils/completionTracker.js';
import { generateFlower, generateBeetle, stringToSeed } from '../../utils/flowerGenerator.js';
import { fireConfetti, fireGoldenSparkles } from '../../utils/confetti.js';
import { useEffect, useRef } from 'preact/hooks';
import { getCurrentDate } from '../../utils/time.js';
import { track } from '../../utils/analytics.js';

export function Completion({ puzzle, pack, packTheme }) {
    const attempts = currentAttempt.value;
    const success = isWin.value;
    const streak = getStreak();
    const flowerRef = useRef(null);

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

    // Check if this is a perfect (1 guess) win
    const isPerfectWin = success && attempts === 1;

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

            // Extra golden sparkles for perfect wins - includes side jets + flower burst
            if (isPerfectWin && flowerRef.current) {
                fireGoldenSparkles(colors.length > 1 ? colors : null, flowerRef.current);
            }

            markConfettiShown();
        }
    }, [success, isPerfectWin]);

    // Badge Generation
    const renderBadge = () => {
        const today = getCurrentDate();
        const badgeSeed = stringToSeed(pack.id + today);
        const cardColor = packTheme?.cardGradientStart || '#cccccc';

        if (success) {
            // Golden flower for perfect wins
            const flowerSvg = generateFlower(badgeSeed, cardColor, { golden: isPerfectWin });
            const wrapperClass = isPerfectWin
                ? 'completion-badge-wrapper golden-glow'
                : 'completion-badge-wrapper';
            return (
                <div className={wrapperClass}>
                    <div
                        ref={flowerRef}
                        className="completion-flower"
                        style={{ backgroundImage: `url('${flowerSvg}')` }}
                    />
                </div>
            );
        } else {
            const beetleSvg = generateBeetle(badgeSeed, cardColor);
            return (
                <div className="completion-badge-wrapper">
                    <div
                        className="completion-flower"
                        style={{ backgroundImage: `url('${beetleSvg}')` }}
                    />
                </div>
            );
        }
    };

    // Share Logic
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

    const shareText = generateShareString();
    const shareUrl = window.location.href;

    const handleShare = () => {
        track('share_results', {
            success: success,
            attempts: attempts
        });
        const shareData = {
            title: `Scriptle: Daily ${pack.name} quote guessing game`,
            text: shareText,
            url: shareUrl
        };

        const copyToClipboard = () => {
            navigator.clipboard.writeText(shareText + '\n\n' + shareUrl);
            showMessage('Copied to clipboard!', 'success', 2000);
        };

        // Check if navigator.share can handle text (desktop browsers often only support URL)
        if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
            navigator.share(shareData).catch(copyToClipboard);
        } else {
            copyToClipboard();
        }
    };

    const handleCopy = () => {
        track('copy_results', {
            success: success,
            attempts: attempts
        });
        navigator.clipboard.writeText(shareText + '\n\n' + shareUrl);
        showMessage('Copied to clipboard!', 'success', 2000);
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

                    <a href="/" data-link className="footer-more-movies" style={{ fontSize: '0.9rem' }}>
                        More Movies
                    </a>

                    <div className="share-preview-tray">
                        <div className="share-preview-text">
                            {shareText.split('\n').map((line, i) => (
                                <div key={i}>{line || '\u00A0'}</div>
                            ))}
                        </div>
                        <div className="share-button-row">
                            <button id="share-btn" data-testid="share-button" className="share-btn-small" onClick={handleShare}>
                                Share Results
                            </button>
                            <button className="copy-button" onClick={handleCopy} aria-label="Copy to clipboard">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Copy feedback message */}
                    {gameMessage.value && (
                        <div
                            className={`message-overlay ${gameMessage.value.type}`}
                            style={{ position: 'relative', marginTop: '0.5rem' }}
                        >
                            {gameMessage.value.text}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
