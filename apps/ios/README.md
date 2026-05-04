# apps/ios · Native iOS app (Phase 3)

> SwiftUI + MapKit. The real product.

## Why iOS native (and not React Native, Flutter, or PWA)

The product's signature feature — **automatic check-in via background GPS** — has hard platform constraints:

- iOS background location requires `NSLocationAlwaysAndWhenInUseUsageDescription` + `CLLocationManager` region monitoring. PWAs cannot do this.
- Cross-platform RN/Flutter wrappers around `CLLocationManager` exist but are leaky abstractions for region monitoring; debugging the leak costs more than writing native.
- 60fps map interaction with 200+ markers in a custom style is achievable in MapKit but choppy in WebView-based stacks.

So: native. iOS first because:

- Digital nomads in Southeast Asia skew ~70% iOS
- iOS background location story is more predictable than Android (manufacturer-specific killers)

Android comes after iOS validates.

## Status

🚧 Not started. Starts only after `apps/web` validates the hypothesis.

## Stack (target)

- Swift 5.9+
- SwiftUI for screens
- MapKit (custom map style, custom annotation views)
- CoreLocation for region monitoring + significant location changes
- UserNotifications for arrival/departure prompts
- Combine + Swift Concurrency
- swift-package-manager for dependencies

## Bridge to TypeScript domain types

The `@solo-compass/core` types are the source of truth. We will:

1. Generate Swift types from the TS schema (`scripts/gen-swift-types.ts`)
2. Or — more likely — hand-roll matching Swift structs and enforce parity in CI

Decision pending; track in [#TBD](../../issues).
