/**
 * Cloudflare Pages Function: POST /api/subscribe
 * Stores a pack-scoped daily quote email subscription in Cloudflare KV (SUBSCRIBERS_KV).
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PACK_ID_RE = /^[a-z0-9-]{2,64}$/;

function json(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
}

export async function onRequestPost({ request, env }) {
    if (!env?.SUBSCRIBERS_KV) {
        return json({ ok: false, error: 'Daily email reminders are not configured yet.' }, 503);
    }

    let payload;
    try {
        payload = await request.json();
    } catch {
        return json({ ok: false, error: 'Invalid JSON body.' }, 400);
    }

    const email = String(payload?.email || '').trim().toLowerCase();
    const packId = String(payload?.packId || '').trim().toLowerCase();
    const packName = String(payload?.packName || packId).trim().slice(0, 80);

    if (!EMAIL_RE.test(email) || email.length > 254) {
        return json({ ok: false, error: 'Please enter a valid email address.' }, 400);
    }

    if (!PACK_ID_RE.test(packId)) {
        return json({ ok: false, error: 'Invalid pack ID.' }, 400);
    }

    const indexKey = `idx:${email}:${packId}`;
    const existingToken = await env.SUBSCRIBERS_KV.get(indexKey);
    if (existingToken) {
        const existingRaw = await env.SUBSCRIBERS_KV.get(`sub:${existingToken}`);
        if (existingRaw) {
            return json({ ok: true, alreadySubscribed: true, packId });
        }
    }

    const token = crypto.randomUUID();
    const record = {
        token,
        email,
        packId,
        packName,
        createdAt: new Date().toISOString(),
        active: true,
    };

    await Promise.all([
        env.SUBSCRIBERS_KV.put(`sub:${token}`, JSON.stringify(record)),
        env.SUBSCRIBERS_KV.put(indexKey, token),
    ]);

    return json({ ok: true, alreadySubscribed: false, packId }, 201);
}
