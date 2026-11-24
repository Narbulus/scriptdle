const DEFAULT_THEME = {
    primary: '#333333',
    bgColor: '#f4f4f4',
    containerBg: '#ffffff',
    accentColor: '#555555',
    btnText: '#ffffff',
    muted: '#999999',
};

const PACK_CSS_VARS = [
    '--pack-primary',
    '--pack-bg',
    '--pack-surface',
    '--pack-accent',
    '--pack-btn-text',
    '--pack-text',
    '--pack-text-secondary',
    '--pack-text-muted',
    '--pack-card-gradient-start',
    '--pack-card-gradient-end',
    '--pack-card-border',
    '--pack-card-text',
    // Also clean any early-boot inline overrides set by index.html
    '--primary-color',
    '--bg-color',
    '--container-bg',
    '--accent-color',
    '--btn-text',
];

/**
 * Apply a pack's theme CSS custom properties to the document root.
 * Shared by both the main website (Play.jsx) and Reddit embed (reddit-entry.jsx).
 */
export function applyPackTheme(theme) {
    if (!theme || typeof document === 'undefined') return;
    const t = { ...DEFAULT_THEME, ...theme };
    const root = document.documentElement;

    root.style.setProperty('--pack-primary', t.primary);
    root.style.setProperty('--pack-bg', t.bgColor);
    root.style.setProperty('--pack-surface', t.containerBg);
    root.style.setProperty('--pack-accent', t.accentColor);
    root.style.setProperty('--pack-btn-text', t.btnText);
    root.style.setProperty('--pack-text', t.primary);
    root.style.setProperty('--pack-text-secondary', t.accentColor);
    root.style.setProperty('--pack-text-muted', t.muted);

    root.style.setProperty('--pack-card-gradient-start', t.cardGradientStart || t.bgColor);
    root.style.setProperty('--pack-card-gradient-end', t.cardGradientEnd || t.bgColor);
    root.style.setProperty('--pack-card-border', t.cardBorder || t.primary);
    root.style.setProperty('--pack-card-text', t.cardText || '#ffffff');
}

/**
 * Remove pack-specific inline CSS variables when leaving a pack page.
 */
export function clearPackTheme() {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    PACK_CSS_VARS.forEach((varName) => root.style.removeProperty(varName));
    root.classList.remove('pack-page');
}
