/**
 * Cloudflare Pages Function: GET /data/daily-all/:file
 *
 * Edge gate protecting curated daily puzzle archives from bulk scraping and
 * future-date spoofing while keeping gameplay seamless for real players:
 *   1. Strict YYYY-MM-DD.json calendar filename validation
 *   2. Hard-blocks all future dates (> todayUTC + 1d timezone buffer)
 *   3. Bounds rolling archive lookback to MAX_ARCHIVE_DAYS (30 days + 1d buffer)
 *   4. Requires same-origin browser fetch (blocks direct URL peeking, hotlinking,
 *      and CLI scrapers) with an internal header bypass for workers/daily-email
 *   5. Lightweight per-IP sliding-window burst rate limit
 */

export const EARLIEST_PUZZLE_DATE = '2026-01-12';
export const MAX_ARCHIVE_DAYS = 30;

const DATE_FILE_RE = /^(\d{4})-(\d{2})-(\d{2})\.json$/;
const BLOCKED_UA_RE = /^(?:curl|wget|python-requests|python-urllib|aiohttp|httpx|scrapy|go-http-client|libwww-perl|httpie|node-fetch|undici)\b/i;

const RATE_WINDOW_MS = 60_000;
const ARCHIVE_MAX_PER_WINDOW = 15;
const CURRENT_MAX_PER_WINDOW = 60;
const MAX_TRACKED_IPS = 1000;

// In-memory sliding-window buckets per isolate: key -> array of timestamps (ms)
const rateBuckets = new Map();

export function formatUtcDate(date) {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

export function shiftUtcDate(now, deltaDays) {
    const shifted = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + deltaDays
    ));
    return formatUtcDate(shifted);
}

/**
 * Parse a filename like "2026-11-26.json" and verify it is a real calendar date.
 */
export function parseDailyDate(filename) {
    if (!filename || typeof filename !== 'string') return null;
    const match = DATE_FILE_RE.exec(filename);
    if (!match) return null;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const utc = new Date(Date.UTC(year, month - 1, day));
    const normalized = formatUtcDate(utc);
    const candidate = `${match[1]}-${match[2]}-${match[3]}`;
    return normalized === candidate ? candidate : null;
}

/**
 * Check whether dateStr falls within the allowed rolling window relative to `now`:
 *   [max(EARLIEST_PUZZLE_DATE, todayUTC - (MAX_ARCHIVE_DAYS + 1)), todayUTC + 1]
 */
export function evaluateDateWindow(dateStr, now = new Date()) {
    const maxDate = shiftUtcDate(now, 1); // UTC+14 timezone buffer
    const rollingMin = shiftUtcDate(now, -(MAX_ARCHIVE_DAYS + 1)); // UTC-12 buffer + archive window
    const minDate = rollingMin > EARLIEST_PUZZLE_DATE ? rollingMin : EARLIEST_PUZZLE_DATE;
    const currentFloor = shiftUtcDate(now, -1);

    const allowed = dateStr >= minDate && dateStr <= maxDate;
    const isArchive = dateStr < currentFloor;
    return { allowed, isArchive, minDate, maxDate };
}

/**
 * Verify that the request comes from our own web app in a browser (or our
 * authenticated internal daily-email worker).
 */
export function isAllowedOriginRequest(request, env = {}) {
    const internalSecret = env?.DAILY_EMAIL_SECRET;
    if (internalSecret && request.headers.get('X-Scriptle-Internal') === internalSecret) {
        return { ok: true, internal: true };
    }

    const ua = (request.headers.get('User-Agent') || '').trim();
    if (!ua || BLOCKED_UA_RE.test(ua)) {
        return { ok: false, reason: 'blocked_ua' };
    }

    const secFetchDest = (request.headers.get('Sec-Fetch-Dest') || '').toLowerCase();
    if (secFetchDest === 'document' || secFetchDest === 'navigate') {
        return { ok: false, reason: 'direct_navigation' };
    }

    const secFetchSite = (request.headers.get('Sec-Fetch-Site') || '').toLowerCase();
    if (secFetchSite) {
        if (secFetchSite !== 'same-origin') {
            return { ok: false, reason: 'cross_origin' };
        }
        return { ok: true, internal: false };
    }

    // Fallback for browsers without Sec-Fetch-Site (e.g. older Safari): require same-origin Referer
    const referer = request.headers.get('Referer') || '';
    const origin = new URL(request.url).origin;
    if (referer.startsWith(`${origin}/`) || referer === origin) {
        return { ok: true, internal: false };
    }

    return { ok: false, reason: 'missing_origin_context' };
}

/**
 * Lightweight per-IP sliding-window rate limiter.
 */
export function checkRateLimit(ip, isArchive, nowMs = Date.now(), buckets = rateBuckets) {
    if (!ip) return { allowed: true };

    const limit = isArchive ? ARCHIVE_MAX_PER_WINDOW : CURRENT_MAX_PER_WINDOW;
    const key = `${ip}:${isArchive ? 'archive' : 'current'}`;
    const cutoff = nowMs - RATE_WINDOW_MS;

    const existing = buckets.get(key) || [];
    const recent = existing.filter(ts => ts > cutoff);

    if (recent.length >= limit) {
        buckets.set(key, recent);
        return { allowed: false, retryAfter: 60 };
    }

    recent.push(nowMs);
    buckets.set(key, recent);

    if (buckets.size > MAX_TRACKED_IPS) {
        for (const [k, timestamps] of buckets) {
            if (!timestamps.some(ts => ts > cutoff)) {
                buckets.delete(k);
            }
        }
    }

    return { allowed: true };
}

function errorResponse(status, message, extraHeaders = {}) {
    return new Response(JSON.stringify({ error: message }), {
        status,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
            'X-Robots-Tag': 'noindex, nofollow',
            ...extraHeaders,
        },
    });
}

export async function onRequest(context) {
    const { request, env, params } = context;

    if (request.method !== 'GET' && request.method !== 'HEAD') {
        return errorResponse(405, 'Method not allowed');
    }

    const originCheck = isAllowedOriginRequest(request, env);
    if (!originCheck.ok) {
        return errorResponse(403, 'Forbidden');
    }

    const filename = params?.file || new URL(request.url).pathname.split('/').pop() || '';
    const dateStr = parseDailyDate(filename);
    if (!dateStr) {
        return errorResponse(404, 'Not found');
    }

    const windowCheck = evaluateDateWindow(dateStr, new Date());
    if (!windowCheck.allowed) {
        return errorResponse(404, 'Puzzle not available');
    }

    if (!originCheck.internal) {
        const ip = request.headers.get('CF-Connecting-IP') || '';
        const rate = checkRateLimit(ip, windowCheck.isArchive);
        if (!rate.allowed) {
            return errorResponse(429, 'Too many requests', {
                'Retry-After': String(rate.retryAfter),
            });
        }
    }

    const assetRes = await env.ASSETS.fetch(request);
    if (!assetRes.ok) {
        return errorResponse(404, 'Puzzle not found');
    }

    const headers = new Headers(assetRes.headers);
    headers.set('Cache-Control', 'private, max-age=300');
    headers.set('Vary', 'Sec-Fetch-Site, Referer');
    headers.set('X-Robots-Tag', 'noindex, nofollow');
    headers.set('X-Content-Type-Options', 'nosniff');

    return new Response(request.method === 'HEAD' ? null : assetRes.body, {
        status: assetRes.status,
        headers,
    });
}
