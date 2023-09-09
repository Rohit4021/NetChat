const cacheName = 'js13kPWA-v1'
const appShellFiles = [
    "/index.js",
    "/favicon.png",
    "../server.js"
]

self.addEventListener("install", (event) => {
    event.waitUntil(caches.open(cacheName).then((cache) => {
        cache.addAll(appShellFiles)
    }))
})

self.addEventListener('sync', () => {
    self.dispatchEvent(new ExtendableEvent('pushsubscriptionchange'))
})

self.addEventListener('periodicsync', async event => {
    const cookie = await self.registration.cookies.getSubscriptions()
    console.log(cookie[0].name)
    self.registration.pushManager.getSubscription().then(sub => {
        fetch('/subchange', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                deviceId: cookie[0].name,
                new_endpoint: sub.toJSON().endpoint,
                new_p256dh: sub.toJSON().keys.p256dh,
                new_auth: sub.toJSON().keys.auth
            })
        }).then(r => console.log(r))
    })
})

self.addEventListener('push', async (payload) => {
    console.log(payload.data.json())
    const data = payload.data.json()
    if (data.type === 'pushsubscriptionchange') {
        console.log('pushsubscriptionchange')
        self.dispatchEvent(new ExtendableEvent('pushsubscriptionchange'))
    } else if (data.type === 'pushsubscription') {

        console.log('pushsubscription')

        await self.skipWaiting().then(async () => {
            await clients.matchAll().then((allClients) => {
                if (allClients.length === 0) {
                    console.log('0')
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

                        if (client[1] !== data.title && allClients[i].visibilityState !== 'visible') {
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

    }
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

self.addEventListener('pushsubscriptionchange', async () => {
    const deviceId = await self.registration.cookies.getSubscriptions()
    const res = await fetch(`/publickey?deviceid=${deviceId[0].name}`)
    const publicKey = await res.text()
    await self.registration.pushManager.getSubscription().then((sub) => {
        sub.unsubscribe().then(() => {
            self.registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: publicKey
            }).then(sub => {
                const push = sub.toJSON()
                fetch('/subchange', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        deviceId: deviceId[0].name,
                        new_endpoint: push.endpoint,
                        new_p256dh: push.keys.p256dh,
                        new_auth: push.keys.auth
                    })
                }).then(async r => console.log(JSON.parse(await r.text()))).catch(e => console.log(e))
            })
        })
    })
})