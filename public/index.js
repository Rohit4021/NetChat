if ('serviceWorker' in navigator) {
    addEventListener('load', async () => {
        let uuid = new DeviceUUID().get()
        await navigator.serviceWorker.register(`${window.location.protocol}//${window.location.host}/sw.js`).then(async (sub) => {
            const cookie = await sub.cookies.getSubscriptions()
            if (cookie.length === 0) {
                const subscriptions = [{ name: uuid, url: `/` }]
                await sub.cookies.subscribe(subscriptions)
            }
        })
        const reg = await navigator.serviceWorker.ready
        const urlSplit = document.referrer.split('/')

        // try {
        //     await reg.sync.register("sync")
        // } catch (e) {
        //     console.log(e);
        // }

        if (urlSplit[3] === 'login') {
            socket.emit('getKey', uuid)
        }

        socket.on('sendKey', key => {
            reg.pushManager.getSubscription().then(async (subscription) => {
                if (!subscription) {
                    let push = await reg.pushManager.subscribe({
                        userVisibleOnly: true,
                        applicationServerKey: key
                    })

                    let things = {
                        push,
                        deviceId: uuid
                    }

                    socket.emit('sendToDatabase', things)
                } else {
                    subscription.unsubscribe().then(async () => {
                        await reg.pushManager.subscribe({
                            userVisibleOnly: true,
                            applicationServerKey: key
                        }).then((push) => {
                            console.log(push.toJSON())
                        })
                    })
                }
            })
        })
    })
}