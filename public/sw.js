// Service Worker for Web Push Notifications

self.addEventListener("push", (event) => {
  if (!event.data) return

  let data
  try {
    data = event.data.json()
  } catch {
    data = { title: "Don't Forget", body: event.data.text() }
  }

  const { title = "Don't Forget", body = "Time to plan your day!", icon, badge, url } = data

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: icon || "/icon.svg",
      badge: badge || "/icon.svg",
      data: { url: url || "/" },
      actions: [
        { action: "open", title: "Open App" },
        { action: "dismiss", title: "Dismiss" },
      ],
      requireInteraction: false,
    })
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()

  if (event.action === "dismiss") return

  const targetUrl = event.notification.data?.url || "/"

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        // If there's already an open window, focus it
        for (const client of windowClients) {
          if (client.url === targetUrl && "focus" in client) {
            return client.focus()
          }
        }
        // Otherwise open a new window
        if (clients.openWindow) {
          return clients.openWindow(targetUrl)
        }
      })
  )
})
