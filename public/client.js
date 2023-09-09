const socket = io.connect()

const url = new URL(window.location.href)
const urlToSplit = url + ''

let name
let user
let uuid = new DeviceUUID().get()


const new_url = urlToSplit.split('/')
const param = new_url[4].split('_')
name = param[0]
user = param[1]

let friend = document.getElementsByClassName('user_name')

function add() {
    socket.emit('addFriend', friend)
}

let textarea = document.querySelector('#textarea')
let messageArea = document.querySelector('.message__area')


textarea.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') {
        sendMessage(e.target.value)
        textarea.value = ''
        document.getElementById('imgLogo').style.display = 'inline-block';
        document.getElementById('send').style.display = 'none';
    }
})

function change(img) {
    const image = img.files[0]
    sendImage(image)
}

function msgStatus() {
    if (document.getElementsByClassName('seen')[0]) {
        document.getElementsByClassName('seen')[0].remove()
    }

    const seen = document.createElement('p')
    seen.classList.add('seen')
    seen.innerText = 'Sent'
    messageArea.appendChild(seen)

    for (let i = 0; i < outgoing.length; i++) {
        if (navigator.userAgent.match(/Android/i) || navigator.userAgent.match(/iPhone/i)) {
            outgoing[i].addEventListener('contextmenu', e => e.preventDefault())
        } else {
            outgoing[i].addEventListener('contextmenu', showmenu)
        }
    }
}

function appendToday() {
    const dateConstructor = new Date()
    let date
    let month
    let year = dateConstructor.getFullYear().toString()

    if (dateConstructor.getDate().toString().length === 1) {
        date = '0' + dateConstructor.getDate().toString()
    } else {
        date = dateConstructor.getDate().toString()
    }

    if (dateConstructor.getMonth().toString().length === 1) {
        month = '0' + (dateConstructor.getMonth() + 1)
    } else {
        month = dateConstructor.getMonth().toString()
    }

    const fullDate = date + month + year

    let p

    const getP = document.getElementsByClassName(fullDate)
    if (getP.length === 0) {
        p = document.createElement('p')
        p.setAttribute('id', 'day')
        p.classList.add(fullDate)
        p.innerText = 'Today'
        messageArea.appendChild(p)
    }
}

const sendImage = (image) => {
    msg = {
        user: name,
        id: user,
        msgId: Math.floor(Math.random() * 1000000000).toString(),
        type: 'image',
        message: image,
        filename: image.name,
        deviceId: uuid
    }

    socket.emit('message', msg)

    let displayImage
    const reader = new FileReader()
    reader.addEventListener("load", () => {
        displayImage = reader.result
        appendImage(displayImage, msg.msgId, 'outgoing')
    })
    reader.readAsDataURL(image)
}

let msg

const sendMessage = (message) => {
    msg = {
        user: name,
        id: user,
        msgId: Math.floor(Math.random() * 1000000000).toString(),
        type: 'text',
        message: message.trim(),
        deviceId: uuid
    }

    socket.emit('message', msg)

    appendToday()

    appendMessage(msg, 'outgoing')

    scrollToBottom()

    msgStatus()


}


const appendMessage = (msg, type) => {


    let mainDiv = document.createElement('div')
    mainDiv.setAttribute('id', msg.msgId)
    mainDiv.classList.add(type, 'message')

    let markup

    if (isValidURL(msg.message)) {
        markup = `
        <a href="${msg.message}">${msg.message}</a>
    `
    } else {
        markup = `
        <p>${msg.message}</p>
    `
    }



    mainDiv.innerHTML = markup

    messageArea.appendChild(mainDiv)
}

const sendImageFromAndroid = (base64) => {
    let msg = {
        user: name,
        id: user,
        msgId: Math.floor(Math.random() * 1000000000).toString(),
        type: 'image',
        message: base64,
        filename: 'image.name&base64',
        deviceId: uuid
    }

    socket.emit('message', msg)

    const url = `data:image/png;base64,${base64}`

    appendImage(url, msg.msgId, 'outgoing')

}

const appendImage = (url, id, type) => {
    appendToday()
    const div = document.createElement('div')
    div.classList.add('imgMsgDiv', 'message', `${type}`)
    if (type === 'outgoing') {
        div.style.marginLeft = 'auto'
    }
    div.setAttribute('id', id)
    div.setAttribute('onclick', 'showPreview(this)')
    div.setAttribute('style', 'display: block;')
    div.style.backgroundImage = `url("${url}")`
    messageArea.appendChild(div)
    msgStatus()

    scrollToBottom()
}

