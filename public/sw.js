const cacheName = 'js13kPWA-v1'
const appShellFiles = [
    "/index.js",
    "/favicon.png"
]

self.addEventListener("install", (event) => {
    event.waitUntil(caches.open(cacheName).then((cache) => {
        cache.addAll(appShellFiles)
    }))
})

self.addEventListener('push', async (payload) => {
    const data = payload.data.json()
    await self.skipWaiting().then(async () => {
        await clients.matchAll().then((allClients) => {
            if (allClients.length === 0) {
                self.registration.showNotification('NetChat', {
                    body: `${data.title} : ${data.msg}`,
                    icon: data.icon,
                    vibrate: [100, 50, 100],
                    data: data.this
                })
            }

            for (let i = 0; i < allClients.length; i++) {
                if (allClients[i].url.includes('/chats/')) {
                    const clientUrl = allClients[i].url.split('/')
                    const client = clientUrl[4].split('_')

                    if (client[1] === data.title && allClients[i].visibilityState === 'visible') {
                    } else {
                        self.registration.showNotification('NetChat', {
                            body: `${data.title} : ${data.msg}`,
                            icon: data.icon,
                            vibrate: [100, 50, 100],
                            data: data.this
                        })
                    }
                } else {
                    self.registration.showNotification('NetChat', {
                        body: `${data.title} : ${data.msg}`,
                        icon: data.icon,
                        vibrate: [100, 50, 100],
                        data: data.this
                    })
                }
            }
        })
    })
})

self.addEventListener('notificationclick', event => {
    const split = event.notification.body.split(' ')
    event.notification.close()

    let url = `http://localhost:8000/chats/${event.notification.data}_${split[0]}`

    event.waitUntil(
        clients.matchAll({
            type: 'window'
        }).then(clientList => {
            if (clientList.length === 0) {
                clients.openWindow(`/chats/${event.notification.data}_${split[0]}`)
            }
            for (const client of clientList) {
                if (client.url === url && "focus" in client) return client.focus()
                else if (clients.openWindow) return clients.openWindow(`/chats/${event.notification.data}_${split[0]}`)
            }
        })
    )
})

self.addEventListener('pushsubscriptionchange', (event) => {
    event.waitUntil(self.registration.pushManager.subscribe(event.oldSubscription.options)
        .then(subscription => {
            fetch('/subchange', {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    endpoint: subscription.endpoint,
                    p256dh: subscription.keys.p256dh,
                    auth: subscription.keys.auth,
                    serverKey: event.oldSubscription.options.applicationServerKey
                })
            })
        }))
})
