import Foundation
import SwiftUI
import UniformTypeIdentifiers

struct PlannerCategory: Identifiable, Codable, Equatable {
    var id: UUID
    var name: String
    var tint: Int
}

struct PlannerTask: Identifiable, Codable, Equatable {
    var id = UUID()
    var text: String
    var completed = false
}

struct DayRecord: Codable, Equatable {
    var notes = ""
    var tasks: [PlannerTask] = []
}

struct PlannerDocument: Codable, Equatable {
    var version = 1
    var categories: [PlannerCategory] = [
        PlannerCategory(id: UUID(uuidString: "00000000-0000-0000-0000-000000000001")!, name: "Work", tint: 0),
        PlannerCategory(id: UUID(uuidString: "00000000-0000-0000-0000-000000000002")!, name: "Home", tint: 1),
        PlannerCategory(id: UUID(uuidString: "00000000-0000-0000-0000-000000000003")!, name: "Personal", tint: 2)
    ]
    // YYYY-MM-DD|category UUID. Dates are local calendar days, not UTC instants.
    var days: [String: DayRecord] = [:]
    var goals: [String: String] = [:]

    func validate() throws {
        guard version == 1, !categories.isEmpty,
              Set(categories.map(\.id)).count == categories.count,
              categories.allSatisfy({ !$0.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty })
        else { throw PlannerError.invalidBackup }
        let categoryIDs = Set(categories.map { $0.id.uuidString })
        var taskIDs = Set<UUID>()
        for (key, record) in days {
            guard Self.validKey(key, categoryIDs: categoryIDs) else { throw PlannerError.invalidBackup }
            for task in record.tasks {
                guard taskIDs.insert(task.id).inserted else { throw PlannerError.invalidBackup }
            }
        }
        for key in goals.keys {
            guard Self.validKey(key, categoryIDs: categoryIDs),
                  let date = PlannerDates.date(String(key.prefix(10))),
                  PlannerDates.key(PlannerDates.weekStart(date)) == String(key.prefix(10))
            else { throw PlannerError.invalidBackup }
        }
    }

    private static func validKey(_ key: String, categoryIDs: Set<String>) -> Bool {
        let parts = key.split(separator: "|", omittingEmptySubsequences: false)
        return parts.count == 2 && PlannerDates.date(String(parts[0])) != nil
            && categoryIDs.contains(String(parts[1]))
    }
}

enum PlannerError: LocalizedError {
    case invalidBackup
    var errorDescription: String? { "This file is not a supported Don’t Forget iPad backup." }
}

enum PlannerDates {
    static var calendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.firstWeekday = 2
        calendar.minimumDaysInFirstWeek = 4
        calendar.timeZone = .current
        return calendar
    }

    static func key(_ date: Date) -> String {
        let parts = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", parts.year!, parts.month!, parts.day!)
    }

    static func date(_ key: String) -> Date? {
        let parts = key.split(separator: "-")
        guard parts.count == 3, key.count == 10,
              let year = Int(parts[0]), let month = Int(parts[1]), let day = Int(parts[2]),
              (1...9999).contains(year), (1...12).contains(month), (1...31).contains(day),
              let result = calendar.date(from: DateComponents(year: year, month: month, day: day, hour: 12)),
              Self.key(result) == key else { return nil }
        return result
    }

    static func weekStart(_ date: Date) -> Date {
        let day = calendar.startOfDay(for: date)
        let offset = (calendar.component(.weekday, from: day) + 5) % 7
        return adding(-offset, to: day)
    }

    static func adding(_ days: Int, to date: Date) -> Date {
        calendar.date(byAdding: .day, value: days, to: date)!
    }

    static func monthStart(_ date: Date) -> Date {
        calendar.date(from: calendar.dateComponents([.year, .month], from: date))!
    }

    static func monthGrid(_ date: Date) -> [Date] {
        let first = weekStart(monthStart(date))
        return (0..<42).map { adding($0, to: first) }
    }

    static func title(_ date: Date, format: String) -> String {
        let formatter = DateFormatter()
        formatter.locale = .current
        formatter.calendar = calendar
        formatter.timeZone = .current
        formatter.dateFormat = format
        return formatter.string(from: date)
    }
}

struct PendingTask: Identifiable {
    var id: UUID { task.id }
    var date: Date
    var task: PlannerTask
}

@MainActor
final class PlannerStore: ObservableObject {
    @Published private(set) var document = PlannerDocument()
    @Published private(set) var storageError: String?
    @Published private(set) var lastSaved: Date?
    private var blocked = false
    private let fileURL: URL

    init() {
        let directory = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        fileURL = directory.appendingPathComponent("dont-forget-planner-v1.json")
        do {
            if FileManager.default.fileExists(atPath: fileURL.path) {
                let data = try Data(contentsOf: fileURL)
                let loaded = try JSONDecoder().decode(PlannerDocument.self, from: data)
                try loaded.validate()
                document = loaded
            }
        } catch {
            blocked = true
            storageError = "Your saved planner could not be opened. The original file has been preserved. Restore a Don’t Forget iPad backup to continue. \(error.localizedDescription)"
        }
    }

    var canEdit: Bool { !blocked }

