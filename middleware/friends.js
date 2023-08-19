const { Users } = require('../db/conn')

const friends = async (req, res, next) => {
    try {

        res.setHeader('Content-type', 'text/html')

        res.write(`<head><title>NetChat</title><meta name="viewport" content="width=device-width, initial-scale=1"><meta charset="UTF-8"><link rel="icon" type="image/x-icon" href="/favicon.png"><link rel="stylesheet" type="text/css" href="/secret.css"><script src="socket.io/socket.io.js"></script><script src="/friendsSearch.js"></script></head><body onload="loaded()"><div class="main"><div class="input_div"><input type="text" oninput="search(this)" id="input_text" spellcheck="false"><img src="/x-circle.svg" id="clear" onclick="document.getElementById('input_text').value = "";window.location.reload();"></div>`)

        const token = req.cookies.user

        const users = await Users.find({username: token})
        const friends = users[0].friends

        for (let i = 0; i < users[0].friends.length; i++) {
            if (friends.length === 0) {

            } else {
                if (friends[i].success === true) {

                    const friendUsername = await friends[i].friend
                    const friend = friendUsername.split(" ").join("").toLowerCase()

                    res.write(`<div class="friend_container" onclick="this.childNodes[0].click()" ><a href="/profile/${friend}" style="display: inline-block; text-decoration: none" class="username"><h3>${friend}</h3></a></div>`)
                }

            }
        }

        res.write(`</div></body>`)

        res.end()


        next()



    } catch (e) {
        console.log(e)
    }
}

module.exports = friends
