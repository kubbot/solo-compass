# App Store Metadata — Solo Compass v1.1

Source-of-truth for App Store Connect listing fields, TestFlight beta description, and reviewer notes. Update here first, then paste into ASC.

---

## Build identity

| Field                          | Value                |
| ------------------------------ | -------------------- |
| Bundle ID                      | `com.solocompass.app`|
| MARKETING_VERSION              | `1.1.0`              |
| CURRENT_PROJECT_VERSION        | `2`                  |
| Minimum iOS                    | `17.0`               |
| Primary language               | `English (U.S.)`     |
| Localizations                  | `English`, `Simplified Chinese (zh-Hans)` |
| Category — Primary             | Travel               |
| Category — Secondary           | Lifestyle            |
| Encryption                     | `ITSAppUsesNonExemptEncryption = false` (only HTTPS over standard libraries) |
| Content rights                 | "Does not use third-party content" |
| Age rating                     | 4+                   |

---

## App name + subtitle

- **App name (30 char max)**: `Solo Compass`
- **Subtitle (30 char max)**: `Solo travel, mapped`

zh-Hans:
- **应用名称**: `Solo Compass`
- **副标题**: `属于一个人的旅行地图`

---

## Promotional text (170 char, editable any time)

> AI exploration in any city worldwide. Real places from OpenStreetMap, enriched with solo-traveler context: comfort, vibe, what to expect when you walk in alone.

zh-Hans:
> 在世界任意城市用 AI 探索。来自 OpenStreetMap 的真实地点,结合独行视角的解读:氛围、舒适度、一个人推门进去会遇到什么。

---

## Description (4000 char)

> Solo Compass is a map-first companion for people who travel — and live — alone.
>
> Every spot on the map is an experience worth being at by yourself. Quiet cafes where staff leave you alone. Markets where solo eaters get a seat. Temples timed for the morning light. Viewpoints with a bench, not a tour group.
>
> ### Explore here
> Tap one button anywhere on Earth and Solo Compass pulls real public places from OpenStreetMap, then asks AI to draft solo-traveler descriptions: comfort, pace, what to bring, when to skip. Works in cities we have never seen before.
>
> ### Solo Score
> Each place gets a 0–10 score across six dimensions: seating, solo patrons, staff pressure, portion size for one, ambiance, and safety. Built from real user feedback, not a rating system.
>
> ### Voice intent
> Hold the mic, describe what you want — "a quiet bookshop with coffee" — and the map rearranges itself.
>
> ### Free vs Pro
> Free: full curated map, OSM-only Explore (skeleton mode), all your favorites and check-ins.
> Pro: AI-enriched Explore in any city, voice intent, per-experience AI insights. 7-day free trial.
>
> ### Privacy
> No accounts. No tracking. Coarse location goes to OpenStreetMap; OSM tags + city slug go to Anthropic for the description draft. That's it. Nothing for sale, nothing for advertisers.

zh-Hans:
> Solo Compass 是为独行者设计的地图工具——无论你是旅行,还是日常生活。
>
> 地图上的每一处都值得一个人前往。安静的咖啡馆、对单人友好的市集、晨光最好的寺庙、有长椅没有旅行团的观景台。
>
> ### 在这里探索
> 在地球上任意位置点一下按钮, Solo Compass 会从 OpenStreetMap 抓取真实公开地点,再请 AI 用独行视角写描述:氛围如何、节奏怎样、带什么、什么时候应该绕开。新城市也照样工作。
>
> ### 独行评分
> 每处都有六维 0–10 评分:座位友好度、独行客比例、员工压力、一人份量、氛围、安全感。来自真实用户反馈,而非评论系统。
>
> ### 语音意图
> 按住麦克风,说"安静的书店,有咖啡",地图会自动重新排列。
>
> ### 免费 vs Pro
> 免费:精选地图、OSM 骨架版探索、收藏与签到。
> Pro:任意城市的 AI 增强探索、语音意图、按需 AI 洞察。7 天免费试用。
>
> ### 隐私
> 不需要账号,不做追踪。粗略位置发给 OpenStreetMap;OSM 标签 + 城市标识发给 Anthropic 用于生成描述。仅此而已。不出售,不给广告商。

---

## Keywords (100 char, comma-separated, no spaces)

