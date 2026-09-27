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

// --- Better Auth required tables -------------------------------------------
// Column names are camelCase to match Better Auth's defaults. Do not rename.

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expiresAt", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
})

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
})

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt", { withTimezone: true }).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow(),
})

// --- App tables ------------------------------------------------------------
// Every table carries a plain `userId` (mapped to the existing `user_id`
// column) so queries can be scoped per user. There is no RLS on Neon.

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
