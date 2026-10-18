# Validation — native planner milestone 1

## Environment limitations

The implementation was prepared on Linux without Swift, Xcode, Apple SDKs, or an iPad runtime. Syntax parsing and source review are not an Apple compile. No claim of successful SwiftUI compilation, simulator execution, visual verification, background behavior, or on-device persistence verification is made.

## Source review

All four `.swift` files passed tree-sitter Swift syntax parsing. This does not check SDK availability, Swift types, or runtime behavior.

- Only files under `ios/` are added; existing web and Android sources are unchanged.
- No external package dependencies or network calls are required by this milestone.
- Task moves remove and insert the same task ID and persist the document once.
- Local writes use atomic replacement. If loading fails, edits are blocked and the original file is retained.
- Restores validate before replacement and preserve the previous file. Backups with unsupported versions, invalid date/category keys, or duplicate task IDs are rejected.
- Day keys are Gregorian local dates. Week starts are calculated with calendar-day arithmetic, not fixed 24-hour intervals.
- Blank tasks and duplicate category names are prevented at creation.
- Category changes reset day-card draft state to avoid adding a draft to a different category.

## Required on-device checks

1. **Build:** Open `DontForget.swiftpm`, Run App, and record the iPadOS and Swift Playground versions. Verify no compiler errors.
2. **Week:** Confirm Monday–Sunday plus Goals. Navigate across a month and year boundary, then Today.
3. **Dates:** Check February 2028 includes February 29 and February 2027 does not. Check the week across March 14, 2027 and November 7, 2027 in America/Indiana/Indianapolis; no skipped or repeated calendar day should occur.
4. **Tasks:** Add, edit, complete, reopen, move, and delete a task. Cancel a deletion and confirm the task remains. Blank Add should be disabled.
5. **Categories:** Put different tasks/notes in Work and Home on the same date. Confirm separation. Add a custom category; entering the same name with different letter case should select the existing category.
6. **Persistence:** Type a task, notes, and weekly goals. Stop the app and run it again. Force-quit Swift Playground, reopen the same project, and confirm entries remain.
7. **Carryover:** Create an incomplete task in a previous week. Confirm it appears under Still on your list in a later week. Move here should remove it from the old day and add it exactly once on Monday.
8. **Month:** Tap a day, edit notes, and confirm month dots. Verify dates in adjacent months open the correct day.
9. **Backup:** Export JSON to Files. Modify the planner, restore the export, and verify restoration. Try invalid JSON and a backup with version 99; both should be rejected without changing current data.
10. **Layout:** Test portrait, landscape, split-screen, larger text, and the keyboard. Confirm buttons, day cards, and the goals editor remain usable. Test VoiceOver labels.

## Release status

Ready for the first user-operated iPad build and interaction test. Cloud account data and reminders are not part of this milestone. App Store readiness has not been assessed.
