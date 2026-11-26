# Scriptle Daily Email ("Line 1 in the Inbox")

Sends each subscriber one daily email every morning at **13:00 UTC** (8:00 AM EST / 9:00 AM EDT) via **Cloudflare Email Sending** (zero external email provider needed):
- **From:** `Scriptle <daily@scriptle.net>`
- **Subject:** Just Line 1 of today's quote (no pack name prefix)
- **Body:** Screenplay paper card + `GUESS WHO SAID IT →` CTA + 1-click unsubscribe

## Live Resources (Already Provisioned)
- **KV Namespace:** `SUBSCRIBERS_KV` (`2ce804e1ff7a41679b2b1e957a998363`), bound to both the `scriptdle` Cloudflare Pages project (`production` & `preview`) and the `scriptle-daily-email` Worker.
- **Email Sending Domain:** `scriptle.net` onboarded to Cloudflare Email Sending (`cf-bounce.scriptle.net` SPF/DKIM/MX + `_dmarc.scriptle.net`).
- **Shared Secret:** `DAILY_EMAIL_SECRET` bound on both the `scriptdle` Pages project and `scriptle-daily-email` Worker so the Worker can fetch `/data/daily-all/YYYY-MM-DD.json` through the edge gate.

## Redeploying the Worker
```sh
cd workers/daily-email
npx wrangler deploy
```

## Preview & Manual Test
- Preview rendered HTML: `GET https://scriptle-daily-email.<subdomain>.workers.dev/preview?pack=harry-potter`
- Send a live test email (requires `ADMIN_SECRET`):
  ```sh
  curl -X POST -H "Authorization: Bearer $ADMIN_SECRET" \
    "https://scriptle-daily-email.<subdomain>.workers.dev/send-test?email=you@example.com&pack=harry-potter"
  ```
