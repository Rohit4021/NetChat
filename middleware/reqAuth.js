const { Users } = require('../db/conn')

const reqAuth = async (req, res, next) => {
    if (!req.cookies.user) {
        res.status(401).redirect('/login')
    } else {
        res.setHeader('Content-type', 'text/html')

        const users = await Users.find({username: req.cookies.user})
        res.write('<head><title>NetChat</title><meta name="viewport" content="width=device-width, initial-scale=1"><meta charset="UTF-8"><link rel="icon" type="image/x-icon" href="/favicon.png"><link rel="stylesheet" type="text/css" href="/secret.css"><script src="/socket.io/socket.io.js"></script><script>const socket = io.connect()</script></head><body><div class="main">')

        for (let i = 0; i < users.length; i++) {
            if (users[0].requests.length !== 0) {
                const requests = await users[0].requests
                const username = requests[i].user

                res.write(`<div class="container"><h3 class="username" style="display: inline-block">${username}</h3><button onclick="this.childNodes[0].click()" class="link_container"><a id="${username}" onclick="accept(this)" class="link">✔️</a> </button><button onclick="this.childNodes[0].click()" class="link_container"><a id="${username}" onclick="decline(this)" class="link">❌</a> </button> </div>`)
            } else {
                res.write(`<div class="req_container"><h3 class="username" style="display: inline-block">No Requests</h3> </div>`)
            }
        }

        res.write('</div><script src="/req.js"></script></body>')

        res.end()

        next()
    }
}

module.exports = reqAuth