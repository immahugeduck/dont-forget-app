import SwiftUI
import UniformTypeIdentifiers

enum PlannerStyle {
    static let background = Color(red: 0.043, green: 0.051, blue: 0.071)
    static let surface = Color(red: 0.071, green: 0.082, blue: 0.110)
    static let raised = Color(red: 0.102, green: 0.118, blue: 0.153)
    static let accent = Color(red: 0.431, green: 0.545, blue: 1)
    static let success = Color(red: 0.239, green: 0.839, blue: 0.549)
    static let colors: [Color] = [accent, success, Color(red: 0.77, green: 0.65, blue: 1), .orange, .pink]
    static func color(_ tint: Int) -> Color { colors[((tint % colors.count) + colors.count) % colors.count] }
}

private struct PlannerCard: ViewModifier {
    func body(content: Content) -> some View {
        content.padding(18)
            .background(PlannerStyle.surface, in: RoundedRectangle(cornerRadius: 22))
            .overlay(RoundedRectangle(cornerRadius: 22).strokeBorder(.white.opacity(0.08)))
    }
}

private struct DaySelection: Identifiable {
    var id: String { PlannerDates.key(date) }
    var date: Date
}

@MainActor
struct ContentView: View {
    @EnvironmentObject private var store: PlannerStore
    @Environment(\.scenePhase) private var scenePhase
    @State private var selectedDate = Date()
    @State private var categoryID: UUID?
    @State private var mode = 0
    @State private var focusedDay: DaySelection?
    @State private var showCategory = false
    @State private var categoryName = ""
    @State private var showExport = false
    @State private var backup: PlannerBackup?
    @State private var showImport = false
    @State private var confirmImport = false
    @State private var message: String?
    @State private var today = Date()

