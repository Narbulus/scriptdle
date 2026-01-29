import { generateFlower, generateBeetle, stringToSeed } from '../../utils/flowerGenerator.js';

export function PackRow({ pack, theme, completion }) {
    // Badge Logic
    const renderBadge = () => {
        if (!completion || !completion.completed) return null;

        const badgeSeed = stringToSeed(pack.id + completion.date);
        const cardColor = theme?.cardGradientStart || '#cccccc';
        // Random delay 0-4s based on seed so badges sway out of sync
        const animationDelay = `${(badgeSeed % 4000) / 1000}s`;

        if (completion.success) {
            const flowerSvg = generateFlower(badgeSeed, cardColor);
            return (
                <div
                    className="pack-row-badge"
                    data-testid="pack-badge"
                    style={{ backgroundImage: `url('${flowerSvg}')`, animationDelay }}
                ></div>
            );
        } else {
            const beetleSvg = generateBeetle(badgeSeed, cardColor);
            return (
                <div
                    className="pack-row-badge beetle-badge"
                    data-testid="pack-badge"
                    style={{ backgroundImage: `url('${beetleSvg}')`, animationDelay }}
                ></div>
            );
        }
    };


    const style = theme ? {
        '--pack-card-gradient-start': theme.cardGradientStart,
        '--pack-card-gradient-end': theme.cardGradientEnd,
        '--pack-card-border': theme.cardBorder,
        '--pack-card-text': theme.cardText || theme.primary
    } : {};

    return (
        <a
            href={`/play/${pack.id}`}
            data-link
            data-theme="pack"
            data-testid="pack-row"
            className="pack-row"
            data-pack-id={pack.id}
            style={style}
        >
            <div className="pack-row-content">
                <span className="pack-row-name" data-testid="pack-name">{pack.name}</span>
                <span className="pack-row-count" data-testid="pack-count">{pack.movieCount} movies</span>
            </div>
            {renderBadge()}
        </a>
    );
}
