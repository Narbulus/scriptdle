/**
 * Pure email builder for "Line 1 in the Inbox" daily Scriptle reminders.
 * Zero runtime dependencies so it works identically in Cloudflare Workers,
 * Node scripts, and Vitest unit tests.
 */

export function escapeHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Email subject is ONLY the quote itself (sender is "Scriptle") — no pack name
 * prefix — so opening an inbox immediately drops the reader into the line.
 */
export function formatQuoteSubject(quoteText, maxChars = 115) {
    const clean = String(quoteText || '').replace(/\s+/g, ' ').trim();
    if (!clean) return 'Who said it?';
    if (clean.length <= maxChars) {
        return `“${clean}”`;
    }
    const clipped = clean.slice(0, maxChars - 1);
    const trimmed = clipped.includes(' ')
        ? clipped.slice(0, clipped.lastIndexOf(' '))
        : clipped;
    return `“${trimmed.replace(/[,;:\s]+$/, '')}…”`;
}

/**
 * Build a Resend-compatible email payload for a single subscriber + puzzle.
 */
export function buildDailyEmail({
    to,
    from = 'Scriptle <daily@scriptle.net>',
    siteUrl = 'https://scriptle.net',
    packId,
    packName,
    packTheme = {},
    quoteText,
    season = null,
    unsubscribeToken,
}) {
    const baseUrl = siteUrl.replace(/\/$/, '');
    const playUrl = `${baseUrl}/play/${encodeURIComponent(packId)}?utm_source=daily_email`;
    const unsubscribeUrl = `${baseUrl}/api/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`;

    const bgColor = packTheme.bgColor || '#14171c';
    const primary = packTheme.primary || '#e0c158';
    const subject = formatQuoteSubject(quoteText);
    const contextHint = season ? `${packName} · ${season}` : packName;

    const text = [
        '???',
        '',
        `"${quoteText}"`,
        '',
        `Guess who said it: ${playUrl}`,
        '',
        `—`,
        `Daily quote (${contextHint})`,
        `Unsubscribe: ${unsubscribeUrl}`,
    ].join('\n');

    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:24px 12px;background-color:${escapeHtml(bgColor)};font-family:'Courier New',Courier,monospace;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;margin:0 auto;">
    <tr>
      <td align="center" style="padding:0 0 16px 0;font-size:16px;font-weight:bold;letter-spacing:0.16em;text-transform:uppercase;color:${escapeHtml(primary)};">
        SCRIPTLE
      </td>
    </tr>
    <tr>
      <td style="background-color:#f0e2c4;border-radius:3px;padding:28px 28px 32px 28px;box-shadow:0 8px 24px rgba(0,0,0,0.4);">
        <div style="text-align:center;margin-bottom:14px;">
          <span style="display:inline-block;background-color:#e2d0ad;color:#17130d;padding:2px 10px;border-radius:3px;font-size:13px;font-weight:bold;letter-spacing:0.2em;">???</span>
        </div>
        <div style="font-size:16px;line-height:1.55;color:#17130d;text-align:left;max-width:440px;margin:0 auto;">
          ${escapeHtml(quoteText)}
        </div>
      </td>
    </tr>
    <tr>
      <td align="center" style="padding:22px 0 8px 0;">
        <a href="${escapeHtml(playUrl)}" style="display:inline-block;background-color:#d6b244;color:#1a2412;text-decoration:none;font-family:'Courier New',Courier,monospace;font-size:14px;font-weight:bold;letter-spacing:0.1em;text-transform:uppercase;padding:13px 28px;border-radius:4px;">
          GUESS WHO SAID IT &rarr;
        </a>
      </td>
    </tr>
    <tr>
      <td align="center" style="padding:14px 0 0 0;font-size:11px;line-height:1.6;letter-spacing:0.06em;color:${escapeHtml(primary)};opacity:0.72;">
        ${escapeHtml(contextHint)} &middot;
        <a href="${escapeHtml(unsubscribeUrl)}" style="color:${escapeHtml(primary)};text-decoration:underline;">Unsubscribe</a>
      </td>
    </tr>
  </table>
</body>
</html>`;

    return {
        from,
        to,
        subject,
        html,
        text,
        headers: {
            'List-Unsubscribe': `<${unsubscribeUrl}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
    };
}
