import { generateFlower, stringToSeed } from '../../utils/flowerGenerator.js';

export function PackRow({ pack, theme, completion }) {
    // Badge Logic
    const renderBadge = () => {
        if (!completion || !completion.completed) return null;

        const badgeSeed = stringToSeed(pack.id + completion.date);
        const cardColor = theme?.cardGradientStart || '#cccccc';

        if (completion.success) {
            const flowerSvg = generateFlower(badgeSeed, cardColor);
            return (
                <div
                    className="pack-row-badge"
                    data-testid="pack-badge"
                    style={{ backgroundImage: `url('${flowerSvg}')` }}
                ></div>
            );
        } else {
            const failEmojis = ['💀', '🙊', '🤡', '🤨', '🫣'];
            const emojiIndex = badgeSeed % failEmojis.length;
            const rotation = (badgeSeed % 30) - 15;
            return (
                <div
                    className="pack-row-badge emoji-badge"
                    data-testid="pack-badge"
                    style={{ transform: `rotate(${rotation}deg)` }}
                >
                    {failEmojis[emojiIndex]}
                </div>
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
