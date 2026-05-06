# Web — what it's for, what it isn't

> Status: active design doc. This is the definitive answer to "what does the web app do?"
>
> Read this **before** opening any web-app PR.

## The mistake to avoid

The web app is **not** a stripped-down version of the iOS app. If we build it that way, it becomes a B-grade native experience — slower than iOS, no background GPS, awkward push notifications — that competes with iOS for attention and loses on every dimension.

Web has its own job. iOS has its own job. They serve **different scenarios at different points in the user's trip**.

## The complementary role

| Phase                     | Device                             | Posture                                            | Best served by               |
| ------------------------- | ---------------------------------- | -------------------------------------------------- | ---------------------------- |
| Pre-trip                  | Desktop, multiple tabs, planning   | Researching, comparing, deciding                   | **Web**                      |
| On the ground (no app)    | Phone browser, standing on street  | "Let me try this without installing"               | **Web** (try-before-install) |
| On the ground (installed) | Phone, walking, deciding next move | "Where should I go now? Auto-detect when I arrive" | **iOS**                      |
| Post-trip                 | Desktop, leisurely                 | "Look back, share with friends"                    | **Web**                      |
| Long-tail discovery       | Anyone Googling a city             | "Find the best quiet café in Chiang Mai"           | **Web** (SEO)                |

Three of these five are Web's home turf. iOS owns the middle one — the live, in-motion, automated one — and that's plenty for iOS to be the "real product."

## The four scenarios web must serve

### Scenario A — Pre-trip research center

**Posture:** desktop, mouse, multiple tabs, leisurely.

**User's mental model:** "I'm planning a trip. I want to see what's possible, compare cities, deep-dive on individual experiences, and save things for later."

**Why web wins:** information density, side-by-side comparison, copy-paste, multi-tab.

**Layout:** three-column desktop view — top status bar, left scrollable experience list, right Mapbox map filling the rest. Hovering a list item pulses the corresponding marker. Clicking a marker scrolls the list. URL always reflects state — copy-paste the URL and the recipient sees the same thing.

**Don't:** force a "mobile-first" cramped layout on desktop. Desktop users have 1440px+ of horizontal space; use it.

### Scenario B — On-the-ground quick-check (zero install)

**Posture:** phone browser, standing on a street, just heard about Solo Compass.

**User's mental model:** "Let me try this without installing anything. If it's good, I'll get the app."

**Why web wins:** App Store install requires 4 steps + 4 minutes. Browser open requires 0 steps + 0 minutes.

**Strategic role:** **this is the single best customer acquisition mechanism.** Distribution is a single URL that can be shared in Telegram groups, posted in Reddit comments, printed on café signs.

**Design:**

