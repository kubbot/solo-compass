# Customer Support — Inbox Setup & Reply Templates

> Last updated 2026-05-09. Companion to `docs/PRIVACY.md` and Epic I in
> `tasks/prd-paid-app-foundation.md`.

## Inbox

- **Public address:** `solocompass.support@gmail.com` (placeholder Gmail —
  to be replaced with `support@<domain>` when a custom domain is registered
  in v1.2).
- **Routing:** forwards to the founder's personal Gmail; replies sent from
  the same alias via Gmail's "Send as".
- **SLA:** acknowledge within 24h, resolve or escalate within 72h. During
  the first 14 days post-launch, monitor every 4 hours.

## Decision tree at intake

When a message arrives, classify it into one of six buckets and use the
matching template:

1. **Cancel my subscription** → Template A
2. **Refund request (general)** → Template B
3. **Refund request after hitting AI quota** → Template C (decline)
4. **AI gave wrong information** → Template D
5. **Restore-purchase failed** → Template E
6. **Account / data deletion** → Template F (GDPR / CCPA path)

Anything that doesn't fit → escalate to the founder, do not improvise legal
or refund commitments.

## Reply templates

Every template ends with a polite closing and the signature

```
— Solo Compass team
support: solocompass.support@gmail.com
```

### Template A — Subscription cancellation request

```
Hi,

Thanks for trying Solo Compass.

Apple manages all subscriptions, so we can't cancel from our side. Here's
the one-tap path on your iPhone:

  Settings app → tap your name at the top → Subscriptions → Solo Compass
  Pro → Cancel Subscription

Your subscription stays active until the end of your current billing
period — you keep AI features until then. After that, you keep all your
favorites, completed list, and offline data; only the AI Explore feature
goes back to skeleton mode.

If you have a moment, we'd love to know what made you cancel. Reply to
this email — it goes straight to the team. No follow-up sales pitch, we
promise.

— Solo Compass team
support: solocompass.support@gmail.com
```

### Template B — General refund

```
Hi,

Refunds for App Store subscriptions go through Apple, not us. The fastest
path:

  https://reportaproblem.apple.com → sign in with your Apple ID → find
  the Solo Compass charge → "Request a refund"

Apple decides within 48h. If they decline, please reply here with their
case number and a sentence about what went wrong; we'll see what we can do
on our side (e.g. extending Pro features for a month at no charge).

— Solo Compass team
support: solocompass.support@gmail.com
```

### Template C — Refund after hitting AI quota (decline politely)

```
Hi,

Thanks for the note.

Solo Compass Pro includes 30 AI exploration calls per day. You've used all
30 today, so the next exploration falls back to a basic OSM-only view
until midnight UTC. Tomorrow your full quota resets.

This daily cap is mentioned in the paywall fine print and exists so that
the subscription stays affordable — without it, one bad loop could cost
us $50 in a single user session. We're not able to issue refunds for
quota use, but I can offer you a few options:

  1. Wait until midnight UTC for tomorrow's reset (free).
  2. Cancel and we'll refund the unused portion of your trial via Apple
     (see steps above).
  3. If you genuinely hit a bug — wrong quota count, a glitch — send a
     screenshot and we'll investigate.

— Solo Compass team
support: solocompass.support@gmail.com
```

### Template D — AI gave wrong information

```
Hi,

That's exactly the kind of feedback we need — thanks for taking the time.

The AI Explore feature uses OpenStreetMap data and Anthropic's Claude to
write descriptions, and we explicitly forbid it from inventing menu items,
hours, or interior details. When it does anyway (and it sometimes does),
we want to know.

Could you share:

  1. The experience id (long-press the pin → "Copy id")
  2. What was wrong (e.g. "claimed a fish tank that doesn't exist")

We'll flag the entry, regenerate it with a stricter prompt, and look at
whether the prompt needs tightening for that category.

In the meantime: experiences with the dashed border + "AI-generated"
badge are explicitly marked as low-confidence. We recommend treating them
as suggestions, verifying on-site. The visually solid pins are
community-validated.

Sorry for the friction.

— Solo Compass team
support: solocompass.support@gmail.com
```

### Template E — Restore-purchase failed

```
Hi,

Sorry the restore didn't work. A few things to check, in order:

  1. Same Apple ID? Settings → tap your name at top — confirm it matches
     the Apple ID you used to subscribe originally.
  2. App Store sign-in: open the App Store, tap your photo top-right,
     scroll to Subscriptions — does Solo Compass Pro appear there?
     - If yes: restart the app and try Settings → Subscription → Restore
       again.
     - If no: the subscription may not exist on this Apple ID; reply
       with the Apple ID's email so we can investigate.
  3. Try `https://reportaproblem.apple.com` with that Apple ID and find
     the original purchase to confirm it's still active.

Send a screenshot of the Subscriptions list and we'll dig in.

— Solo Compass team
support: solocompass.support@gmail.com
```

### Template F — Account / data deletion (GDPR / CCPA / PIPL)

```
Hi,

You can delete everything from inside the iOS app:

  Settings → My Data → Clear all data

This wipes the local store immediately and queues a cascade delete on our
server side, which completes within 30 days. After that, the only data we
still have is anonymous error reports (Sentry, 30-day rolling) which
contain no identifying information.

If you've already uninstalled and want a server-side delete, please reply
with anything that helps us locate your records — the anon device id from
the Settings screen if you remember it, or the approximate dates and
cities you used the app in. We'll process within 30 days as required.

You don't need to provide a reason and we don't run retention campaigns.

— Solo Compass team
support: solocompass.support@gmail.com
```

## Escalation paths

- **Anything mentioning legal action, lawsuit, court, lawyer:** stop, do
  not reply, forward to founder.
- **Anything mentioning safety, harassment, stalking, domestic violence:**
  stop, do not reply, forward to founder. Solo Compass has no safety
  product surface but the audience overlaps with people in vulnerable
  situations.
- **Press / media inquiries:** forward to founder, do not reply.
- **Bug reports with reproducible steps:** acknowledge within 24h, file in
  GitHub Issues with `bug` label, link the issue back in the reply.

## What we never say in support replies

- "Thanks for reaching out!" (empty, signals automation)
- "We're sorry for the inconvenience" without a specific fix
- "We'll consider it for a future update" (we either commit or we don't)
- Any mention of streak, ranking, badges, or other engagement mechanics —
  these are anti-patterns we don't build (see `docs/PRIVACY.md`).
