import { afterEach, describe, expect, test } from 'vitest';
import { applyPackTheme, clearPackTheme } from './theme.js';

afterEach(() => {
    clearPackTheme();
});

describe('theme service', () => {
    test('applies pack theme custom properties to documentElement', () => {
        applyPackTheme({
            primary: '#FFE81F',
            bgColor: '#000000',
            containerBg: '#1a1a2e',
            accentColor: '#c41e3a',
            btnText: 'black',
            cardGradientStart: '#000000',
            cardGradientEnd: '#1a1a2e',
            cardBorder: '#FFE81F',
            cardText: '#FFE81F',
        });

        const root = document.documentElement;
        expect(root.style.getPropertyValue('--pack-primary')).toBe('#FFE81F');
        expect(root.style.getPropertyValue('--pack-bg')).toBe('#000000');
        expect(root.style.getPropertyValue('--pack-surface')).toBe('#1a1a2e');
        expect(root.style.getPropertyValue('--pack-accent')).toBe('#c41e3a');
        expect(root.style.getPropertyValue('--pack-btn-text')).toBe('black');
        expect(root.style.getPropertyValue('--pack-card-border')).toBe('#FFE81F');
        expect(root.style.getPropertyValue('--pack-card-text')).toBe('#FFE81F');
    });

    test('falls back to sensible defaults for omitted fields', () => {
        applyPackTheme({ primary: '#d4af37', bgColor: '#1a2412' });

        const root = document.documentElement;
        expect(root.style.getPropertyValue('--pack-primary')).toBe('#d4af37');
        expect(root.style.getPropertyValue('--pack-bg')).toBe('#1a2412');
        expect(root.style.getPropertyValue('--pack-btn-text')).toBe('#ffffff');
        expect(root.style.getPropertyValue('--pack-card-border')).toBe('#d4af37');
    });

    test('clearPackTheme removes all pack variables and pack-page class', () => {
        document.documentElement.classList.add('pack-page');
        applyPackTheme({ primary: '#d4af37', bgColor: '#1a2412' });

        clearPackTheme();

        const root = document.documentElement;
        expect(root.style.getPropertyValue('--pack-primary')).toBe('');
        expect(root.style.getPropertyValue('--pack-bg')).toBe('');
        expect(root.classList.contains('pack-page')).toBe(false);
    });

    test('ignores null or undefined theme safely', () => {
        expect(() => applyPackTheme(null)).not.toThrow();
        expect(() => applyPackTheme(undefined)).not.toThrow();
    });
});