socket.on('msg', (msg) => {

    if (msg.msg.id === name) {
        appendToday()
    }

    if (msg.msg.type === 'image') {
        appendImage(msg.msg.message, msg.msg.msgId, 'incoming')
    } else if (msg.msg.type === 'text') {
        appendMessage(msg.msg, 'incoming')
    }


    if (document.getElementsByClassName('seen')[0]) {
        document.getElementsByClassName('seen')[0].remove()
    }

    try {
        if (Android) {
            Android.sendNotification(msg.msg.user, "New Messages", msg.pic)
        }
    } catch (e) {
    }

    scrollToBottom()

})
const scrollToBottom = () => {
    messageArea.scrollTop = messageArea.scrollHeight
}

socket.on('chatHistory', (data) => {
    const messages = document.getElementsByClassName('message')
    messages.remove
    const allChat = data[0].chats

    const chat = allChat.filter((item) => {
        return item.del !== name
    })

    if (chat.length !== 0) {
        for (let i = 0; i < chat.length; i++) {

            let preDate

            const dt = chat[i].date.split('T')

            if (preDate !== dt || i === 0) {
                const date = dt[0].split('-')

                let day = date[2]
                const month = date[1]
                const year = date[0]

                let fl = day + month + year

                const search = document.getElementsByClassName(day + month + year)

                if (search.length === 0) {
                    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

                    const nMonth = month.split('0')

                    const da = document.createElement('p')
                    da.setAttribute('id', 'day')

                    da.innerText = `${day} ${months[nMonth[1] - 1]}, ${year}`
                    da.classList.add(day + month + year)
                    messageArea.appendChild(da)

                    const dateConstructor = new Date()
                    let date
                    let monthTD
                    let yearTD = dateConstructor.getFullYear().toString()

                    if (dateConstructor.getDate().toString().length === 1) {
                        date = '0' + dateConstructor.getDate().toString()
                    } else {
                        date = dateConstructor.getDate().toString()
                    }

                    if (dateConstructor.getMonth().toString().length === 1) {
                        monthTD = '0' + (dateConstructor.getMonth() + 1)
                    } else {
                        monthTD = dateConstructor.getMonth() + 1
                    }

                    const fullDate = date + monthTD.toString() + yearTD

                    let p


                    if (fl.toString() === fullDate.toString()) {
                        const getP = document.getElementsByClassName(fullDate.toString())
                        getP[0].remove()
                        if (getP.length === 0) {
                            p = document.createElement('p')
                            p.setAttribute('id', 'day')
                            p.classList.add(fullDate.toString())
                            p.innerText = 'Today'
                            messageArea.appendChild(p)
                        }
                    }

                }

                let preMsg

                if (preMsg !== chat[i].msgId) {
                    let chatD = chat[i].msg

                    let msg = {
                        user: chat[i].username,
                        msgId: chat[i].msgId,
                        message: chatD
                    }

                    if (chat[i].msgType === 'image') {
                        if (chat[i].username === name) {
                            appendImage(msg.message, msg.msgId, 'outgoing')
                        } else {
                            appendImage(msg.message, msg.msgId, 'incoming')
                        }
                    } else if (chat[i].msgType === 'text') {
                        if (chat[i].username === name) {
                            appendMessage(msg, 'outgoing')
                        } else {
                            appendMessage(msg, 'incoming')
                        }
                    }

                    preMsg = chat[i].msgId

                }
            }

            preDate = dt


        }
    }


    if (chat.length !== 0) {
        const lastMessage = chat[chat.length - 1]

        if (lastMessage.username === name) {
            if (lastMessage.status === 'read') {
                if (document.getElementsByClassName('seen')[0]) {
                    document.getElementsByClassName('seen')[0].remove()
                }
                const seen = document.createElement('p')
                seen.classList.add('seen')
                seen.innerText = 'Seen'
                messageArea.appendChild(seen)
            } else {
                if (document.getElementsByClassName('seen')[0]) {
                    document.getElementsByClassName('seen')[0].remove()
                }
                const seen = document.createElement('p')
                seen.classList.add('seen')
                seen.innerText = 'Sent'
                messageArea.appendChild(seen)
            }
        } else if (lastMessage.username === user) {
            if (document.getElementsByClassName('seen')[0]) {
                document.getElementsByClassName('seen')[0].remove()
            }

        }


    }


    scrollToBottom()
})

let usernamePro

socket.on('proPic', pic => {
    const img = document.getElementById('proPicImg')
    img.src = pic.pic

    const h1 = document.getElementById('h1Pro')
    h1.innerText = pic.nameProPic

    usernamePro = pic.usernamePro
})

function redirection() {
    window.location.href = `/profile/${usernamePro}`
}

socket.on('willRead', msg => {

    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === 'visible') {
            if (window.location.href.includes(`/chats/${name}_${msg.user}`)) {
                socket.emit('readDone', msg)
            }
        }
    })

})

socket.on('readDoneAgain', msg => {
    setTimeout(() => {
        if (msg.user === name || msg === 'msg') {
            document.getElementsByClassName('seen')[0].innerText = 'Seen'
        }
    }, 500)
})

