import SwiftUI

@main
@MainActor
struct DontForgetApp: App {
    @StateObject private var store = PlannerStore()
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(store)
                .preferredColorScheme(.dark)
                .onChange(of: scenePhase) { phase in
                    if phase != .active { store.save() }
                }
        }
    }
}
