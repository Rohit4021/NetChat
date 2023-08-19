if ('serviceWorker' in navigator) {
    addEventListener('load', async () => {
        await navigator.serviceWorker.register(`http://localhost:8000/sw.js`)
        const reg = await navigator.serviceWorker.ready
        let uuid = new DeviceUUID().get()
        const urlSplit = document.referrer.split('/')

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


                }
            })
        })
    })
}