let menu
menu = document.querySelector('.menu')
menu.classList.add('off')
menu.style.zIndex = '2'

const outgoing = document.getElementsByClassName('outgoing')

let mouseTimer
let id

function mouseDown() {
    id = this.id
    if (!mouseTimer) {
        mouseTimer = setTimeout(hold, 800)
    }
}

function mouseUp() {
    if (mouseTimer) {
        clearTimeout(mouseTimer)
        mouseTimer = null
    }
}

function hold() {
    document.getElementById('imgLogo').remove()
    textarea.style.display = 'none'
    document.getElementsByClassName('bi-camera-fill')[0].style.display = 'none'
    document.getElementById('info').style.display = 'inline-block'
    document.getElementById('delete').style.display = 'inline-block'
    setTimeout(() => {
        document.body.onclick = hideMM
    }, 1000)
}

setTimeout(() => {
    for (let i = 0; i < outgoing.length; i++) {
        outgoing[i].addEventListener('contextmenu', showmenu)
        outgoing[i].addEventListener('touchstart', mouseDown)
        document.body.addEventListener('touchend', mouseUp)
    }
}, 1000)

menu.addEventListener('mouseleave', hidemenu)

function showmenu(ev) {
    id = this.id
    ev.preventDefault()
    if (!navigator.userAgent.match(/Android/i) && !navigator.userAgent.match(/iPhone/i)) {
        menu.style.top = ev.clientY + 'px'
        menu.style.left = ev.clientX + 'px'
        menu.classList.remove('off')
    }
}

function hidemenu() {
    menu.classList.add('off')
    menu.style.top = '-200%'
    menu.style.left = '-200%'
}

function dfa() {
    hideMM()
    socket.emit('dfa', id)
    document.getElementById(id).remove()
    hidemenu()
}

function hideMM() {
    textarea.style.display = 'block'
    const i = document.createElement('i')
    i.classList.add('bi', 'bi-image')
    i.id = 'imgLogo'
    i.style.marginTop = '-45px'
    i.style.position = 'absolute'
    document.getElementsByClassName('bi-camera-fill')[0].style.display = 'inline-block'
    document.getElementById('imgLabel').appendChild(i)
    document.getElementById('info').style.display = 'none'
    document.getElementById('delete').style.display = 'none'

    document.body.onclick = null
}

function copy() {
    const copyText = document.getElementById(id).childNodes[1]
    navigator.clipboard.writeText(copyText.innerText)
    hideMM()
}

function deleteChat() {
    socket.emit('deleteChat', name)
    window.location.href = '/'
    document.getElementsByClassName('confirm')[0].style.display = 'none'
}

function exitPreview(div) {

    div.style.width = '200px'
    div.style.height = '300px'
    div.style.position = 'relative'
    const section = document.getElementsByClassName('chat__section')[0]
    section.style.visibility = 'visible'
    section.style.width = '100%'
    section.style.display = 'inline-block'
    section.style.height = 'auto'
    messageArea.style.overflowY = 'auto'
    messageArea.style.padding = '40px 16px 16px'
    document.getElementsByClassName('brand')[0].style.display = 'flex'
    document.getElementById('textarea_div').style.display = 'block'
    document.getElementsByClassName('chat__section')[0].style.visibility = 'visible'

    if (navigator.userAgent.match(/Android/i) || navigator.userAgent.match(/iPhone/i)) {
        section.style.width = '100%'
        section.style.maxWidth = '100%'
        messageArea.style.height = '600px'
    } else {
        section.style.width = '800px'
        section.style.maxWidth = '90%'
        messageArea.style.height = '500px'
    }

    scrollToBottom()
    document.body.onclick = null
}

async function showPreview(div) {
    const section = document.getElementsByClassName('chat__section')[0]
    section.style.visibility = 'hidden'
    section.style.width = '100%'
    section.style.maxWidth = '100%'
    section.style.height = '100vh'
    messageArea.style.height = '100vh'
    messageArea.style.padding = '0'
    messageArea.style.width = '100%'
    document.getElementsByClassName('brand')[0].style.display = 'none'
    document.getElementById('textarea_div').style.display = 'none'
    div.style.visibility = 'visible'
    div.style.width = '100%'
    div.style.height = '100vh'
    div.style.position = 'fixed'
    div.style.maxWidth = '100%'

    attachExitPreview(div)
}

function attachExitPreview(div) {
    setTimeout(() => {
        document.body.onclick = () => {
            exitPreview(div)
        }
    }, 1000)
}

function openCamera() {
    try {
        if (Android) {
            Android.capturePicture()
        }
    } catch (e) {
    }
}

function isValidURL(url) {
    try {
        new URL(url)
        return true
    } catch (e) {
        return false
    }
}
