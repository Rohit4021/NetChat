const {Users} = require('../db/conn')

const auth = async (req, res, next) => {
    if (req.cookies.user) {

        res.setHeader('Content-type', 'text/html')

        try {
            await Users.findOne({username: req.cookies.user}).then(async r => {
                for (let i = 0; i < r.friends.length; i++) {
                    if (i !== 0) {
                        if (r.friends[i].friend === r.friends[i - 1].friend) {
                            await Users.updateOne({
                                username: req.cookies.user
                            }, {
                                $pull: {
                                    friends: {
                                        _id: r.friends[i]._id
                                    }
                                }
                            }).then(r => console.log(r))
                        }
                    }
                }
            })
        } catch (e) {
            console.log(e)
        }

        await Users.find({
            username: req.cookies.user
        }).then((pic) => {
            res.write(`<head><title>NetChat</title><meta name="viewport" content="width=device-width, initial-scale=1"><meta charset="UTF-8"><link rel="icon" type="image/x-icon" href="/favicon.png"><link rel="stylesheet" type="text/css" href="/secret.css"><script src="socket.io/socket.io.js"></script><script src="/friendsSearch.js"></script><script src="/index.js"></script><script src="/node_modules/device-uuid/lib/device-uuid.js"></script></script><script>window.onpageshow = function () { if (window.performance.navigation.type === 2) { window.location.reload() } }</script></head><body onload="loaded()"><div class="options_container"><div class="options"><img src="${pic[0].pic}" class="profile" onclick="window.location.href = '/profile/${pic[0].username}'"><img src="/request.jpg" class="add" onclick="window.location.href = '/find'"></div></div><div class="main"><div class="input_div"><input type="text" oninput="search(this)" id="input_text" placeholder="Search" spellcheck="false"><img src="/x-circle.svg" id="clear" onclick="document.getElementById('input_text').value = '';window.location.reload();"></div>`)
        })

        const token = req.cookies.user

        const users = await Users.find({username: token})
        const friends = users[0].friends

        for (let i = 0; i < users[0].friends.length; i++) {
            if (friends.length === 0) {

            } else if (friends[i].success === true) {

                const friendUsername = await friends[i].friend
                const friend = friendUsername.split(" ").join("").toLowerCase()
                const pic = await Users.find({
                    username: friend
                })
                const friendPic = await pic[0].pic
                const friendProPic = friendPic.split(" ").join("").toLowerCase()

                res.write(`<div class="friend_container" onclick="this.childNodes[0].click()" ><img src="${friendProPic}" class="profile" onclick="document.getElementById('${friend}').click()"><a href="/users?user=${friend}" id="${friend}" style="display: inline-block; text-decoration: none" class="username"><h3>${friend}</h3></a></div>`)
            }
        }

        res.write(`</div></body>`)

        res.end()


        next()

    } else {
        res.status(401).redirect('/login')
    }
}

module.exports = auth
