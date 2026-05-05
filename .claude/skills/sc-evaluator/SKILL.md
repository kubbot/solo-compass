# sc-evaluator — Solo Compass Product Evaluator Agent

> Role: READ-ONLY auditor. Never edits source files. Builds the app, takes
> simulator screenshots, scores against the rubric, writes a structured report.

## Trigger

Invoked by the loop orchestrator (`/sc:loop`) at the start of each iteration.
Do NOT invoke manually unless debugging.

## Inputs (read from filesystem)

- `apps/ios/SoloCompass/` — all Swift source files (read-only)
- `/tmp/sc-loop/round_N/` — previous round artifacts (if N > 1)
- Booted simulator UDID — auto-detected via `xcrun simctl list devices | grep Booted`

## Outputs (write to filesystem)

- `/tmp/sc-loop/round_N/screenshots/*.png` — one per screen
- `/tmp/sc-loop/round_N/EVAL_REPORT.md` — structured scoring report

---

## Execution Protocol

### Step 1 — Detect Simulator & Create Dirs

```bash
UDID=$(xcrun simctl list devices | grep Booted | grep -oE '[A-F0-9-]{36}' | head -1)
ROUND=$1   # passed by orchestrator, e.g. "1"
mkdir -p /tmp/sc-loop/round_${ROUND}/screenshots
```

### Step 2 — Build

```bash
cd /Users/xiongxinwei/data/mine/cubxxw/personal/solo-compass/apps/ios
xcodebuild -project SoloCompass.xcodeproj \
  -scheme SoloCompass \
  -destination "id=${UDID}" \
  -configuration Debug \
  build 2>&1 | grep -E "BUILD (SUCCEEDED|FAILED)|error:" | tail -20
```

If BUILD FAILED → score all dims 0, write report with build errors verbatim, stop.

### Step 3 — Install & Launch

```bash
APP_PATH=$(find ~/Library/Developer/Xcode/DerivedData -name "SoloCompass.app" \
  -path "*/Debug-iphonesimulator/*" | head -1)
xcrun simctl install ${UDID} "$APP_PATH"
xcrun simctl launch ${UDID} com.solocompass.app
sleep 4
```

### Step 4 — Screenshot Each Screen

Take screenshots in order. Between each, trigger the UI state via simctl or
describe the interaction so the human can manually trigger if automation isn't
available.

| #   | File name                  | State to reach                                      |
| --- | -------------------------- | --------------------------------------------------- |
| 1   | `01_home_map.png`          | App launch default                                  |
| 2   | `02_filter_bar.png`        | Same, zoom into filter bar area                     |
| 3   | `03_now_filter.png`        | Tap "Now" filter pill                               |
| 4   | `04_experience_card.png`   | Tap first visible map marker                        |
| 5   | `05_experience_detail.png` | Tap expand / "See more" on card                     |
| 6   | `06_voice_button.png`      | Return to map, show voice button                    |
| 7   | `07_dark_mode.png`         | `xcrun simctl ui ${UDID} appearance dark`, relaunch |

```bash
xcrun simctl io ${UDID} screenshot /tmp/sc-loop/round_${ROUND}/screenshots/01_home_map.png
# After each UI interaction (sleep 1 between):
xcrun simctl io ${UDID} screenshot /tmp/sc-loop/round_${ROUND}/screenshots/NN_name.png
# Dark mode:
xcrun simctl ui ${UDID} appearance dark
sleep 2
xcrun simctl io ${UDID} screenshot /tmp/sc-loop/round_${ROUND}/screenshots/07_dark_mode.png
xcrun simctl ui ${UDID} appearance light
```

Read each screenshot image with the Read tool and visually evaluate it.

### Step 5 — Static Code Audit (read-only)

Read every `.swift` file under `apps/ios/SoloCompass/`. Check for:

- Force unwraps `!` on optionals (exclude guard/assertion contexts)
- `try?` swallowing errors silently with no fallback log
- Missing `accessibilityLabel` on tappable elements (Button, onTapGesture)
- Hardcoded `Color(...)` or `.white`/`.black` literals (dark-mode risk)
- UI mutations not on `@MainActor`
- `#Preview` missing from any View file
- User-facing strings not wrapped in `NSLocalizedString`

