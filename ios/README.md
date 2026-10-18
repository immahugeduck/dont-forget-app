# Don’t Forget — iPad Swift Playground edition

This is the first native SwiftUI milestone, based on the planner in the `Remember-App` branch. It is a local-first app playground, not a WebView. It requires iPadOS 16 or newer and a compatible Apple Swift Playground release. Update Swift Playground before opening it.

## Open on your iPad

### If you saw “ContentView.swift not in a target”

The revised manifest explicitly lists all three application source files. That addresses ambiguous source discovery; it has not yet been verified on the affected iPad. A stale project index or an import problem can produce the same message.

Tap **Stop**, return to the editor, and open the newly extracted `DontForget-Fixed.swiftpm` package from the corrected ZIP. Keep the previous project until the replacement opens successfully. Do not choose **Delete App Data & Restart**; removing data does not repair target membership.

If the same message remains, use the fresh-App paste fallback below. Swift Playground then creates and manages the package and target itself. This is the preferred next diagnostic step over repeatedly restarting the imported package.

1. Download `DontForget-iPad-Playground.zip` and choose **Save to Files**.
2. In Apple’s **Files** app, tap the ZIP once to extract it.
3. Open the extracted folder and tap **DontForget-Fixed.swiftpm**. If Files does not open it directly, launch Swift Playground, choose **Browse**, and locate `DontForget-Fixed.swiftpm`.
4. Choose **Run App** (the play button above the editor). The first build may take a moment.
5. Add a test task, close the running app, run it again, and check the task is still there.

Open the entire `.swiftpm` project, not the `Package.swift` file inside it. No API key, Mac, paid developer membership, or sign-in is needed for this local test.

If the project does not open, use the included `Paste-Into-ContentView.txt` fallback:

1. In Swift Playground, choose **New Playground → App** (older releases may say **Create App**).
2. Open the default `ContentView.swift` file and replace its entire contents with the fallback text.
3. Keep the default `MyApp.swift` unchanged. It should have one `@main` app that opens `ContentView()`.
4. Tap Run App. Do not paste `Package.swift` into the code editor.

If an error appears, send the exact message or a screenshot of the issue list. The Apple SwiftUI build has not been run in this Linux development environment; the first on-device compile is still required.

## Included

- Monday–Sunday week view, with an eighth Weekly Goals card.
- Month grid with Monday first and dates you can tap to open a day.
- Editable notes, checklists, task completion, task deletion confirmation, and moving a task one day earlier/later.
- Work, Home, and Personal categories, plus custom categories.
- Previous unfinished tasks remain visible in **Still on your list**. **Move here** transfers the task to the displayed week’s Monday, preserving its identity instead of copying it.
- Local JSON storage, atomic file writes, visible save failures, and protection against overwriting an unreadable saved planner.
- JSON backup export and restore. Restore validates the backup and saves a safety copy of the previous on-disk file.
- Responsive iPad/iPhone layouts, dark styling, Dynamic Type text, and accessibility labels.

The first launch intentionally has no sample tasks. The local data file is `dont-forget-planner-v1.json` in the running app’s Documents container. The app saves every edit. Export backups to a location you control before deleting the project or app; do not assume editing or duplicating a playground transfers its running app’s data.

## Current boundaries

This milestone does not sign into the web app or import its existing account data. Its backup format is specifically for this native planner, not a web database export. Cloud sync, weather, tags, scheduled notifications, Apple Calendar integration, App Store signing, and TestFlight setup remain future work. No changes to web/Android behavior are included.

Running in Swift Playground is different from installing an independent App Store app. Use Run App for this testing milestone. Publishing and independent device distribution require a separate signing and distribution workflow.

## Before the next phase

1. Confirm the project builds and runs on the user’s actual iPad/Swift Playground version.
2. Verify the manual checks in `VALIDATION.md`.
3. Add a native authentication/session flow for the existing Better Auth backend and verify user-scoped API access.
4. Define offline change queues and conflict handling before turning on multi-device writes.
5. Implement reminders with edits, cancellations, time-zone handling, and duplicate-delivery prevention.

Keep the existing website as the cloud backend where appropriate. Never embed database connection strings or server secrets in the iPad app.

Apple references:
- https://support.apple.com/guide/playgrounds-ipad/welcome/ipados
- https://support.apple.com/en-gb/guide/playgrounds-ipad/itc650868b1f/ipados
- https://developer.apple.com/documentation/swift-playgrounds
