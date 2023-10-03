const socket = io.connect()

let data = []
let cookieUser

socket.on('searchData', searchData => {
    data = searchData
})

socket.on('sendCookie', cookie => {
    cookieUser = cookie
})

function add(btn) {
    if (btn.childNodes[0].innerHTML === 'Requested') {
        btn.childNodes[0].innerHTML = 'Add'
        socket.emit('cancelRequest', btn.id)
    } else if (btn.childNodes[0].innerHTML === 'Add') {
        socket.emit('addFriend', btn.id)
        btn.childNodes[0].innerHTML = 'Requested'
    }

}

function loaded() {
    if (document.getElementById('input_text').value.length !== 0) {
        document.getElementById('clear').style.display = 'block'
    } else {
        document.getElementById('clear').style.display = 'none'
    }
}

socket.on('list', list => {
    for (let i = 0; i < list.length; i++) {
        const elem = document.getElementById(list[i].friend)
        if (list[i].success === true) {
            elem.childNodes[0].innerHTML = 'Added'
        } else {
            elem.childNodes[0].innerHTML = 'Requested'
        }
    }
})

socket.on('requests', requests => {
    if (requests.length !== 0) {
        const reqCircle = document.getElementsByClassName('request_circle')
        reqCircle[0].style.display = 'inline-block'
        reqCircle[0].innerText = requests.length
    }
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
    for (let i = 0; i < data.length; i++)    {
        if (data[i].username !== cookieUser) {
            if (data[i].username.startsWith(input.value.toLowerCase())) {
                if (data[i].success === true) {
                    const container = document.createElement('div')
                    container.classList.add('container')
                    container.style.margin = '2px'
                    const heading = document.createElement('h3')
                    heading.style.display = 'inline-block'
                    heading.classList.add('username')
                    heading.innerText = data[i].username
                    //<button onclick="document.getElementById('link').click()" class="link_container"><a id="link" class="link" href="/users?user=${chatUsername}">Chat</a></button>
                    const button = document.createElement('button')
                    button.setAttribute('onclick', 'add(this)')
                    button.classList.add('link_container')
                    button.setAttribute('id', data[i].username)
                    const link = document.createElement('a')
                    link.setAttribute('id', 'link')
                    link.classList.add('link')
                    button.appendChild(link)
                    container.appendChild(heading)
                    container.appendChild(button)
                    mainDiv.appendChild(container)

                    socket.emit('callList')
                }
            } else {
                const div = document.getElementsByClassName('container')
                setTimeout(() => {
                    if (div.length === 0) {
                        const divEl = document.createElement('div')
                        divEl.classList.add('container')
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

document.onselectstart = () => {
    event.preventDefault()
}

const redirect = () => {
    window.location.href = "/requests"
}
