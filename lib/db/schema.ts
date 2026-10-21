import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  uuid,
  date,
  time,
} from "drizzle-orm/pg-core"

// --- App tables ------------------------------------------------------------
// Every table carries a plain `userId` (mapped to the existing `user_id`
// column) so queries can be scoped per user. Server routes connect as the database owner,
// which bypasses RLS, so scoping by user is enforced in code.

export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  date: date("date").notNull(),
  time: time("time"),
  status: text("status").notNull().default("pending"),
  priority: text("priority").default("medium"),
  tags: text("tags").array().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
})

export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  date: date("date").notNull(),
  startTime: time("start_time"),
  endTime: time("end_time"),
  allDay: boolean("all_day").default(false),
  color: text("color").default("#3b82f6"),
  tags: text("tags").array().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
})

export const notes = pgTable("notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  date: text("date").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
})

export const checklists = pgTable("checklists", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  date: text("date").notNull(),
  slotId: text("slot_id").notNull(),
  category: text("category").notNull(),
  text: text("text").notNull(),
  completed: boolean("completed").default(false),
  position: integer("position").notNull().default(0),
  dueTime: text("due_time"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
})

export const weatherCache = pgTable("weather_cache", {
  id: uuid("id").primaryKey().defaultRandom(),
  date: text("date").notNull().unique(),
  tempHigh: integer("temp_high"),
  tempLow: integer("temp_low"),
  conditions: text("conditions").array().default([]),
  icon: text("icon"),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).defaultNow(),
})

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  reminderTime: text("reminder_time").notNull().default("08:00"),
  enabled: boolean("enabled").notNull().default(true),
  // UTC day (YYYY-MM-DD) the daily reminder was last delivered.
  lastSentOn: date("last_sent_on", { mode: "string" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
})

// Native (Capacitor/Android) FCM device push tokens. Separate from
// push_subscriptions because FCM uses a single opaque token per device,
// not a web-push endpoint + VAPID keypair.
export const deviceTokens = pgTable("device_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  token: text("token").notNull(),
  platform: text("platform").notNull().default("android"),
  reminderTime: text("reminder_time").notNull().default("08:00"),
  enabled: boolean("enabled").notNull().default(true),
  // UTC day (YYYY-MM-DD) the daily reminder was last delivered.
  lastSentOn: date("last_sent_on", { mode: "string" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
})

export const taskReminders = pgTable("task_reminders", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  checklistId: uuid("checklist_id").notNull(),
  reminderDatetime: timestamp("reminder_datetime", { withTimezone: true }).notNull(),
  sent: boolean("sent").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})

export const userCategories = pgTable("user_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  color: text("color").notNull().default("#8b5cf6"),
  icon: text("icon").notNull().default("folder"),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})

export const userTags = pgTable("user_tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  color: text("color").notNull().default("#3b82f6"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})

export const checklistTags = pgTable("checklist_tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  checklistId: uuid("checklist_id").notNull(),
  tagId: uuid("tag_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})