    private var activeCategory: PlannerCategory {
        store.document.categories.first { $0.id == categoryID } ?? store.document.categories[0]
    }
    private var week: Date { PlannerDates.weekStart(selectedDate) }
    private var days: [Date] { (0..<7).map { PlannerDates.adding($0, to: week) } }
    private var tint: Color { PlannerStyle.color(activeCategory.tint) }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    header
                    if let error = store.storageError {
                        Label(error, systemImage: "exclamationmark.triangle.fill")
                            .font(.callout).foregroundStyle(.orange).modifier(PlannerCard())
                    }
                    categoryPicker
                    Picker("View", selection: $mode) {
                        Text("Week").tag(0)
                        Text("Month").tag(1)
                    }.pickerStyle(.segmented)
                    periodNavigator
                    if mode == 0 {
                        weekSummary
                        pendingTasks
                        LazyVGrid(columns: [GridItem(.adaptive(minimum: 290), alignment: .top)], alignment: .leading, spacing: 16) {
                            ForEach(days, id: \.self) { date in
                                DayCardView(date: date, category: activeCategory, today: today) {
                                    focusedDay = DaySelection(date: date)
                                }
                                .id(store.recordKey(date, activeCategory.id))
                            }
                            goalsCard
                        }
                    } else {
                        monthCalendar
                    }
                    Label("Stored on this iPad · Export a backup to keep a separate copy", systemImage: "internaldrive")
                        .font(.footnote).foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, alignment: .center).padding(.vertical, 8)
                }
                .padding(20).frame(maxWidth: 1120).frame(maxWidth: .infinity)
            }
            .background(PlannerStyle.background.ignoresSafeArea())
            .navigationTitle("Don’t Forget")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .navigationBarTrailing) { backupMenu } }
            .tint(tint)
            .sheet(item: $focusedDay) { selection in
                DayDetailView(date: selection.date, category: activeCategory)
                    .environmentObject(store).preferredColorScheme(.dark)
            }
            .alert("New category", isPresented: $showCategory) {
                TextField("Category name", text: $categoryName)
                Button("Cancel", role: .cancel) { categoryName = "" }
                Button("Add") {
                    if let id = store.addCategory(categoryName) { categoryID = id }
                    categoryName = ""
                }
            } message: { Text("For example, First Call Maintenance or Projects.") }
            .alert("Restore a backup?", isPresented: $confirmImport) {
                Button("Cancel", role: .cancel) {}
                Button("Choose backup", role: .destructive) { showImport = true }
            } message: {
                Text("Restoring replaces the current planner. Export a backup first if you want to keep it. Only Don’t Forget iPad JSON backups are supported.")
            }
            .alert("Don’t Forget", isPresented: Binding(get: { message != nil }, set: { if !$0 { message = nil } })) {
                Button("OK") { message = nil }
            } message: { Text(message ?? "") }
            .fileExporter(isPresented: $showExport, document: backup, contentType: .json,
                          defaultFilename: "DontForget-backup-\(PlannerDates.key(Date()))") { result in
                if case .failure(let error) = result { message = error.localizedDescription }
            }
            .fileImporter(isPresented: $showImport, allowedContentTypes: [.json]) { result in
                do {
                    let url = try result.get()
                    try store.restore(from: url)
                    categoryID = nil
                    message = "Your backup has been restored."
                } catch { message = "Restore failed. \(error.localizedDescription)" }
            }
            .onChange(of: scenePhase) { phase in if phase == .active { today = Date() } }
            .onReceive(NotificationCenter.default.publisher(for: .NSCalendarDayChanged)) { _ in today = Date() }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Label("MAKE ROOM FOR WHAT MATTERS", systemImage: "sparkle")
                    .font(.caption.weight(.semibold)).tracking(1).foregroundStyle(tint)
                Spacer(minLength: 0)
            }
            Text("A little clarity.\nA better week.")
                .font(.system(size: 34, weight: .bold, design: .rounded)).tracking(-1)
                .fixedSize(horizontal: false, vertical: true)
            Text(PlannerDates.title(today, format: "EEEE, MMMM d"))
                .font(.subheadline).foregroundStyle(.secondary)
        }.padding(.top, 8)
    }

    private var categoryPicker: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 10) {
                ForEach(store.document.categories) { category in
                    Button { categoryID = category.id } label: {
                        HStack(spacing: 8) {
                            Circle().fill(PlannerStyle.color(category.tint)).frame(width: 7, height: 7)
                            Text(category.name).font(.subheadline.weight(.semibold))
                        }
                        .padding(.horizontal, 16).frame(minHeight: 44)
                        .background(activeCategory.id == category.id ? PlannerStyle.raised : PlannerStyle.surface, in: Capsule())
                        .overlay(Capsule().strokeBorder(activeCategory.id == category.id ? tint.opacity(0.7) : .white.opacity(0.08)))
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(activeCategory.id == category.id ? [.isSelected] : [])
                }
                Button { showCategory = true } label: {
                    Image(systemName: "plus").frame(width: 44, height: 44)
                        .background(PlannerStyle.surface, in: Circle())
                }.accessibilityLabel("Add category").disabled(!store.canEdit)
            }
        }
    }

    private var periodNavigator: some View {
        HStack(spacing: 12) {
            Button { shiftPeriod(-1) } label: {
                Image(systemName: "chevron.left").frame(width: 44, height: 44)
            }.accessibilityLabel(mode == 0 ? "Previous week" : "Previous month")
            VStack(spacing: 3) {
                Text(mode == 0 ? weekTitle : PlannerDates.title(selectedDate, format: "MMMM yyyy"))
                    .font(.headline).multilineTextAlignment(.center)
                if mode == 0 {
                    Text("Monday–Sunday").font(.caption).foregroundStyle(.secondary)
                }
            }.frame(maxWidth: .infinity)
            Button { shiftPeriod(1) } label: {
                Image(systemName: "chevron.right").frame(width: 44, height: 44)
            }.accessibilityLabel(mode == 0 ? "Next week" : "Next month")
            Button("Today") { today = Date(); selectedDate = today }
                .font(.subheadline.weight(.semibold)).frame(minHeight: 44)
        }.buttonStyle(.plain)
    }

    private var weekTitle: String {
        PlannerDates.title(week, format: "MMM d") + " – " +
        PlannerDates.title(PlannerDates.adding(6, to: week), format: "MMM d, yyyy")
    }

    private var weekSummary: some View {
        let tasks = days.flatMap { store.day($0, category: activeCategory.id).tasks }
        let done = tasks.filter(\.completed).count
        return VStack(alignment: .leading, spacing: 12) {
            HStack {
                Label("Your week", systemImage: "chart.bar.fill").font(.subheadline.weight(.semibold))
                Spacer()
                Text("\(done) / \(tasks.count) done").font(.subheadline.monospacedDigit()).foregroundStyle(.secondary)
            }
            ProgressView(value: tasks.isEmpty ? 0 : Double(done) / Double(tasks.count)).tint(tint)
            Text(tasks.isEmpty ? "Start with one thing you want to get done." : "\(tasks.count - done) tasks left this week.")
                .font(.caption).foregroundStyle(.secondary)
        }.modifier(PlannerCard())
    }

    @ViewBuilder private var pendingTasks: some View {
        let pending = store.pending(before: week, category: activeCategory.id)
        if !pending.isEmpty {
            DisclosureGroup {
                VStack(spacing: 8) {
                    ForEach(pending) { item in
                        HStack(alignment: .top, spacing: 8) {
                            Button { store.toggle(item.task, date: item.date, category: activeCategory.id) } label: {
                                Image(systemName: "circle").frame(width: 44, height: 44)
                            }.accessibilityLabel("Complete \(item.task.text)").disabled(!store.canEdit)
                            VStack(alignment: .leading, spacing: 4) {
                                Text(item.task.text).font(.subheadline)
                                Text(PlannerDates.title(item.date, format: "MMM d, yyyy")).font(.caption).foregroundStyle(.secondary)
                            }.frame(maxWidth: .infinity, alignment: .leading).padding(.top, 8)
                            Button("Move here") {
                                store.move(item.task, from: item.date, to: week, category: activeCategory.id)
                            }.font(.caption.weight(.semibold)).frame(minHeight: 44).disabled(!store.canEdit)
                        }
                    }
                }.padding(.top, 12)
            } label: {
                Label("Still on your list · \(pending.count)", systemImage: "arrow.uturn.forward")
                    .font(.subheadline.weight(.semibold))
            }.modifier(PlannerCard())
        }
    }

    private var goalsCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            Label("Weekly goals", systemImage: "scope").font(.headline).foregroundStyle(tint)
            Text("What would make this a good week?").font(.caption).foregroundStyle(.secondary)
            TextEditor(text: Binding(
                get: { store.goals(week, category: activeCategory.id) },
                set: { store.setGoals($0, week: week, category: activeCategory.id) }
            ))
            .scrollContentBackground(.hidden).frame(minHeight: 155)
            .accessibilityLabel("Weekly goals for \(activeCategory.name)")
            .disabled(!store.canEdit)
        }.modifier(PlannerCard())
    }

    private var monthCalendar: some View {
        VStack(spacing: 14) {
            HStack {
                ForEach(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], id: \.self) { name in
                    Text(name).font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity)
                }
            }
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 4), count: 7), spacing: 10) {
                ForEach(PlannerDates.monthGrid(selectedDate), id: \.self) { date in
                    let record = store.day(date, category: activeCategory.id)
                    let inMonth = PlannerDates.calendar.isDate(date, equalTo: selectedDate, toGranularity: .month)
                    let isToday = PlannerDates.calendar.isDate(date, inSameDayAs: today)
                    Button {
                        selectedDate = date
                        focusedDay = DaySelection(date: date)
                    } label: {
                        VStack(spacing: 6) {
                            Text("\(PlannerDates.calendar.component(.day, from: date))")
                                .font(.body.weight(isToday ? .bold : .regular)).monospacedDigit()
                            HStack(spacing: 3) {
                                if !record.tasks.isEmpty { Circle().fill(tint).frame(width: 4, height: 4) }
                                if !record.notes.isEmpty { Circle().fill(PlannerStyle.success).frame(width: 4, height: 4) }
                            }.frame(height: 5)
                        }
                        .frame(maxWidth: .infinity, minHeight: 52)
                        .background(isToday ? tint.opacity(0.2) : Color.clear, in: RoundedRectangle(cornerRadius: 12))
                        .foregroundStyle(inMonth ? Color.primary : Color.secondary)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("\(PlannerDates.title(date, format: "EEEE MMMM d yyyy")), \(record.tasks.count) tasks")
                }
            }
            Text("Tap a date to plan your day. Category dot: tasks. Green dot: notes.")
                .font(.caption).foregroundStyle(.secondary).padding(.top, 6)
        }.modifier(PlannerCard())
    }

    private var backupMenu: some View {
        Menu {
            Button {
                backup = PlannerBackup(document: store.document)
                showExport = true
            } label: { Label("Export backup", systemImage: "square.and.arrow.up") }
            .disabled(!store.canEdit)
            Button { confirmImport = true } label: { Label("Restore backup…", systemImage: "square.and.arrow.down") }
            if store.storageError != nil && store.canEdit {
                Button("Retry saving") { store.save() }
            }
        } label: { Image(systemName: "ellipsis.circle").frame(width: 44, height: 44) }
        .accessibilityLabel("Planner backup options")
    }

    private func shiftPeriod(_ direction: Int) {
        if mode == 0 { selectedDate = PlannerDates.adding(direction * 7, to: selectedDate) }
        else {
            selectedDate = PlannerDates.calendar.date(byAdding: .month, value: direction,
                                                       to: PlannerDates.monthStart(selectedDate))!
        }
    }
}

