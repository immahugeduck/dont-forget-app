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

  const targetUrl = new URL(event.notification.data?.url || "/", self.location.origin).href

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // Reuse an open app window: navigate it to the target and focus it.
      for (const client of windowClients) {
        if (new URL(client.url).origin === self.location.origin && "focus" in client) {
          const nav = client.url !== targetUrl && "navigate" in client ? client.navigate(targetUrl) : Promise.resolve(client)
          return nav.then((c) => (c || client).focus())
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl)
      }
    })
  )
})
