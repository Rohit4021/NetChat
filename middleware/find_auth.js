const {Users} = require('../db/conn')

const find_auth = async (req, res, next) => {
    try {

        if (req.cookies.user) {
            res.setHeader('Content-type', 'text/html')

            const users = await Users.find()

            res.write('<head><title>NetChat</title><meta name="viewport" content="width=device-width, initial-scale=1"><meta charset="UTF-8"><link rel="icon" type="image/x-icon" href="/favicon.png"><link rel="stylesheet" type="text/css" href="/secret.css"><script src="socket.io/socket.io.js"></script><script src="/friendsFilter.js"></script><script src="https://kit.fontawesome.com/c4254e24a8.js" crossorigin="anonymous"></script><script>window.onpageshow = function () { if (window.performance.navigation.type === 2) { window.location.reload() } }</script></head><body onload="loaded()"><center><div class="request_container" onclick="redirect()"><h3 class="request" style="font-size: 22px">Requests</h3><div><div class="request_circle"></div><i class="bi bi-chevron-right"></i></div></div></center><div class="main"><div class="input_div"><input type="text" placeholder="Search" oninput="search(this)" id="input_text" spellcheck="false"><img src="/x-circle.svg" id="clear" onclick="clear()"></div>')

            for (let i = 0; i < await users.length; i++) {
                const username = await users[i].username


                if (username === req.cookies.user) {

                } else {
                    if (users[i].success === true) {
                        res.write(`<div class="container"><h3 class="username" style="display: inline-block">${username}</h3><button onclick="add(this)" class="link_container" id="${username}"><a id="link" class="link">Add Friend</a></button></div><br>`)
                    }
                }

            }



            res.write('</div></body>')



            res.end()

            next()
        } else {
            res.redirect('/login')
        }

    } catch (e) {
        console.log(e)
    }
}

module.exports = find_auth