### Step 6 — Score Against Rubric

Score each dimension 0–max. Partial credit only when behavior is clearly
present. Deduct per issue found. Document every deduction with `file:line`.

```
## SCORING RUBRIC

### A. Map-First Principle (0–20 pts)
- Home screen is full-bleed map, no competing chrome    [0 or 6]
- No tab bar / nav bar / drawer obscuring map           [0 or 4]
- Filter bar overlays map (doesn't push content down)   [0 or 4]
- Bottom info bar overlays map                          [0 or 3]
- Voice button overlays map, bottom-right               [0 or 3]

### B. Feature Completeness (0–25 pts)
- Map markers render for seed experiences               [0–5]
- Filter bar: All / Now / category pills work           [0–4]
- Experience card appears on marker tap                 [0–4]
- Detail shows: title, soloScore, bestTimes, howTo      [0–4]
- Voice intent UI reachable (mic button visible)        [0–3]
- Bottom info bar updates per time-of-day logic         [0–3]
- Long-press → add-experience flow exists               [0–2]

### C. Code Quality (0–20 pts)
- Zero force unwraps in production paths                [0–6]
- All async UI updates on @MainActor                    [0–5]
- Error paths handled (no silent try? without logging)  [0–5]
- No strong-capture-cycle patterns in closures          [0–4]

### D. UI/UX Polish (0–15 pts)
- Empty state shown when 0 experiences match filter     [0–4]
- Loading indicator during async operations             [0–3]
- Card appear/dismiss transitions are smooth            [0–3]
- Haptic feedback on marker tap and filter selection    [0–3]
- User-friendly error message on AI/voice failure       [0–2]

### E. Accessibility (0–10 pts)
- accessibilityLabel on all interactive controls        [0–4]
- Dynamic Type: no hardcoded font sizes                 [0–3]
- Color is not sole carrier of information              [0–3]

### F. Performance (0–10 pts)
- Map visible and interactive within 3s of launch       [0–4]
- Filter bar scroll is jank-free                        [0–3]
- Marker tap response < 200ms (no freeze)               [0–3]
```

**TOTAL = A + B + C + D + E + F (max 100)**

### Step 7 — Write EVAL_REPORT.md

Write to `/tmp/sc-loop/round_${ROUND}/EVAL_REPORT.md`:

```markdown
# Eval Report — Round {N}

Generated: {ISO-8601 timestamp}
Simulator: iPhone 17 (UDID: {UDID})
Build: SUCCEEDED | FAILED

## Score Summary

| Dimension        | Score | Max     |
| ---------------- | ----- | ------- |
| A. Map-First     | X     | 20      |
| B. Features      | X     | 25      |
| C. Code Quality  | X     | 20      |
| D. UI/UX Polish  | X     | 15      |
| E. Accessibility | X     | 10      |
| F. Performance   | X     | 10      |
| **TOTAL**        | **X** | **100** |

## Issues — P1 (blocks score, fix first)

- [ ] FILE:LINE — description of issue

## Issues — P2 (significant deduction)

- [ ] FILE:LINE — description

## Issues — P3 (minor, nice-to-fix)

- [ ] description

## Screenshot Observations

- 01_home_map.png — [PASS|WARN|FAIL] description
- 07_dark_mode.png — [PASS|WARN|FAIL] description
  ...

## Delta from Previous Round

(omit on round 1)

- FIXED: items resolved since last round
- REGRESSED: new issues introduced
- CARRIED: still open from last round

## Verdict

Score: X/100
Status: [CONTINUE | DONE]
Top 3 highest-impact fixes for Executor:

1. P1 — {file:line} — {one-line description}
2. P1 — {file:line} — {one-line description}
3. P2 — {description}
```

---

## Hard Rules

- NEVER edit any `.swift` file or any project file
- NEVER run `git commit` or `git add`
- Score conservatively — a dim scores 0 if its screenshot is black or not taken
- Dark mode screenshot is mandatory — missing dark mode support deducts 3 from D
