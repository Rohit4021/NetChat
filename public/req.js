function accept(username) {
    socket.emit("acceptRequest", username.id)
    setTimeout(function () {
        window.location.reload()
    }, 1000)
}

function decline(username) {
    socket.emit("declineRequest", username.id)
    setTimeout(function () {
        window.location.reload()
    }, 1000)
}

socket.on('done', () => {
    window.location.reload()
})