@MainActor
private struct DayCardView: View {
    @EnvironmentObject private var store: PlannerStore
    let date: Date
    let category: PlannerCategory
    let today: Date
    let open: () -> Void
    @State private var newTask = ""
    private var record: DayRecord { store.day(date, category: category.id) }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Button(action: open) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(PlannerDates.title(date, format: "EEEE")).font(.headline)
                        Text(PlannerDates.title(date, format: "MMM d")).font(.caption).foregroundStyle(.secondary)
                    }
                    Spacer()
                    if PlannerDates.calendar.isDate(date, inSameDayAs: today) {
                        Text("TODAY").font(.caption2.weight(.bold)).padding(7)
                            .background(PlannerStyle.color(category.tint).opacity(0.18), in: Capsule())
                    } else { Image(systemName: "arrow.up.right").font(.caption).foregroundStyle(.secondary) }
                }.frame(minHeight: 44, alignment: .top).contentShape(Rectangle())
            }.buttonStyle(.plain).accessibilityLabel("Open \(PlannerDates.title(date, format: "EEEE MMMM d"))")
            if record.tasks.isEmpty && record.notes.isEmpty {
                Text("A little space for your plans.").font(.subheadline).foregroundStyle(.secondary).padding(.vertical, 8)
            }
            ForEach(Array(record.tasks.prefix(4))) { task in
                HStack(alignment: .top, spacing: 4) {
                    Button { store.toggle(task, date: date, category: category.id) } label: {
                        Image(systemName: task.completed ? "checkmark.circle.fill" : "circle")
                            .foregroundStyle(task.completed ? PlannerStyle.success : Color.secondary)
                            .frame(width: 44, height: 44)
                    }.buttonStyle(.plain).disabled(!store.canEdit)
                        .accessibilityLabel("\(task.completed ? "Reopen" : "Complete") \(task.text)")
                    Text(task.text).font(.subheadline).strikethrough(task.completed)
                        .foregroundStyle(task.completed ? Color.secondary : Color.primary)
                        .frame(maxWidth: .infinity, alignment: .leading).padding(.top, 11)
                }
            }
            if record.tasks.count > 4 {
                Button("View all \(record.tasks.count) tasks", action: open).font(.caption.weight(.semibold)).frame(minHeight: 44)
            }
            if !record.notes.isEmpty {
                Text(record.notes).font(.caption).foregroundStyle(.secondary).lineLimit(3).padding(.vertical, 4)
            }
            HStack {
                TextField("Add a task", text: $newTask).font(.subheadline).onSubmit(add)
                Button(action: add) { Image(systemName: "plus.circle.fill").font(.title2).frame(width: 44, height: 44) }
                    .accessibilityLabel("Add task to \(PlannerDates.title(date, format: "EEEE"))")
                    .disabled(newTask.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }.disabled(!store.canEdit)
            Button("Open day & notes", action: open).font(.caption.weight(.semibold)).frame(minHeight: 44)
        }.modifier(PlannerCard())
    }

    private func add() {
        store.addTask(newTask, date: date, category: category.id)
        newTask = ""
    }
}

