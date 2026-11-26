import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    parseDailyDate,
    evaluateDateWindow,
    isAllowedOriginRequest,
    checkRateLimit,
    onRequest,
    MAX_ARCHIVE_DAYS,
} from '../../functions/data/daily-all/[file].js';

const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130.0 Safari/537.36';

function makeRequest(filename, headers = {}, method = 'GET') {
    return new globalThis.Request(`https://scriptle.net/data/daily-all/${filename}`, {
        method,
        headers,
    });
}

describe('daily-all edge protection function', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-11-26T18:00:00Z'));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('parses valid calendar filenames and rejects malformed dates', () => {
        expect(parseDailyDate('2026-11-26.json')).toBe('2026-11-26');
        expect(parseDailyDate('2026-02-28.json')).toBe('2026-02-28');
        expect(parseDailyDate('2026-02-30.json')).toBe(null);
        expect(parseDailyDate('2026-13-01.json')).toBe(null);
        expect(parseDailyDate('../scripts/star-wars.json')).toBe(null);
        expect(parseDailyDate('packs-full.json')).toBe(null);
    });

    it('blocks future dates beyond +1d timezone buffer and old dates beyond MAX_ARCHIVE_DAYS + 1d', () => {
        const now = new Date('2026-11-26T18:00:00Z');
        expect(evaluateDateWindow('2026-11-26', now).allowed).toBe(true);
        expect(evaluateDateWindow('2026-11-27', now).allowed).toBe(true); // UTC+14 buffer
        expect(evaluateDateWindow('2026-11-28', now).allowed).toBe(false);
        expect(evaluateDateWindow('2027-01-01', now).allowed).toBe(false);
        expect(evaluateDateWindow('2030-02-12', now).allowed).toBe(false);

        // Within rolling archive window
        expect(evaluateDateWindow('2026-10-27', now)).toMatchObject({ allowed: true, isArchive: true });
        expect(evaluateDateWindow('2026-10-26', now)).toMatchObject({ allowed: true, isArchive: true }); // UTC-12 buffer
        // Beyond rolling archive window
        expect(evaluateDateWindow('2026-10-25', now).allowed).toBe(false);
        expect(evaluateDateWindow('2026-01-12', now).allowed).toBe(false);
        expect(MAX_ARCHIVE_DAYS).toBe(30);
    });

    it('allows same-origin browser fetches and blocks scrapers, direct peeks, and cross-site requests', () => {
        // Normal modern browser fetch from Scriptle
        expect(isAllowedOriginRequest(makeRequest('2026-11-26.json', {
            'User-Agent': BROWSER_UA,
            'Sec-Fetch-Site': 'same-origin',
            'Sec-Fetch-Dest': 'empty',
        })).ok).toBe(true);

        // Older Safari without Sec-Fetch-Site, with same-origin Referer
        expect(isAllowedOriginRequest(makeRequest('2026-11-26.json', {
            'User-Agent': BROWSER_UA,
            Referer: 'https://scriptle.net/play/gilmore-girls',
        })).ok).toBe(true);

        // Direct address-bar navigation in browser
        expect(isAllowedOriginRequest(makeRequest('2026-11-26.json', {
            'User-Agent': BROWSER_UA,
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-Dest': 'document',
        }))).toEqual({ ok: false, reason: 'direct_navigation' });

        // Cross-origin fetch
        expect(isAllowedOriginRequest(makeRequest('2026-11-26.json', {
            'User-Agent': BROWSER_UA,
            'Sec-Fetch-Site': 'cross-site',
            'Sec-Fetch-Dest': 'empty',
        }))).toEqual({ ok: false, reason: 'cross_origin' });

        // CLI scraper even with spoofed Referer
        expect(isAllowedOriginRequest(makeRequest('2026-11-26.json', {
            'User-Agent': 'curl/8.7.1',
            Referer: 'https://scriptle.net/',
        }))).toEqual({ ok: false, reason: 'blocked_ua' });

        expect(isAllowedOriginRequest(makeRequest('2026-11-26.json', {
            'User-Agent': 'python-requests/2.32.3',
            Referer: 'https://scriptle.net/',
        }))).toEqual({ ok: false, reason: 'blocked_ua' });

        // Authenticated internal daily-email worker
        expect(isAllowedOriginRequest(makeRequest('2026-11-26.json', {
            'X-Scriptle-Internal': 'super-secret-token',
        }), { DAILY_EMAIL_SECRET: 'super-secret-token' })).toEqual({ ok: true, internal: true });
    });

    it('enforces per-IP sliding-window burst rate limits on archive fetches', () => {
        const buckets = new Map();
        const t0 = 1_700_000_000_000;
        for (let i = 0; i < 15; i++) {
            expect(checkRateLimit('1.2.3.4', true, t0 + i * 100, buckets).allowed).toBe(true);
        }
        expect(checkRateLimit('1.2.3.4', true, t0 + 2000, buckets)).toEqual({ allowed: false, retryAfter: 60 });
        // Different IP is unaffected
        expect(checkRateLimit('5.6.7.8', true, t0 + 2000, buckets).allowed).toBe(true);
        // After 60s window passes, IP is allowed again
        expect(checkRateLimit('1.2.3.4', true, t0 + 62_000, buckets).allowed).toBe(true);
    });

    it('serves valid gated requests from ASSETS with protective headers and blocks invalid ones', async () => {
        const assetsFetch = vi.fn(async () => new globalThis.Response(JSON.stringify({ date: '2026-11-26', puzzles: {} }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        }));

        // Valid same-origin request for today
        const okRes = await onRequest({
            request: makeRequest('2026-11-26.json', {
                'User-Agent': BROWSER_UA,
                'Sec-Fetch-Site': 'same-origin',
                'CF-Connecting-IP': '10.0.0.1',
            }),
            env: { ASSETS: { fetch: assetsFetch } },
            params: { file: '2026-11-26.json' },
        });
        expect(okRes.status).toBe(200);
        expect(okRes.headers.get('Cache-Control')).toBe('private, max-age=300');
        expect(okRes.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
        expect(assetsFetch).toHaveBeenCalledTimes(1);

        // Future date blocked BEFORE hitting ASSETS
        const futureRes = await onRequest({
            request: makeRequest('2027-05-01.json', {
                'User-Agent': BROWSER_UA,
                'Sec-Fetch-Site': 'same-origin',
                'CF-Connecting-IP': '10.0.0.1',
            }),
            env: { ASSETS: { fetch: assetsFetch } },
            params: { file: '2027-05-01.json' },
        });
        expect(futureRes.status).toBe(404);
        expect(assetsFetch).toHaveBeenCalledTimes(1);

        // curl blocked BEFORE hitting ASSETS
        const curlRes = await onRequest({
            request: makeRequest('2026-11-26.json', {
                'User-Agent': 'curl/8.7.1',
            }),
            env: { ASSETS: { fetch: assetsFetch } },
            params: { file: '2026-11-26.json' },
        });
        expect(curlRes.status).toBe(403);
        expect(assetsFetch).toHaveBeenCalledTimes(1);
    });
});