- Same Next.js codebase, responsive via Tailwind `md:` breakpoints
- Mobile layout: full-screen map, bottom drawer with 3-5 nearby experiences
- **Manual check-in** (since browser can't do background GPS) — works fully without an account, stored in `localStorage`
- After 2 manual check-ins, soft non-blocking prompt: "The iOS app does this automatically — get it free." Equal-weight buttons. Dismissable.

**Don't:**

- Don't pretend to be the iOS app. Embrace being a great mobile website, not a sad fake app.
- Don't gate features behind login. Login is for _syncing_, not for _trying_.
- Don't shove the iOS app prompt in the user's face. Earn the suggestion by giving value first.

### Scenario C — Post-trip recap & sharing

**Posture:** desktop, at home, post-trip, possibly with a glass of wine.

**User's mental model:** "Look at all the great things I did. Let me show people."

**Why web wins:** **shareable URLs.** A native iOS app can show you your own trip; only a web page can be sent to a friend on Slack and unfurl into a beautiful card.

**Design:**

- Public URLs: `compass.io/u/<handle>/<city>` and `compass.io/u/<handle>/<city>/<exp>`
- Beautiful map with the user's path drawn through their experiences
- Auto-generated OG images (use Vercel `next/og`) so links unfurl on every social platform
- Privacy controls: user can hide individual experiences or whole cities
- "Plan your own Chiang Mai trip" CTA → leads to scenario A

**Strategic role:** every share is a free billboard. If 100 users each share their recap once, that's 100 polished landing pages spreading through their networks.

**Don't:**

- Don't make this a social network. No following, no comments, no likes. The recap page is a personal artifact, not a wall.
- Don't strip user identity to anonymous — the user wrote this; their handle should appear.

### Scenario D — SEO entry point

**Posture:** anyone in the world, Googling things like "quiet cafés Chiang Mai", "what to do alone in Chiang Mai", "Wat Suan Dok sunset."

**User's mental model:** "I clicked a search result. Show me what I came for."

**Why web wins:** **the App Store is a closed ecosystem.** Google can't index App Store listings. Users can't link directly to a screen inside an app. A web page with good content is forever discoverable.

**Strategic role:** every well-optimized page is an always-on acquisition channel. 500 high-quality experience and city pages, all indexed, is the largest long-term growth lever the product has.

**Design:**

- Static-generated pages for every experience and every city (Next.js `generateStaticParams`)
- Schema.org structured data: `TouristAttraction`, `Place`, `BreadcrumbList`
- Auto-generated OG images per page
- Sitemap.xml, robots.txt
- Sources cited and linked (Wikivoyage attribution + outbound link signal)
- Lighthouse: Performance ≥90, Accessibility ≥95, SEO 100
- Soft, non-blocking CTAs: sticky bottom bar offering "Open in app" or "Save to my list"

**Don't:**

- Don't gate static pages behind login. Public, anonymous, instant content.
- Don't personalize these pages on the server. Ruins caching, hurts SEO. Personalization happens client-side after first paint, if at all.
- Don't ship them in different languages until launch is stable. Multi-language SEO doubles the surface area; do it once the core is proven.

## The anti-goals (what web does NOT do)

| Don't do                                         | Why                                                                           |
| ------------------------------------------------ | ----------------------------------------------------------------------------- |
| Background GPS / automatic check-in              | Browsers can't. iOS does this; let iOS shine.                                 |
| Push notifications as a primary interaction      | Web Push UX is awful; users decline; we look pushy.                           |
| Try to be a "complete PWA" replacing the iOS app | Creates competing posture, dilutes both.                                      |
| Force registration to view content               | Defeats SEO and try-before-install.                                           |
| Voice as primary input                           | On desktop, the keyboard wins. Voice stays available but is not the headline. |
| Animations that mimic native                     | Mobile web should feel like a great website, not a fake app.                  |
| Push for app install before delivering value     | Earn the install. Suggest it after the user has gotten value.                 |

## Technical decisions, locked in

| Decision        | Choice                    | Reason                                                        |
| --------------- | ------------------------- | ------------------------------------------------------------- |
| Framework       | Next.js 15 App Router     | Mix of SSG (SEO pages) and SSR (research view)                |
| Map             | Mapbox GL JS              | Custom warm style, desktop performance, broad browser support |
| State           | URL as state + RSC        | Sharing-friendly, no Redux complexity                         |
| Styling         | Tailwind + shadcn/ui      | Speed of iteration; single design system across web           |
| Auth            | Supabase email magic link | Optional, never required for content                          |
| Deploy          | Vercel                    | Native Next.js, free tier covers Phase 2                      |
| Mobile strategy | Same code + responsive    | Single codebase. No separate mobile site.                     |

## How to use this document

When a feature lands on someone's desk:

1. Map it to one of the four scenarios. If it doesn't fit any, it probably belongs in iOS.
2. Check the anti-goals. If it violates one, surface that in the PR description.
3. Cross-reference with `docs/PRODUCT_BRIEF.md` to ensure it doesn't violate the three pillars.

If a proposed feature serves all four scenarios, it's likely too generic — go deeper into which scenario it serves _best_.

## Linked

- Brief: `docs/PRODUCT_BRIEF.md`
- Phases: `docs/PHASES.md`
- iOS positioning: `apps/ios/README.md`
- Schema: `packages/core/src/experience.ts`
