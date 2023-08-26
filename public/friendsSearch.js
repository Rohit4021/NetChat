const socket = io.connect()

let data = []
let cookieUser

function loaded() {
    if (document.getElementById('input_text').value.length !== 0) {
        document.getElementById('clear').style.display = 'block'
    } else {
        document.getElementById('clear').style.display = 'none'
    }

}


socket.on('searchData', searchData => {
    data = searchData
})


socket.on('sendCookie', cookie => {
    cookieUser = cookie
})

async function search(input) {

    const div = document.getElementsByClassName('main')
    div[0].remove()
    const mainDiv = document.createElement('div')
    mainDiv.classList.add('main')
    const inputDiv = document.createElement('div')
    inputDiv.classList.add('input_div')
    const inputEl = document.createElement('input')
    inputEl.setAttribute('id', 'input_text')
    inputEl.setAttribute('type', 'text')
    inputEl.setAttribute('oninput', 'search(this)')
    inputEl.setAttribute('spellcheck', 'false')
    inputEl.value = input.value
    const img = document.createElement('img')
    img.setAttribute('src', '/x-circle.svg')
    img.setAttribute('id', 'clear')
    img.setAttribute('onclick', 'document.getElementById("input_text").value = "";window.location.reload();')
    inputDiv.appendChild(inputEl)
    inputDiv.appendChild(img)
    mainDiv.appendChild(inputDiv)
    document.body.appendChild(mainDiv)
    for (let i = 0; i < data.length; i++) {
        if (data[i].friend !== cookieUser) {
            if (data[i].friend.startsWith(input.value.toLowerCase())) {
                const container = document.createElement('div')
                container.classList.add('friend_container')
                container.setAttribute('onclick', 'this.childNodes[0].click()')
                const containerA = document.createElement('a')
                containerA.setAttribute('href', `/profile/${data[i].friend}`)
                containerA.style.display = 'inline-block'
                containerA.style.textDecoration = 'none'
                containerA.classList.add('username')
                const h3 = document.createElement('h3')
                h3.innerText = data[i].friend
                containerA.appendChild(h3)
                container.appendChild(containerA)
                mainDiv.appendChild(container)

            } else {
                const div = document.getElementsByClassName('friend_container')
                setTimeout(() => {
                    if (div.length === 0) {
                        const divEl = document.createElement('div')
                        divEl.classList.add('friend_container')
                        divEl.style.display = 'block'
                        divEl.style.margin = '5px'
                        const p = document.createElement('p')
                        p.style.color = 'white'
                        p.innerText = 'No User Found'
                        p.style.fontSize = '18px'
                        divEl.appendChild(p)
                        mainDiv.appendChild(divEl)
                    }
                }, 100)
            }
        }

    }


    const focusEl = document.getElementById('input_text')
    focusEl.focus()
}


socket.on('pendingChats', chats => {
    for (let i = 0; i < chats.chats.length; i++) {
        const pendingUser = chats.chats[i].replace(`${chats.name}`, "")
        const pen = document.getElementById(pendingUser)
        const parentPending = pen.parentElement
        parentPending.classList.add('pending')
        const circle = document.createElement('div')
        circle.classList.add('circle')
        parentPending.appendChild(circle)
    }
})

socket.on('requests', requests => {
    if (requests.length !== 0) {
        const add = document.getElementsByClassName('add')[0]
        add.src = '/addRequests.jpg'
    }
})

document.onselectstart = () => {
    event.preventDefault()
}
