import { generateFlower, generateBeetle, stringToSeed } from '../../utils/flowerGenerator.js';
import { getMediaLabels } from '../../utils/mediaLabels.js';

export function PackRow({ pack, theme, completion }) {
    const isCompleted = Boolean(completion?.completed);
    const labels = getMediaLabels(pack?.mediaType);

    const renderBadge = () => {
        if (!isCompleted) {
            return <span className="pack-row-chevron" aria-hidden="true">&rsaquo;</span>;
        }

        const badgeSeed = stringToSeed(pack.id + completion.date);
        const cardColor = theme?.cardGradientStart || '#cccccc';
        // Random delay 0-4s based on seed so badges sway out of sync
        const animationDelay = `${(badgeSeed % 4000) / 1000}s`;

        if (completion.success) {
            const isPerfectWin = completion.attempts === 1;
            const flowerSvg = generateFlower(badgeSeed, cardColor, { golden: isPerfectWin });
            const wrapperClass = isPerfectWin ? 'pack-row-badge-wrapper golden-glow' : 'pack-row-badge-wrapper';
            return (
                <div className={wrapperClass}>
                    <div
                        className="pack-row-badge"
                        data-testid="pack-badge"
                        style={{ backgroundImage: `url('${flowerSvg}')`, animationDelay }}
                    />
                </div>
            );
        }

        const beetleSvg = generateBeetle(badgeSeed, cardColor);
        return (
            <div className="pack-row-badge-wrapper">
                <div
                    className="pack-row-badge beetle-badge"
                    data-testid="pack-badge"
                    style={{ backgroundImage: `url('${beetleSvg}')`, animationDelay }}
                />
            </div>
        );
    };

    const style = theme ? {
        '--pack-card-gradient-start': theme.cardGradientStart,
        '--pack-card-gradient-end': theme.cardGradientEnd,
        '--pack-card-border': theme.cardBorder,
        '--pack-card-text': theme.cardText || theme.primary,
    } : {};

    return (
        <a
            href={`/play/${pack.id}`}
            data-link
            data-theme="pack"
            data-testid="pack-row"
            className={`pack-row${isCompleted ? ' is-completed' : ''}`}
            data-pack-id={pack.id}
            style={style}
        >
            <div className="pack-row-content">
                <span className="pack-row-name" data-testid="pack-name">{pack.name}</span>
                <span className="pack-row-count" data-testid="pack-count">
                    {pack.movieCount} {pack.movieCount === 1 ? labels.singular : labels.plural}
                </span>
            </div>
            {renderBadge()}
        </a>
    );
}