@MainActor
private struct DayDetailView: View {
    @EnvironmentObject private var store: PlannerStore
    @Environment(\.dismiss) private var dismiss
    let date: Date
    let category: PlannerCategory
    @State private var newTask = ""
    @State private var taskToDelete: PlannerTask?
    private var record: DayRecord { store.day(date, category: category.id) }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Text(PlannerDates.title(date, format: "EEEE, MMMM d, yyyy")).font(.headline)
                    Label(category.name, systemImage: "circle.fill").font(.caption)
                        .foregroundStyle(PlannerStyle.color(category.tint))
                    if let error = store.storageError {
                        Text(error).font(.caption).foregroundStyle(.orange)
                    }
                }
                Section("Tasks") {
                    ForEach(record.tasks) { task in
                        HStack(alignment: .top) {
                            Button { store.toggle(task, date: date, category: category.id) } label: {
                                Image(systemName: task.completed ? "checkmark.circle.fill" : "circle")
                                    .foregroundStyle(task.completed ? PlannerStyle.success : Color.secondary)
                                    .frame(width: 44, height: 44)
                            }.buttonStyle(.borderless).accessibilityLabel(task.completed ? "Mark incomplete" : "Mark complete")
                            TextField("Task", text: Binding(
                                get: { store.day(date, category: category.id).tasks.first { $0.id == task.id }?.text ?? "" },
                                set: { text in var changed = task; changed.text = text; store.updateTask(changed, date: date, category: category.id) }
                            ), axis: .vertical)
                            .strikethrough(task.completed).padding(.vertical, 10)
                            .accessibilityLabel("Task text")
                            Menu {
                                Button("Move to previous day") {
                                    store.move(task, from: date, to: PlannerDates.adding(-1, to: date), category: category.id)
                                }
                                Button("Move to next day") {
                                    store.move(task, from: date, to: PlannerDates.adding(1, to: date), category: category.id)
                                }
                                Button("Delete task", role: .destructive) { taskToDelete = task }
                            } label: { Image(systemName: "ellipsis").frame(width: 44, height: 44) }
                            .accessibilityLabel("Options for \(task.text)")
                        }.disabled(!store.canEdit)
                    }
                    HStack {
                        TextField("Add a task", text: $newTask).onSubmit(add)
                        Button("Add", action: add).frame(minHeight: 44)
                            .disabled(newTask.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    }.disabled(!store.canEdit)
                }
                Section("Notes") {
                    TextEditor(text: Binding(
                        get: { store.day(date, category: category.id).notes },
                        set: { store.setNotes($0, date: date, category: category.id) }
                    )).frame(minHeight: 210).accessibilityLabel("Day notes").disabled(!store.canEdit)
                }
            }
            .scrollContentBackground(.hidden).background(PlannerStyle.background)
            .navigationTitle(PlannerDates.title(date, format: "MMM d"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
            .tint(PlannerStyle.color(category.tint))
            .alert("Delete this task?", isPresented: Binding(get: { taskToDelete != nil }, set: { if !$0 { taskToDelete = nil } })) {
                Button("Cancel", role: .cancel) { taskToDelete = nil }
                Button("Delete", role: .destructive) {
                    if let task = taskToDelete { store.delete(task, date: date, category: category.id) }
                    taskToDelete = nil
                }
            } message: { Text(taskToDelete?.text ?? "") }
        }
    }

    private func add() {
        store.addTask(newTask, date: date, category: category.id)
        newTask = ""
    }
}
