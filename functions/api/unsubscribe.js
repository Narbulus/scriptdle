/**
 * Cloudflare Pages Function: GET / POST /api/unsubscribe?token=...
 * Supports both direct link clicks (GET) and RFC 8058 Gmail/Apple Mail
 * one-click unsubscribe (POST).
 */

async function removeSubscription(env, token) {
    if (!env?.SUBSCRIBERS_KV || !token) return { ok: false, found: false };
    const subKey = `sub:${token}`;
    const raw = await env.SUBSCRIBERS_KV.get(subKey);
    if (!raw) return { ok: true, found: false };

    let parsed = null;
    try {
        parsed = JSON.parse(raw);
    } catch {
        // Ignore malformed record and still delete the token key
    }

    const deletes = [env.SUBSCRIBERS_KV.delete(subKey)];
    if (parsed?.email && parsed?.packId) {
        deletes.push(env.SUBSCRIBERS_KV.delete(`idx:${parsed.email}:${parsed.packId}`));
    }
    await Promise.all(deletes);
    return { ok: true, found: true, packName: parsed?.packName || 'Scriptle' };
}

export async function onRequestPost({ request, env }) {
    const url = new URL(request.url);
    const token = url.searchParams.get('token') || '';
    const result = await removeSubscription(env, token);
    return new Response(JSON.stringify(result), {
        status: result.ok ? 200 : 503,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
}

export async function onRequestGet({ request, env }) {
    const url = new URL(request.url);
    const token = url.searchParams.get('token') || '';
    const result = await removeSubscription(env, token);
    const heading = result.ok ? "You're unsubscribed" : 'Unsubscribe unavailable';
    const message = result.ok
        ? `You won't receive any more daily ${result.packName || 'Scriptle'} quote emails.`
        : 'Email reminders are not configured on this environment.';

    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Scriptle — Unsubscribed</title>
</head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#14171c;color:#f4ebd0;font-family:'Courier New',Courier,monospace;padding:24px;">
  <div style="max-width:440px;text-align:center;background:#1e232b;border:1px solid rgba(224,193,88,0.35);border-radius:8px;padding:32px 24px;">
    <div style="font-size:13px;letter-spacing:0.16em;color:#e0c158;margin-bottom:12px;">SCRIPTLE</div>
    <h1 style="margin:0 0 12px 0;font-size:20px;text-transform:uppercase;letter-spacing:0.06em;">${heading}</h1>
    <p style="margin:0 0 24px 0;font-size:14px;line-height:1.5;color:#d6ceb8;">${message}</p>
    <a href="https://scriptle.net" style="display:inline-block;background:#e0c158;color:#191510;text-decoration:none;font-weight:bold;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;padding:12px 22px;border-radius:4px;">Back to Scriptle</a>
  </div>
</body>
</html>`;

    return new Response(html, {
        status: result.ok ? 200 : 503,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
}