`solo,travel,map,nomad,cafe,quiet,explore,coworking,wellness,nearby`

---

## Support URL + Marketing URL

| Field         | Value (v1.1 placeholder)                      |
| ------------- | --------------------------------------------- |
| Support URL   | `https://solo-compass.vercel.app/support`     |
| Marketing URL | `https://solo-compass.vercel.app`             |
| Privacy URL   | `https://solo-compass.vercel.app/privacy`     |

(Custom domain deferred to v1.2 per founder decision.)

---

## In-App Purchases (StoreKit Configuration source-of-truth)

| Product ID                              | Display name      | Apple price tier | Family shareable | Trial      |
| --------------------------------------- | ----------------- | ---------------- | ---------------- | ---------- |
| `com.solocompass.pro.monthly`           | Pro Monthly       | Tier 2           | Yes              | 7-day free |
| `com.solocompass.pro.yearly`            | Pro Yearly        | Tier 11          | Yes              | 7-day free |

Subscription group: `Solo Compass Pro`.

App Review note: free users still get the curated map + OSM-only Explore. Pro unlocks AI synthesis on top.

---

## Screenshots checklist (App Store Connect requires)

- [ ] 6.9" iPhone (Pro Max class, e.g. iPhone 17 Pro Max) — minimum 3, recommended 6
- [ ] 6.5" iPhone (legacy, optional but recommended)
- [ ] 12.9" / 13" iPad Pro (only if shipping iPad in v1.1; current project.yml allows iPad orientations, so include)

Required scenes:
1. Map with curated experiences in Chiang Mai
2. Explore here in a fresh city (Hanoi recommended) — AI-enriched
3. Experience detail with Solo Score
4. Paywall with monthly/yearly cards
5. Voice intent listening state
6. Settings with Travel Style picker

zh-Hans screenshots: re-take #1, #2, #3 with system language set to Simplified Chinese.

---

## TestFlight beta description (4000 char)

> v1.1 introduces full SwiftData persistence, AI cost control, freemium with 7-day free trial, cross-device sync via Supabase, and Simplified Chinese localization.
>
> Test focus this round:
> 1. Explore Here in a city you have never seen on the curated map (Hanoi, Da Nang, Ubud are good targets).
> 2. The first-run consent sheet — does the language make sense?
> 3. Paywall flow: tap Explore as a free user, start trial, exit, restore.
> 4. Switch system language to Simplified Chinese and walk through the same flows.
>
> Known limitations:
> - Domain is `solo-compass.vercel.app` until v1.2.
> - Support email is a Gmail alias for now.
>
> Email feedback to xiong3293172751@outlook.com or use the in-app Report an issue from any experience detail.

---

## Reviewer notes (App Review submission)

> Solo Compass is a paid travel/lifestyle app with a free curated tier and Pro subscription.
>
> AI features (Explore Here, voice intent, per-experience insights) call Anthropic. The first time the user invokes any AI feature we surface an in-app consent sheet describing exactly what data leaves the phone. No PII is sent: only OpenStreetMap tag dictionaries and a city slug.
>
> Free demo for review:
> - Open the app in any city and explore the curated map (no purchase required).
> - To exercise Pro paths during review, use Sandbox account; the Configuration.storekit file ships with a 7-day intro trial.
>
> No accounts, no tracking, no third-party SDKs. Anonymous Supabase user IDs are used only to sync completions/favorites across the same person's devices.

---

## Pre-submit checklist

- [ ] `xcodebuild test` passes on iPhone 17 simulator
- [ ] `pnpm parity:check` passes (TS↔Swift, TS↔DB, SQL↔Swift)
- [ ] PrivacyInfo.xcprivacy bundled in `.app` (verified in DerivedData)
- [ ] Both `en.lproj/Localizable.strings` and `zh-Hans.lproj/Localizable.strings` bundled
- [ ] Configuration.storekit products visible in StoreKit configuration
- [ ] All `NSLocationWhenInUseUsageDescription`, `NSMicrophoneUsageDescription`, `NSSpeechRecognitionUsageDescription` strings reviewed for clarity
- [ ] App icon: all required sizes filled in `Assets.xcassets/AppIcon.appiconset`
- [ ] Privacy URL + Support URL reachable
