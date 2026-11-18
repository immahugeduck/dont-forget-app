// Service Worker for Web Push Notifications
// Task reminders carry { kind: "task", checklistId, tag } and get
// "Snooze 10 min" / "Done" buttons that work without opening the app.

self.addEventListener("install", () => self.skipWaiting())
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()))

self.addEventListener("push", (event) => {
  if (!event.data) return

  let data
  try {
    data = event.data.json()
  } catch {
    data = { title: "Don't Forget", body: event.data.text() }
  }

  const { title = "Don't Forget", body = "Time to plan your day!", icon, badge, url, kind, checklistId, tag } = data
  const isTask = kind === "task" && checklistId

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: icon || "/icon-192.png",
      badge: badge || "/icon-192.png",
      tag: tag || undefined,
      renotify: Boolean(tag),
      timestamp: data.dueAt ? Date.parse(data.dueAt) : Date.now(),
      data: { url: url || "/", kind, checklistId },
      actions: isTask
        ? [
            { action: "snooze", title: "Snooze 10 min" },
            { action: "done", title: "Done" },
          ]
        : [
            { action: "open", title: "Open App" },
            { action: "dismiss", title: "Dismiss" },
          ],
      // Task reminders stay on screen until handled (desktop Chrome/Edge).
      requireInteraction: Boolean(isTask),
    }),
  )
})

function reminderAction(checklistId, action) {
  return fetch("/api/reminders/action", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ checklistId, action, minutes: 10 }),
  }).then((res) => res.ok)
}

function openApp(path) {
  const targetUrl = new URL(path || "/", self.location.origin).href
  return clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
    // Reuse an open app window: navigate it to the target and focus it.
    for (const client of windowClients) {
      if (new URL(client.url).origin === self.location.origin && "focus" in client) {
        const nav = client.url !== targetUrl && "navigate" in client ? client.navigate(targetUrl) : Promise.resolve(client)
        return nav.then((c) => (c || client).focus())
      }
    }
    if (clients.openWindow) return clients.openWindow(targetUrl)
  })
}

self.addEventListener("notificationclick", (event) => {
  const n = event.notification
  n.close()
  const { url, checklistId } = n.data || {}

  if (event.action === "dismiss") return

  if ((event.action === "snooze" || event.action === "done") && checklistId) {
    event.waitUntil(
      reminderAction(checklistId, event.action)
        .then((ok) => {
          // Not signed in here (or offline): open the app so nothing is lost.
          if (!ok) return openApp(url)
          if (event.action === "snooze") {
            return self.registration.showNotification("Snoozed", {
              body: `${n.body}\nWe'll remind you again in 10 minutes.`,
              icon: "/icon-192.png",
              badge: "/icon-192.png",
              tag: `snoozed-${checklistId}`,
              silent: true,
            })
          }
        })
        .catch(() => openApp(url)),
    )
    return
  }

  event.waitUntil(openApp(url))
})
