import { signal, effect } from "@preact/signals";

export const themeMode = signal('main'); // 'main' | 'pack'
export const currentPackTheme = signal(null); // { primary, bgColor, ... }

const DEFAULT_THEME = {
    primary: '#333333',
    bgColor: '#f4f4f4',
    containerBg: '#ffffff',
    accentColor: '#555555',
    btnText: '#ffffff',
    muted: '#999999'
};

export function setMainTheme() {
    themeMode.value = 'main';
    currentPackTheme.value = null;
}

export function setPackTheme(themeData) {
    themeMode.value = 'pack';
    currentPackTheme.value = { ...DEFAULT_THEME, ...themeData };
}

effect(() => {
    const mode = themeMode.value;
    document.body.setAttribute('data-theme', mode);

    if (mode === 'pack' && currentPackTheme.value) {
        const t = currentPackTheme.value;
        const root = document.documentElement;

        // Apply CSS variables
        root.style.setProperty('--pack-primary', t.primary);
        root.style.setProperty('--pack-bg', t.bgColor);
        root.style.setProperty('--pack-surface', t.containerBg);
        root.style.setProperty('--pack-accent', t.accentColor);
        root.style.setProperty('--pack-btn-text', t.btnText);
        root.style.setProperty('--pack-text', t.primary);
        root.style.setProperty('--pack-text-secondary', t.accentColor);
        root.style.setProperty('--pack-text-muted', t.muted || DEFAULT_THEME.muted);

        // Pack card variations
        root.style.setProperty('--pack-card-gradient-start', t.cardGradientStart || t.bgColor);
        root.style.setProperty('--pack-card-gradient-end', t.cardGradientEnd || t.bgColor);
        root.style.setProperty('--pack-card-border', t.cardBorder || t.primary);
        root.style.setProperty('--pack-card-text', t.cardText || '#ffffff');
    } else {
        const root = document.documentElement;
        const vars = [
            '--pack-primary', '--pack-bg', '--pack-surface', '--pack-accent',
            '--pack-btn-text', '--pack-text', '--pack-text-secondary', '--pack-text-muted',
            '--pack-card-gradient-start', '--pack-card-gradient-end', '--pack-card-border', '--pack-card-text'
        ];
        vars.forEach(v => root.style.removeProperty(v));
    }
});
