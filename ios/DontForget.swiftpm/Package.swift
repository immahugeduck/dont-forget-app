// swift-tools-version: 5.7
import PackageDescription
import AppleProductTypes

let package = Package(
    name: "DontForget",
    platforms: [.iOS("16.0")],
    products: [
        .iOSApplication(
            name: "DontForget",
            targets: ["AppModule"],
            bundleIdentifier: "app.dontforget.playground",
            displayVersion: "0.1.0",
            bundleVersion: "1",
            appIcon: .placeholder(icon: .pencil),
            accentColor: .presetColor(.blue),
            supportedDeviceFamilies: [.pad, .phone],
            supportedInterfaceOrientations: [.portrait, .landscapeLeft, .landscapeRight]
        )
    ],
    targets: [
        .executableTarget(
            name: "AppModule",
            path: ".",
            sources: ["DontForgetApp.swift", "ContentView.swift", "PlannerModels.swift"]
        )
    ]
)
