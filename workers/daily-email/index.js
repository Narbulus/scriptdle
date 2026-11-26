/**
 * Cloudflare Cron Worker: sends "Line 1 in the Inbox" daily emails via
 * Cloudflare Email Sending (native `env.EMAIL` send_email binding).
 *
 * Reads today's puzzle straight from https://scriptle.net/data/daily-all/YYYY-MM-DD.json
 * (authenticated via X-Scriptle-Internal) and pack themes from packs-full.json,
 * then emails every active subscriber in SUBSCRIBERS_KV with:
 *   - From: Scriptle <daily@scriptle.net>
 *   - Subject: ONLY the quote itself (no pack name)
 */

import { buildDailyEmail } from '../../src/utils/emailTemplate.js';

const CONCURRENCY = 10;

function getUtcDateString(date = new Date()) {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function parseFromHeader(fromHeader, env) {
    const fallbackEmail = env.EMAIL_FROM_ADDRESS || 'daily@scriptle.net';
    const fallbackName = env.EMAIL_FROM_NAME || 'Scriptle';
    const match = /^(.+?)\s*<([^>]+)>$/.exec(String(fromHeader || '').trim());
    if (match) {
        return { name: match[1].trim(), email: match[2].trim() };
    }
    return { name: fallbackName, email: fallbackEmail };
}

async function fetchTodayAssets(siteUrl, dateStr, env = {}) {
    const base = siteUrl.replace(/\/$/, '');
    const dailyHeaders = env.DAILY_EMAIL_SECRET
        ? { 'X-Scriptle-Internal': env.DAILY_EMAIL_SECRET }
        : {};
    const [dailyRes, packsRes] = await Promise.all([
        fetch(`${base}/data/daily-all/${dateStr}.json`, { headers: dailyHeaders }),
        fetch(`${base}/data/packs-full.json`),
    ]);
    if (!dailyRes.ok) {
        throw new Error(`Failed to fetch daily-all/${dateStr}.json (${dailyRes.status})`);
    }
    if (!packsRes.ok) {
        throw new Error(`Failed to fetch packs-full.json (${packsRes.status})`);
    }
    const [dailyAll, packsFull] = await Promise.all([dailyRes.json(), packsRes.json()]);
    const packsById = Object.fromEntries((packsFull.packs || []).map(p => [p.id, p]));
    return { puzzles: dailyAll.puzzles || {}, packsById };
}

async function listAllSubscribers(kv) {
    const subscribers = [];
    let cursor = undefined;
    do {
        const page = await kv.list({ prefix: 'sub:', cursor });
        const records = await Promise.all(
            page.keys.map(async (k) => {
                const raw = await kv.get(k.name);
                if (!raw) return null;
                try {
                    return JSON.parse(raw);
                } catch {
                    return null;
                }
            })
        );
        for (const r of records) {
            if (r && r.active !== false && r.email && r.packId && r.token) {
                subscribers.push(r);
            }
        }
        cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);
    return subscribers;
}

async function sendOneEmail(env, msg) {
    if (!env.EMAIL || typeof env.EMAIL.send !== 'function') {
        throw new Error('Cloudflare Email Sending binding (EMAIL) is not configured');
    }

    const from = parseFromHeader(msg.from, env);
    const payload = {
        from,
        to: msg.to,
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
        headers: msg.headers,
    };

    try {
        return await env.EMAIL.send(payload);
    } catch (err) {
        // Fallback if List-Unsubscribe-Post is rejected by header allowlist
        if (String(err?.message || err).includes('HEADER_NOT_ALLOWED') && msg.headers?.['List-Unsubscribe']) {
            return env.EMAIL.send({
                ...payload,
                headers: { 'List-Unsubscribe': msg.headers['List-Unsubscribe'] },
            });
        }
        throw err;
    }
}

async function dispatchDailyEmails(env, dateStr) {
    const siteUrl = env.SITE_URL || 'https://scriptle.net';
    const from = env.EMAIL_FROM || 'Scriptle <daily@scriptle.net>';
    const { puzzles, packsById } = await fetchTodayAssets(siteUrl, dateStr, env);
    const subscribers = await listAllSubscribers(env.SUBSCRIBERS_KV);

    const messages = [];
    for (const sub of subscribers) {
        const daily = puzzles[sub.packId];
        const target = daily?.puzzle?.targetLine;
        if (!target?.text) continue;
        const pack = packsById[sub.packId] || {};
        messages.push(buildDailyEmail({
            to: sub.email,
            from,
            siteUrl,
            packId: sub.packId,
            packName: pack.name || sub.packName || sub.packId,
            packTheme: pack.theme || {},
            quoteText: target.text,
            season: target.season || null,
            unsubscribeToken: sub.token,
        }));
    }

    let sent = 0;
    let failed = 0;
    for (let i = 0; i < messages.length; i += CONCURRENCY) {
        const chunk = messages.slice(i, i + CONCURRENCY);
        const results = await Promise.allSettled(chunk.map(msg => sendOneEmail(env, msg)));
        for (const r of results) {
            if (r.status === 'fulfilled') {
                sent += 1;
            } else {
                failed += 1;
                console.error('Daily email send failed:', r.reason?.message || r.reason);
            }
        }
    }

    return { date: dateStr, subscribers: subscribers.length, sent, failed };
}

export default {
    async scheduled(_event, env) {
        const dateStr = getUtcDateString();
        const result = await dispatchDailyEmails(env, dateStr);
        console.log('Daily email dispatch complete:', JSON.stringify(result));
    },

    async fetch(request, env) {
        const url = new URL(request.url);
        const siteUrl = env.SITE_URL || 'https://scriptle.net';
        const from = env.EMAIL_FROM || 'Scriptle <daily@scriptle.net>';

        // Preview rendered HTML for any pack: GET /preview?pack=harry-potter
        if (url.pathname === '/preview') {
            const packId = url.searchParams.get('pack') || 'harry-potter';
            const dateStr = url.searchParams.get('date') || getUtcDateString();
            const { puzzles, packsById } = await fetchTodayAssets(siteUrl, dateStr, env);
            const target = puzzles[packId]?.puzzle?.targetLine;
            if (!target?.text) {
                return new Response(`No puzzle for ${packId} on ${dateStr}`, { status: 404 });
            }
            const pack = packsById[packId] || {};
            const msg = buildDailyEmail({
                to: 'preview@example.com',
                from,
                siteUrl,
                packId,
                packName: pack.name || packId,
                packTheme: pack.theme || {},
                quoteText: target.text,
                season: target.season || null,
                unsubscribeToken: 'preview-token',
            });
            return new Response(msg.html, {
                headers: {
                    'Content-Type': 'text/html; charset=utf-8',
                    'X-Email-Subject': msg.subject,
                },
            });
        }

        // Protected manual trigger: POST /send-test?email=...&pack=harry-potter
        if (request.method === 'POST' && url.pathname === '/send-test') {
            const auth = request.headers.get('Authorization') || '';
            if (!env.ADMIN_SECRET || auth !== `Bearer ${env.ADMIN_SECRET}`) {
                return new Response('Unauthorized', { status: 401 });
            }
            const to = url.searchParams.get('email');
            const packId = url.searchParams.get('pack') || 'harry-potter';
            const dateStr = url.searchParams.get('date') || getUtcDateString();
            if (!to) return new Response('Missing email param', { status: 400 });

            const { puzzles, packsById } = await fetchTodayAssets(siteUrl, dateStr, env);
            const target = puzzles[packId]?.puzzle?.targetLine;
            if (!target?.text) return new Response('Puzzle not found', { status: 404 });
            const pack = packsById[packId] || {};
            const msg = buildDailyEmail({
                to,
                from,
                siteUrl,
                packId,
                packName: pack.name || packId,
                packTheme: pack.theme || {},
                quoteText: target.text,
                season: target.season || null,
                unsubscribeToken: 'test-token',
            });
            const res = await sendOneEmail(env, msg);
            return new Response(JSON.stringify({ ok: true, subject: msg.subject, result: res }), {
                headers: { 'Content-Type': 'application/json' },
            });
        }

        return new Response('Scriptle Daily Email Worker', { status: 200 });
    },
};
