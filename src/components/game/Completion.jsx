import { guessStats, currentAttempt, isWin, confettiShown, markConfettiShown, gameMessage, showMessage, currentPackId, currentPuzzleDate } from '../../services/game-state.js';
import { getStreak } from '../../utils/completionTracker.js';
import { generateFlower, generateBeetle, stringToSeed } from '../../utils/flowerGenerator.js';
import { fireConfetti, fireGoldenSparkles, fireFlowerBurst } from '../../utils/confetti.js';
import { useEffect, useRef, useState } from 'preact/hooks';
import { getCurrentDate } from '../../utils/time.js';
import { track } from '../../utils/analytics.js';
import { StatsSection } from './StatsSection.jsx';
import { openStatsModal } from '../../pages/Stats.jsx';

export function Completion({ puzzle, pack, packTheme }) {
    const attempts = currentAttempt.value;
    const success = isWin.value;
    const streak = getStreak();
    const flowerRef = useRef(null);
    const isReddit = !!window.SCRIPTLE_SHARE_HANDLER;
    const [stats, setStats] = useState(null);
    const [playerBucket, setPlayerBucket] = useState(null);

    // Reddit stats: send GAME_COMPLETE and listen for STATS_UPDATE
    useEffect(() => {
        if (!isReddit) return;

        const bucket = success ? String(attempts) : 'fail';
        setPlayerBucket(bucket);

        // Send game completion to Devvit
        window.parent.postMessage({
            type: 'GAME_COMPLETE',
            data: {
                packId: currentPackId.value,
                date: currentPuzzleDate.value,
                won: success,
                attempts,
            },
        }, '*');

        // Listen for stats response
        const handler = (ev) => {
            const msg = ev.data?.data?.message || ev.data;
            if (msg?.type === 'STATS_UPDATE') {
                setStats(msg.data);
                setPlayerBucket(msg.data.playerResult?.bucket || bucket);
            }
        };
        window.addEventListener('message', handler);
        return () => window.removeEventListener('message', handler);
    }, []);

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

    // Fire confetti on mount if not already shown
    useEffect(() => {
        if (!confettiShown.value) {
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

            if (success) {
                // Fire confetti for wins
                fireConfetti(colors.length > 1 ? colors : null);
            }

            // Fire burst from flower/beetle for ALL completions - delay after initial confetti
            setTimeout(() => {
                if (flowerRef.current) {
                    if (isPerfectWin) {
                        // Perfect wins get the full golden sparkles treatment
                        fireGoldenSparkles(colors.length > 1 ? colors : null, flowerRef.current, true);
                    } else {
                        // Regular wins and failures get a burst from the badge
                        // Failures get much lamer confetti
                        fireFlowerBurst(flowerRef.current, false, !success);
                    }
                }
            }, 500);

            markConfettiShown();
        }
    }, [success, isPerfectWin]);

    // Badge Generation
    const renderBadge = () => {
        const today = getCurrentDate();
        const badgeSeed = stringToSeed(pack.id + today);
        const cardColor = packTheme?.cardGradientStart || '#cccccc';

        const svgUrl = success
            ? generateFlower(badgeSeed, cardColor, { golden: isPerfectWin })
            : generateBeetle(badgeSeed, cardColor);
        const wrapperClass = (success && isPerfectWin)
            ? 'completion-badge-wrapper golden-glow'
            : 'completion-badge-wrapper';

        return (
            <div className="completion-badge-col" onClick={openStatsModal} style={{ cursor: 'pointer' }}>
                <div className={wrapperClass}>
                    <div
                        ref={flowerRef}
                        className="completion-flower"
                        style={{ backgroundImage: `url('${svgUrl}')` }}
                    />
                </div>
            </div>
        );
    };

    // Share Logic
    const [hasCommented, setHasCommented] = useState(false);

    const generateEmojiRows = () => {
        let movieRow = '\uD83C\uDFAC';
        let charRow = '\uD83D\uDC64';
        const guesses = guessStats.value;

        for (let i = 0; i < 5; i++) {
            if (i < guesses.length) {
                movieRow += guesses[i].movie ? '🟢' : '⚫';
                charRow += guesses[i].char ? '🟢' : '⚫';
            } else {
                movieRow += '⚪';
                charRow += '⚪';
            }
        }
        return { movieRow, charRow };
    };

    const generateShareString = () => {
        const { movieRow, charRow } = generateEmojiRows();
        return `Scriptle - ${pack.name}\n\n${movieRow}\n${charRow}`;
    };

    const shareText = generateShareString();
    const shareUrl = window.location.href;

    const handleComment = () => {
        if (hasCommented) return;
        try {
            const { movieRow, charRow } = generateEmojiRows();
            const commentText = `${movieRow}\n${charRow}`;
            window.SCRIPTLE_SHARE_HANDLER(commentText, pack.name);
            setHasCommented(true);
        } catch (err) {
            console.error('Failed to post comment:', err);
            showMessage('Failed to post comment. Please try again.', 'error', 3000);
        }
    };

    const handleShare = () => {
        if (window.SCRIPTLE_SHARE_HANDLER) {
            return handleComment();
        }
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
            navigator.clipboard.writeText(shareText + '\n\n' + shareUrl)
                .then(() => showMessage('Copied to clipboard!', 'success', 2000))
                .catch(() => showMessage('Failed to copy. Try selecting and copying manually.', 'error', 3000));
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
        navigator.clipboard.writeText(shareText + '\n\n' + shareUrl)
            .then(() => showMessage('Copied to clipboard!', 'success', 2000))
            .catch(() => showMessage('Failed to copy. Try selecting and copying manually.', 'error', 3000));
    };

    return (
        <div id="share-container" data-testid="share-container" style={!isReddit ? { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' } : undefined}>
            {isReddit ? (
                <>
                    <div className="completion-split">
                        <div className="completion-info">
                            <h2 className="completion-title">{tierMessage}</h2>
                            <div className="completion-info-content">
                                <div className="completion-answer">
                                    It was <strong>{target.character}</strong> in <em>{target.movie}</em>
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
                                <div className="completion-row">
                                    <span className="completion-collection-btn" onClick={openStatsModal}>YOUR COLLECTION</span>
                                </div>
                            </div>
                        </div>
                        <div className="completion-stats">
                            <StatsSection stats={stats} playerBucket={playerBucket} />
                        </div>
                    </div>
                </>
            ) : (
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

                    <div className="completion-row">
                        <span className="completion-collection-btn">YOUR COLLECTION</span>
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

                        {/* Share/copy feedback message */}
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
            )}
        </div>
    );
}