    func recordKey(_ date: Date, _ category: UUID) -> String {
        PlannerDates.key(date) + "|" + category.uuidString
    }

    func day(_ date: Date, category: UUID) -> DayRecord {
        document.days[recordKey(date, category)] ?? DayRecord()
    }

    func goals(_ week: Date, category: UUID) -> String {
        document.goals[recordKey(PlannerDates.weekStart(week), category)] ?? ""
    }

    func setNotes(_ text: String, date: Date, category: UUID) {
        updateDay(date, category: category) { $0.notes = text }
    }

    func setGoals(_ text: String, week: Date, category: UUID) {
        guard canEdit else { return }
        document.goals[recordKey(PlannerDates.weekStart(week), category)] = text
        save()
    }

    func addTask(_ text: String, date: Date, category: UUID) {
        let clean = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !clean.isEmpty else { return }
        updateDay(date, category: category) { $0.tasks.append(PlannerTask(text: clean)) }
    }

    func updateTask(_ task: PlannerTask, date: Date, category: UUID) {
        updateDay(date, category: category) { record in
            if let index = record.tasks.firstIndex(where: { $0.id == task.id }) { record.tasks[index] = task }
        }
    }

    func toggle(_ task: PlannerTask, date: Date, category: UUID) {
        var updated = task
        updated.completed.toggle()
        updateTask(updated, date: date, category: category)
    }

    func delete(_ task: PlannerTask, date: Date, category: UUID) {
        updateDay(date, category: category) { $0.tasks.removeAll { $0.id == task.id } }
    }

    func move(_ task: PlannerTask, from source: Date, to destination: Date, category: UUID) {
        guard canEdit, PlannerDates.key(source) != PlannerDates.key(destination) else { return }
        let sourceKey = recordKey(source, category)
        let targetKey = recordKey(destination, category)
        guard var sourceRecord = document.days[sourceKey], sourceRecord.tasks.contains(where: { $0.id == task.id }) else { return }
        var targetRecord = document.days[targetKey] ?? DayRecord()
        sourceRecord.tasks.removeAll { $0.id == task.id }
        targetRecord.tasks.append(task)
        document.days[sourceKey] = sourceRecord
        document.days[targetKey] = targetRecord
        save()
    }

    func pending(before week: Date, category: UUID) -> [PendingTask] {
        let boundary = PlannerDates.key(PlannerDates.weekStart(week))
        let suffix = "|" + category.uuidString
        return document.days.flatMap { key, record -> [PendingTask] in
            guard key.hasSuffix(suffix), String(key.prefix(10)) < boundary,
                  let date = PlannerDates.date(String(key.prefix(10))) else { return [] }
            return record.tasks.filter { !$0.completed }.map { PendingTask(date: date, task: $0) }
        }.sorted { $0.date == $1.date ? $0.task.text < $1.task.text : $0.date < $1.date }
    }

    func addCategory(_ name: String) -> UUID? {
        let clean = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard canEdit, !clean.isEmpty else { return nil }
        if let existing = document.categories.first(where: { $0.name.caseInsensitiveCompare(clean) == .orderedSame }) {
            return existing.id
        }
        let category = PlannerCategory(id: UUID(), name: String(clean.prefix(40)), tint: document.categories.count % 5)
        document.categories.append(category)
        save()
        return category.id
    }

    private func updateDay(_ date: Date, category: UUID, change: (inout DayRecord) -> Void) {
        guard canEdit else { return }
        let key = recordKey(date, category)
        var record = document.days[key] ?? DayRecord()
        change(&record)
        document.days[key] = record
        save()
    }

    func save() {
        guard !blocked else { return }
        do {
            let data = try JSONEncoder().encode(document)
            try data.write(to: fileURL, options: .atomic)
            lastSaved = Date()
            storageError = nil
        } catch {
            storageError = "Changes are in memory but could not be saved. Export a backup before closing the app. \(error.localizedDescription)"
        }
    }

    func restore(from url: URL) throws {
        let access = url.startAccessingSecurityScopedResource()
        defer { if access { url.stopAccessingSecurityScopedResource() } }
        let data = try Data(contentsOf: url)
        let restored = try JSONDecoder().decode(PlannerDocument.self, from: data)
        try restored.validate()
        // Preserve the previous on-disk file before replacing it, even after a load failure.
        if FileManager.default.fileExists(atPath: fileURL.path) {
            let safety = fileURL.deletingLastPathComponent().appendingPathComponent("planner-before-restore-\(UUID().uuidString).json")
            try FileManager.default.copyItem(at: fileURL, to: safety)
        }
        try JSONEncoder().encode(restored).write(to: fileURL, options: .atomic)
        document = restored
        blocked = false
        storageError = nil
        lastSaved = Date()
    }
}

struct PlannerBackup: FileDocument {
    static var readableContentTypes: [UTType] { [.json] }
    var document: PlannerDocument

    init(document: PlannerDocument) { self.document = document }
    init(configuration: ReadConfiguration) throws {
        guard let data = configuration.file.regularFileContents else { throw PlannerError.invalidBackup }
        document = try JSONDecoder().decode(PlannerDocument.self, from: data)
        try document.validate()
    }
    func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        return FileWrapper(regularFileWithContents: try encoder.encode(document))
    }
}
