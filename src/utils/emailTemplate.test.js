import { describe, it, expect } from 'vitest';
import { formatQuoteSubject, buildDailyEmail } from './emailTemplate.js';

describe('emailTemplate', () => {
    it('uses only the quote as the email subject without pack name', () => {
        const subject = formatQuoteSubject('How extraordinarily like your father you are, Potter.');
        expect(subject).toBe('“How extraordinarily like your father you are, Potter.”');
        expect(subject.toLowerCase()).not.toContain('scriptle');
        expect(subject.toLowerCase()).not.toContain('harry potter');
    });

    it('truncates long quotes cleanly on word boundaries', () => {
        const longQuote = 'I am not in danger, Skyler. I am the danger. A guy opens his door and gets shot and you think that of me? No. I am the one who knocks!';
        const subject = formatQuoteSubject(longQuote, 80);
        expect(subject.length).toBeLessThanOrEqual(82);
        expect(subject.endsWith('…”')).toBe(true);
    });

    it('builds a full Resend payload with Scriptle sender, quote subject, and 1-click unsubscribe', () => {
        const msg = buildDailyEmail({
            to: 'fan@example.com',
            packId: 'harry-potter',
            packName: 'Harry Potter',
            packTheme: { bgColor: '#2a0505', primary: '#d4af37', btnText: '#1a0a0a' },
            quoteText: 'Always.',
            unsubscribeToken: 'tok-123',
        });

        expect(msg.from).toBe('Scriptle <daily@scriptle.net>');
        expect(msg.subject).toBe('“Always.”');
        expect(msg.html).toContain('https://scriptle.net/play/harry-potter?utm_source=daily_email');
        expect(msg.html).toContain('https://scriptle.net/api/unsubscribe?token=tok-123');
        expect(msg.headers['List-Unsubscribe']).toBe('<https://scriptle.net/api/unsubscribe?token=tok-123>');
        expect(msg.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
    });
});
