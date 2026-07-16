import { getSettings, saveSettings } from './storage.js';

export function applyStoredSettings() {
    applyReducedMotion(!!getSettings().reducedMotion);
}

export function setReducedMotion(enabled) {
    saveSettings({ ...getSettings(), reducedMotion: enabled });
    applyReducedMotion(enabled);
}

function applyReducedMotion(enabled) {
    document.documentElement.toggleAttribute('data-reduced-motion', enabled);
}
