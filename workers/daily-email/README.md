# Scriptle Daily Email ("Line 1 in the Inbox")

Sends each subscriber one daily email every morning:
- **From:** `Scriptle <daily@scriptle.net>`
- **Subject:** Just Line 1 of today's quote (no pack name prefix)
- **Body:** Screenplay paper card + `GUESS WHO SAID IT →` CTA + 1-click unsubscribe

## One-Time Cloudflare Setup

1. **Create the shared KV namespace:**
   ```sh
   npx wrangler kv namespace create SUBSCRIBERS_KV
   ```
   Paste the returned `id` into `workers/daily-email/wrangler.toml`.

2. **Bind `SUBSCRIBERS_KV` to Cloudflare Pages:**
   In Cloudflare Dashboard → **Workers & Pages** → your `scriptdle` Pages project → **Settings → Bindings → Add → KV namespace**, set Variable name = `SUBSCRIBERS_KV` and pick the namespace from step 1 (for both Production and Preview).
   Pages will automatically serve `/api/subscribe` and `/api/unsubscribe` from `functions/api/`.

3. **Verify `scriptle.net` in Resend & add secrets:**
   - Verify your domain in [Resend](https://resend.com) so `daily@scriptle.net` passes SPF/DKIM.
   - Store secrets on the cron worker:
     ```sh
     cd workers/daily-email
     npx wrangler secret put RESEND_API_KEY
     npx wrangler secret put ADMIN_SECRET
     ```

4. **Deploy the cron worker & test:**
   ```sh
   cd workers/daily-email
   npx wrangler deploy
   ```
   - Preview today's HTML email: `GET https://scriptle-daily-email.<subdomain>.workers.dev/preview?pack=harry-potter`
   - Send yourself a live test email:
     ```sh
     curl -X POST -H "Authorization: Bearer $ADMIN_SECRET" \
       "https://scriptle-daily-email.<subdomain>.workers.dev/send-test?email=you@example.com&pack=harry-potter"
     ```
