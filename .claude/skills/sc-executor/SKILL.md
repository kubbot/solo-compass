# sc-executor — Solo Compass Optimization Executor Agent

> Role: CODE-WRITING agent. Reads the Evaluator's report, fixes issues by
> priority, verifies each fix builds, then writes an execution log.
> Never invents features beyond what the Evaluator flagged.

## Trigger

Invoked by the loop orchestrator (`/sc:loop`) after each Evaluator run,
only when score < 99.

## Inputs (read from filesystem)

- `/tmp/sc-loop/round_N/EVAL_REPORT.md` — Evaluator output (required)
- `/tmp/sc-loop/round_N/screenshots/*.png` — visual evidence (read with Read tool)
- `apps/ios/SoloCompass/**/*.swift` — all source files

## Outputs

- Modified `.swift` files (in-place edits)
- `/tmp/sc-loop/round_N/EXEC_LOG.md` — what was fixed, skipped, and why

---

## Execution Protocol

### Step 1 — Parse the Report

Read `/tmp/sc-loop/round_N/EVAL_REPORT.md`.
Extract:

- Total score and per-dimension scores
- All P1 issues (fix ALL of these, no exceptions)
- All P2 issues (fix as many as possible)
- P3 issues (fix only if P1+P2 are done)
- Top 3 recommendations from Evaluator's Verdict section

### Step 2 — Read Affected Files First

Before editing anything, Read every `.swift` file mentioned in P1/P2 issues.
Also read files that likely cascade (e.g. if fixing ViewModel, read its View).

### Step 3 — Fix by Priority (P1 → P2 → P3)

For each fix:

1. State the issue and intended fix in one sentence
2. Edit the file using the Edit tool with minimal diff
3. Verify syntax mentally before moving on

**Fix patterns by issue type:**

#### Force unwrap removal

```swift
// BEFORE
let exp = selectedExperience!
// AFTER
guard let exp = selectedExperience else { return }
```

#### Silent try? → explicit error handling

```swift
// BEFORE
let result = try? service.fetch()
// AFTER
do {
    let result = try service.fetch()
    // use result
} catch {
    lastAIError = error.localizedDescription
}
```

#### Missing accessibilityLabel on interactive element

```swift
Button(action: dismiss) { Image(systemName: "xmark") }
    .accessibilityLabel(NSLocalizedString("close_button", comment: "Close"))
```

#### Hardcoded color → adaptive

```swift
// BEFORE
.foregroundColor(.white)
// AFTER
.foregroundColor(.primary)
```

#### Missing empty state

```swift
if viewModel.visibleExperiences.isEmpty {
    ContentUnavailableView(
        NSLocalizedString("no_experiences_title", comment: ""),
        systemImage: "map",
        description: Text(NSLocalizedString("no_experiences_body", comment: ""))
    )
}
```

#### Missing loading state

```swift
if isLoading {
    ProgressView()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityLabel(NSLocalizedString("loading", comment: "Loading"))
}
```

#### Missing #Preview

```swift
#Preview {
    TheView()
        .environment(ExperienceService())
        .environment(UserPreferences())
}
```

#### Haptic feedback on tap

```swift
// At top of tap handler:
UIImpactFeedbackGenerator(style: .medium).impactOccurred()
```

#### Missing NSLocalizedString

```swift
// BEFORE
Text("No experiences nearby")
// AFTER
Text(NSLocalizedString("no_experiences_nearby", comment: "Empty state label"))
// ALSO add to Resources/en.lproj/Localizable.strings:
// "no_experiences_nearby" = "No experiences nearby";
```

#### UI update not on @MainActor

```swift
// BEFORE (called from async context)
self.visibleExperiences = results
// AFTER
await MainActor.run { self.visibleExperiences = results }
```

#### User-friendly error state in View

```swift
if let error = viewModel.lastAIError {
    HStack {
        Image(systemName: "exclamationmark.triangle")
        Text(error).font(.caption)
    }
    .foregroundColor(.secondary)
    .padding(8)
}
```

### Step 4 — Build Verification

After ALL edits, build to confirm nothing broken:

```bash
UDID=$(xcrun simctl list devices | grep Booted | grep -oE '[A-F0-9-]{36}' | head -1)
cd /Users/xiongxinwei/data/mine/cubxxw/personal/solo-compass/apps/ios
xcodebuild -project SoloCompass.xcodeproj \
  -scheme SoloCompass \
  -destination "id=${UDID}" \
  -configuration Debug \
  build 2>&1 | grep -E "BUILD (SUCCEEDED|FAILED)|error:" | tail -20
```

If BUILD FAILED:

1. Read the specific errors
2. Revert the last breaking edit
3. Try an alternative approach
4. Re-run build
5. Repeat until BUILD SUCCEEDED — never leave codebase broken

### Step 5 — Reinstall on Simulator

```bash
APP_PATH=$(find ~/Library/Developer/Xcode/DerivedData -name "SoloCompass.app" \
  -path "*/Debug-iphonesimulator/*" | head -1)
xcrun simctl install ${UDID} "$APP_PATH"
xcrun simctl launch ${UDID} com.solocompass.app
```

### Step 6 — Write EXEC_LOG.md

Write to `/tmp/sc-loop/round_N/EXEC_LOG.md`:

```markdown
# Executor Log — Round {N}

Timestamp: {ISO-8601}
Source report: /tmp/sc-loop/round_N/EVAL_REPORT.md
Build result: SUCCEEDED | FAILED

## Fixes Applied

| Priority | File                     | Issue               | Fix Applied                  |
| -------- | ------------------------ | ------------------- | ---------------------------- |
| P1       | MapViewModel.swift:23    | force unwrap        | replaced with guard let      |
| P2       | ExperienceCardView.swift | missing empty state | added ContentUnavailableView |
| P3       | ConfidenceBadge.swift    | missing #Preview    | added #Preview block         |

## Skipped Issues

| Issue | Reason                                  |
| ----- | --------------------------------------- |
| ...   | requires design decision / out of scope |

## New Files / Strings Added

- Resources/en.lproj/Localizable.strings — added 3 new keys

## Summary

Fixed {X} issues ({Y} P1, {Z} P2, {W} P3).
Build: SUCCEEDED.
Ready for Evaluator round {N+1}.
```

---

## Hard Rules

- NEVER add features not mentioned in the EVAL_REPORT — stick to the fix list
- NEVER change the MVVM architecture (Services do I/O, ViewModels hold state, Views thin)
- NEVER add third-party dependencies — Swift native only
- NEVER break existing functionality while fixing something else
- NEVER commit to git — the orchestrator handles that after the full loop ends
- iOS 17.0 minimum — no APIs introduced after iOS 17
- If a P1 fix requires more than ~20 lines of architectural change, mark it
  "requires design decision" in EXEC_LOG and move on to P2
