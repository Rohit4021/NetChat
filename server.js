const express = require('express')
const app = express()
const hbs = require('hbs')
const http = require('http').createServer(app)
const {Chats, Users} = require('./db/conn')
const cookieParser = require('cookie-parser')
const nodemailer = require('nodemailer')
const fs = require('fs')
const validator = require('validator')
const io = require('socket.io')(http)
const path = require("path");
const short = require('short-uuid')
const bcrypt = require('bcrypt')
const auth = require("./middleware/auth");
const validate = require('./middleware/validate')
const find_auth = require('./middleware/find_auth')
const jwt = require('jsonwebtoken')
const getUserEmail = require("./middleware/getUserEmail");
const fileUpload = require('express-fileupload')
const friends = require("./middleware/friends");
const reqAuth = require("./middleware/reqAuth");
const push = require('web-push')
const {uploadImage} = require('./uploadImage')
const OneSignal = require('onesignal-node')
const https = require('https')
const cache = require('./cache')
require('dotenv').config()

const PORT = process.env.PORT || 8000

const client = new OneSignal.Client("3fa0d734-1732-41e3-acdb-b238ebdc59e0", "NjAxNzJjYjktYjRkMC00NjIzLWEzNDctNGVjNWQyMDM5MGQ2")


app.use(fileUpload())
app.use(cookieParser())
app.set('view engine', 'hbs')
app.use(express.urlencoded({
    extended: true
}))

http.listen(PORT, () => {
    console.log(`Listening at port : ${PORT}`)
})

const partial_path = path.join(__dirname + '/views/partials/')

hbs.registerPartials(partial_path)

const split = (word, sign) => {
    return word.split(sign)
}

const sendNotification = (data) => {
    const headers = {
        "Content-Type": "application/json; charset=utf-8",
        "Authorization": "Basic NjAxNzJjYjktYjRkMC00NjIzLWEzNDctNGVjNWQyMDM5MGQ2"
    }

    const options = {
        host: "onesignal.com",
        port: 443,
        path: "api/v1/notifications",
        method: "POST",
        headers: headers
    }

    const req = https.request(options, (res) => {
        res.on('data', (data) => {
            console.log('Response: ')
            // console.log(JSON.parse(data))
            console.log(data)
            console.log(res.statusCode)
        })
    })

    req.on('error', (e) => {
        console.log('ERROR: ')
        console.log(e)
    })

    req.write(JSON.stringify(data))
    req.end()
}

const removeRequestFun = async (user, friend) => {
    try {
        await Users.updateOne({
            username: friend
        }, {
            $pull: {
                requests: {
                    user: user
                }
            }
        })

        await Users.updateOne({
            username: user
        }, {
            $pull: {
                friends: {
                    user: friend
                }
            }
        })
    } catch (e) {
        console.log(e)
    }
}

const addRequestFun = async (user, friend) => {
    try {
        await Users.updateOne({
            username: user
        }, {
            $push: {
                friends: {
                    friend: friend
                }
            }
        })

        await Users.updateOne({
            username: friend
        }, {
            $push: {
                requests: {
                    user: user
                }
            }
        })

    } catch (e) {
        console.log(e)
    }
}

app.get('/logout', async (req, res) => {
    const id = req.query.devId

    try {
        await Users.updateOne({
            username: req.cookies.user
        }, {
            $pull: {
                vapidKeys: {
                    deviceId: id
                }
            }
        })

        await Users.updateOne({
            username: req.cookies.user
        }, {
            $pull: {
                subscription: {
                    deviceId: id
                }
            }
        })

        res.render('logout')

        io.once('connection', socket => {
            socket.emit('unsubscribe')
        })

        res.clearCookie('user')
        res.clearCookie('jwt')
    } catch (e) {
        console.log(e)
    }
})

app.get('/findData', cache(300), async (req, res) => {
    const user = req.query.user

    if (user) {
        const find = await Users.find({
            username: user
        })

        res.send(find)
    } else {
        const find = await Users.find()
        res.send(find)
    }
})

app.post('/subchange', async (req, res) => {
    const endpoint = req.body.endpoint
    const p256dh = req.body.p256dh
    const auth = req.body.auth
    const serverKey = req.body.serverKey

    await Users.findOneAndUpdate({
        username: req.cookies.user
    }, {
        $set: {
            "subscription.$[el].auth": auth
        }
    }, {
        arrayFilters: [{
            "el.serverKey": serverKey
        }]
    })
})

app.get('/', cache(300) && auth, async (req, res) => {

    io.once('connection', async socket => {

        try {
            await Users.findOne({
                username: req.cookies.user
            }).then(r => socket.emit('requests', r.requests))

            let serverKey

            socket.on('getKey', async key => {

                const keyItem = await Users.find({
                    username: req.cookies.user
                }, {
                    vapidKeys: {
                        $elemMatch: {
                            "deviceId": key
                        }
                    }
                })

                serverKey = keyItem[0].vapidKeys[0].publicKey


                const subs = await Users.find({
                    username: req.cookies.user
                }, {
                    subscription: {
                        $elemMatch: {
                            "deviceId": key
                        }
                    }
                })

                console.log('subs')

                // if (subs[0].subscription.length === 0) {
                    socket.emit('sendKey', keyItem[0].vapidKeys[0].publicKey)
                // }
            })


            socket.on('sendToDatabase', async push => {
                await Users.updateOne({
                    username: req.cookies.user
                }, {
                    $push: {
                        subscription: {
                            endpoint: push.push.endpoint,
                            p256dh: push.push.keys.p256dh,
                            auth: push.push.keys.auth,
                            serverKey: serverKey,
                            deviceId: push.deviceId
                        }
                    }
                })
            })


            const findAll = await Users.find({
                username: req.cookies.user
            })

            socket.emit('searchData', findAll[0].friends)


            let chats = []
            let pendingChats = []
            const find = await Chats.find()
            for (let i = 0; i < find.length; i++) {
                if (find[i].twoUser.includes(req.cookies.user)) {
                    chats.push(find[i].twoUser)
                }
            }

            for (let i = 0; i < chats.length; i++) {
                const getChat = await Chats.find({
                    twoUser: chats[i]
                })

                const lastMsg = getChat[0].chats.length - 1

                if (getChat[0].chats[lastMsg].username !== req.cookies.user && getChat[0].chats[lastMsg].status !== 'read') {
                    pendingChats.push(chats[i])
                }
            }


            const pending = {
                chats: pendingChats,
                name: req.cookies.user
            }

            socket.emit('pendingChats', pending)
        } catch (e) {
            console.log(e)
        }


    })

})

app.get('/signup', cache(300), (req, res) => {
    res.render('signup')
})

app.get('/profile', cache(300) && validate, async (req, res) => {

    io.once('connection', async (socket) => {
        try {
            const user = await Users.find({username: req.cookies.user})
            let y = user[0].friends
            let friendsPic = []
            let friendsList = []
            const name = user[0].name
            const myPic = user[0].pic
            const username = user[0].username

            for (let i = 0; i < y.length; i++) {
                if (y[i].success) {
                    let pic = await Users.find({username: y[i].friend})
                    friendsPic.push(pic[0].pic)
                    friendsList.push(y[i].friend)
                }

            }

            socket.emit('friends', {friendsList, friendsPic})
            socket.emit('loadProfile', {name, myPic, username})
            socket.emit('loaded')

            res.render('profile', {
                owner: true
            })
        } catch (e) {
            console.log(e)
        }

    })


})

app.get('/profile/:user', cache(300) && validate, async (req, res) => {
    const profileUser = req.params.user

    try {
        const user = await Users.find({username: profileUser})

        if (user.length !== 0) {
            io.once('connection', async (socket) => {
                let y = user[0].friends
                let friendsPic = []
                let friendsList = []
                const name = user[0].name
                const myPic = user[0].pic
                const username = user[0].username

                const ifFriend = {}

                const myPro = await Users.find({username: req.cookies.user})

                for (let i = 0; i < y.length; i++) {
                    if (y[i].success) {
                        let pic = await Users.find({username: y[i].friend})
                        friendsPic.push(pic[0].pic)
                        friendsList.push(y[i].friend)
                    }

                }

                for (let i = 0; i < myPro[0].friends.length; i++) {
                    if (myPro[0].friends[i].friend === profileUser && myPro[0].friends[i].success === true) {
                        ifFriend.name = myPro[0].friends[i].friend
                        ifFriend.friend = true
                    } else if (myPro[0].friends[i].friend === profileUser && myPro[0].friends[i].success === false) {
                        ifFriend.name = myPro[0].friends[i].friend
                        ifFriend.friend = 'requested'
                    }
                }

                socket.emit('friends', {friendsList, friendsPic})
                socket.emit('loadProfile', {name, myPic, username, ifFriend})

                socket.on('cancelRequest', async id => {
                    await removeRequestFun(req.cookies.user, id)
                })


                socket.on('addFriend', async friend => {
                    await addRequestFun(req.cookies.user, friend)
                })

                socket.on('rm_f', async username => {
                    await Users.updateOne({
                            username: req.cookies.user
                        }, {
                            $pull: {
                                friends: {
                                    friend: username
                                }
                            }
                        }
                    )

                    await Users.updateOne({
                        username
                    }, {
                        $pull: {
                            friends: {
                                friend: req.cookies.user
                            }
                        }
                    })

                })
            })

            if (user[0].username === req.cookies.user) {
                res.render('profile', {
                    owner: true,
                    notOwner: false
                })
            } else {
                res.render('profile', {
                    owner: false,
                    notOwner: true
                })
            }
        } else {
            res.render('nouser')
        }
    } catch (e) {
        console.log(e)
    }


})

app.get('/friends', cache(300) && friends, async (req, res) => {
    try {
        io.once('connection', async socket => {
            let fFind = []
            const find = await Users.find({username: req.cookies.user})
            for (let i = 0; i < find[0].friends.length; i++) {
                if (find[0].friends[i].success === true) {
                    fFind.push(find[0].friends[i])
                }
            }
            socket.emit('searchData', fFind)
            socket.emit('sendCookie', req.cookies.user)
        })
    } catch (e) {
        console.log(e)
    }

})

app.post('/edit', async (req, res) => {
    const base64Image = req.body.image
    const uuid = short.generate()

    const profilePic = base64Image.split(";base64,").pop()

    fs.writeFileSync(`./profilePics/${uuid}.png`, profilePic, {
        encoding: "base64"
    })


    const find = await Users.find({
        username: req.cookies.user
    })

    const splitString = find[0].pic.toString()
    const splitPic = splitString.split('/')

    if (find[0].pic !== '/pics/default_profile.jpg') {
        fs.rmSync(`./profilePics/${splitPic[2]}`)
    }

    await Users.updateOne({
        username: req.cookies.user
    }, {
        pic: `/pics/${uuid}.png`
    }).then((data) => {
        res.redirect('/profile')
    })
})

app.get('/users/edit/:edit', async (req, res) => {
    res.render('edit')

    const find = await Users.find({
        username: req.cookies.user
    })

    io.once('connection', (socket) => {
        socket.emit('editData', find[0])
    })
})

app.post('/register', async (req, res) => {


    let monthNumber = 0
    const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']

    for (let i = 0; i < months.length; i++) {
        if (months[i] === req.body.month) monthNumber = i + 1
    }


    const fullName = req.body.full_name
    const email = req.body.email
    const dob = `${req.body.day}/${monthNumber}/${req.body.year}`
    const username = req.body.username.toLowerCase()
    const pass = req.body.pass
    const confirm_pass = req.body.confirm_pass

    try {
        if (validator.isEmail(email)) {
            if (pass !== confirm_pass) {
                res.render('signup', {
                    pass: true
                })
            } else {
                const emailExist = await Users.find({email})

                if (emailExist.length !== 0) {
                    res.render('signup', {
                        email: true
                    })
                } else {

                    const createUser = async () => {
                        try {
                            const salt = bcrypt.genSaltSync(10)
                            const hash = bcrypt.hashSync(pass, salt)
                            const user = await new Users({
                                name: fullName,
                                email,
                                dob,
                                username,
                                password: hash
                            })

                            await user.save()
                            res.render('check')
                        } catch (e) {
                            console.log(e)
                        }
                    }

                    createUser()

                    const transporter = nodemailer.createTransport({
                        service: 'gmail',
                        auth: {
                            user: 'rohitkm40021@gmail.com',
                            pass: process.env.EMAIL_PASS
                        }
                    })

                    const mailOptions = {
                        from: 'rohitkm40021@gmail.com',
                        to: email,
                        subject: 'Activation Mail',
                        text: 'Thank you for registering to our website. To activate your account, please open this link :- ' +
                            `https://netchat-dwqp.onrender.com/user?email=${email}`
                    }

                    transporter.sendMail(mailOptions, function (error, info) {
                        if (error) {
                            console.log(error)
                        } else {
                            console.log('Email sent : ' + info)
                        }
                    })

                }
            }
        } else {
            res.render('signup', {
                notEmail: true
            })
        }
    } catch (e) {
        console.log(e)
    }


})

app.get('/login', cache(300), (req, res) => {
    res.render('login')
})

app.post('/login', async (req, res) => {
    const username = req.body.username
    const pwd = req.body.pass
    const deviceId = req.body.deviceId

    const usernames = await Users.find({username})

    if (usernames.length !== 0) {
        if (usernames[0].success !== true) {
            res.render('login', {
                unauth: true
            })
        } else {
            await bcrypt.compare(pwd, usernames[0].password, async (err, data) => {
                if (data) {

                    const token = await usernames[0].generateAuthToken()

                    const vapidKey = push.generateVAPIDKeys()

                    const getDeviceToken = await Users.find({
                        username
                    }, {
                        vapidKeys: {
                            $elemMatch: {
                                "deviceId": deviceId
                            }
                        }
                    })

                    if (getDeviceToken[0].vapidKeys.length === 0) {
                        await Users.findOneAndUpdate({
                            username
                        }, {
                            $push: {
                                vapidKeys: {
                                    publicKey: vapidKey.publicKey,
                                    privateKey: vapidKey.privateKey,
                                    deviceId
                                }
                            }
                        })
                    }

                    res.cookie('jwt', token, {
                        expires: new Date(Date.now() + 7884000000000)
                    })

                    res.cookie('user', username, {
                        expires: new Date(Date.now() + 78840000000000)
                    })


                    res.redirect('/')


                } else {
                    res.render('login', {
                        invalid_credentials: true
                    })
                }
            })
        }
    } else {
        res.render('login', {
            invalid_credentials: true
        })
    }

})

app.get('/user', cache(300), async (req, res) => {
    const email = req.query.email
    const emailDB = await Users.find({email: email})
    if (emailDB.length !== 0) {
        if (emailDB[0].success !== true) {
            try {
                await Users.updateOne({
                    email: email
                }, {
                    success: true
                })

                res.render('auth')
            } catch (err) {
                res.render('unauth')
            }
        } else {
            res.render('aauth')
        }
    } else {
        res.render('nouser')
    }


})

app.post('/updatedata', async (req, res) => {

    let monthNumber = 0
    const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']

    for (let i = 0; i < months.length; i++) {
        if (months[i] === req.body.month)
            monthNumber = i + 1
    }

    const fullName = req.body.full_name
    const email = req.body.email
    const dob = `${req.body.day}/${monthNumber}/${req.body.year}`
    const username = req.body.username
    const pass = req.body.pass
    const confirm_pass = req.body.confirm_pass

    if (pass === confirm_pass) {
        const salt = bcrypt.genSaltSync(10)
        const hash = bcrypt.hashSync(pass, salt)
        await Users.updateOne({
            username: req.cookies.user
        }, {
            name: fullName,
            email,
            dob,
            username,
            password: hash
        })

        res.redirect('/profile')
    } else {
        const find = await Users.find({
            username: req.cookies.user
        })

        io.once('connection', (socket) => {
            socket.emit('editData', find[0])
        })

        res.render('edit', {
            pass: true
        })
    }
})

app.get('/client.js', cache(300), (req, res) => {
    res.sendFile(__dirname + '/public/client.js')
})

app.get('/friendsFilter.js', cache(300), (req, res) => {
    res.sendFile(__dirname + '/public/friendsFilter.js')
})

app.get('/style.css', cache(300), (req, res) => {
    res.sendFile(__dirname + '/public/style.css')
})

app.get('/edit.css', cache(300), (req, res) => {
    res.sendFile(__dirname + '/public/edit.css')
})

app.get('/style_profile.css', cache(300), (req, res) => {
    res.sendFile(__dirname + '/public/style_profile.css')
})

app.get('/favicon.png', cache(300), (req, res) => {
    res.sendFile(__dirname + '/public/favicon.png')
})

app.get('/req.js', cache(300), (req, res) => {
    res.sendFile(__dirname + '/public/req.js')
})

app.get('/index.js', cache(300), (req, res) => {
    res.sendFile(__dirname + '/public/index.js')
})

app.get('/sw.js', cache(300), (req, res) => {
    res.sendFile(__dirname + '/public/sw.js')
})

app.get('/default_profile.jpg', cache(300), (req, res) => {
    res.sendFile(__dirname + '/profilePics/default_profile.jpg')
})

app.get('/camera.png', cache(300), (req, res) => {
    res.sendFile(__dirname + '/public/camera.png')
})

app.get('/x-circle.svg', cache(300), (req, res) => {
    res.sendFile(__dirname + '/public/x-circle.svg')
})

app.get('/secret.css', cache(300), (req, res) => {
    res.sendFile(__dirname + '/public/secretStyle.css')
})

app.get('/addRequests.jpg', cache(300), (req, res) => {
    res.sendFile(__dirname + '/public/addRequest.png')
})

app.get('/pics/:pic', cache(300), (req, res) => {
    const pic = req.params.pic
    res.sendFile(__dirname + `/profilePics/${pic}`)
})

app.get('/friendsSearch.js', cache(300), (req, res) => {
    res.sendFile(__dirname + '/public/friendsSearch.js')
})

app.get('/removeFriend.png', cache(300), (req, res) => {
    res.sendFile(__dirname + '/public/removeFriend.png')
})

app.get('/cancel.png', cache(300), (req, res) => {
    res.sendFile(__dirname + '/public/cancel.png')
})

app.get('/node_modules/cropperjs/dist/cropper.min.js', cache(300), (req, res) => {
    res.sendFile(__dirname + '/node_modules/cropperjs/dist/cropper.min.js')
})

app.get('/node_modules/cropperjs/dist/cropper.min.css', cache(300), (req, res) => {
    res.sendFile(__dirname + '/node_modules/cropperjs/dist/cropper.min.css')
})

app.get('/tick.png', cache(300), (req, res) => {
    res.sendFile(__dirname + '/public/tick.png')
})

app.get('/node_modules/device-uuid/lib/device-uuid.js', cache(300), (req, res) => {
    res.sendFile(__dirname + '/node_modules/device-uuid/lib/device-uuid.js')
})

app.get('/request.jpg', cache(300), (req, res) => {
    res.sendFile(__dirname + '/public/request.png')
})

app.get('/find', cache(300) && find_auth, async (req, res) => {
    io.once('connection', async (socket) => {
        const find = await Users.find()
        socket.emit('searchData', find)
        socket.emit('sendCookie', req.cookies.user)


        const token = req.cookies.jwt
        const verifyUser = jwt.verify(token, process.env.SECRET_KEY)
        const friends = await Users.find({_id: verifyUser._id}, {
            'friends.num': 0
        })
        let y = friends[0].friends
        socket.emit('list', y)

        socket.on('callList', () => {
            socket.emit('list', y)
        })

        const requests = await Users.find({
            username: req.cookies.user
        })


        socket.emit('requests', requests[0].requests)


        socket.on('cancelRequest', async id => {
            await removeRequestFun(req.cookies.user, id)
        })


        socket.on('addFriend', async friend => {
            await addRequestFun(req.cookies.user, friend)
        })
    })

})

app.get('/requests', cache(300) && reqAuth, async (req, res) => {

    io.once('connection', (socket) => {
        socket.on('declineRequest', async request => {
            await Users.updateOne({
                username: req.cookies.user
            }, {
                $pull: {
                    requests: {
                        user: request
                    }
                }
            })

            await Users.findOneAndUpdate({
                username: request
            }, {
                $set: {
                    "friends.$[el].success": false
                }
            }, {
                arrayFilters: [{
                    "el.friend": req.cookies.user
                }]
            })


        })

        socket.on('acceptRequest', async request => {
            await Users.updateOne({
                username: req.cookies.user
            }, {
                $pull: {
                    requests: {
                        user: request
                    }
                }
            })

            await Users.updateOne({
                username: req.cookies.user
            }, {
                $push: {
                    friends: {
                        friend: request,
                        success: true
                    }
                }
            })


            Users.findOneAndUpdate({
                username: request
            }, {
                $set: {
                    "friends.$[el].success": true
                }
            }, {
                arrayFilters: [{
                    "el.friend": req.cookies.user
                }]
            })
        })
    })
})

app.get('/users', cache(300) && getUserEmail, (req, res) => {
    const username = req.cookies.user
    const to = req.query.user
    res.redirect(`/chats/${username}_${to}`)
})

app.get('/chats/:chat', cache(300), async (req, res) => {

    if (!req.cookies.user) {
        res.redirect('/login')
    }

    res.render('chat')

    const splitParam = split(req.params.chat, '_')


    io.once("connection", async (socket) => {

        const seen1 = await Chats.find({
            twoUser: splitParam[0] + splitParam[1]
        })

        const seen2 = await Chats.find({
            twoUser: splitParam[1] + splitParam[0]
        })

        if (seen1.length !== 0) {
            await Chats.updateMany({
                twoUser: splitParam[0] + splitParam[1]
            }, {
                $set: {
                    "chats.$[elem].status": "read"
                }
            }, {
                arrayFilters: [{
                    $and: [{
                        "elem.username": splitParam[1]
                    }]
                }]
            })

            const abc = 'msg'

            socket.to(splitParam[0] + splitParam[1]).to(splitParam[1] + splitParam[0]).emit('readDoneAgain', abc)
        } else if (seen2.length !== 0) {
            await Chats.updateMany({
                twoUser: splitParam[1] + splitParam[0]
            }, {
                $set: {
                    "chats.$[elem].status": "read"
                }
            }, {
                arrayFilters: [{
                    $and: [{
                        "elem.username": splitParam[1]
                    }]
                }]
            })

            const abc = 'msg'

            socket.to(splitParam[0] + splitParam[1]).to(splitParam[1] + splitParam[0]).emit('readDoneAgain', abc)
        }


        await Users.find({
            username: splitParam[1]
        }).then(find => {
            const pic = find[0].pic
            const nameProPic = find[0].name
            const usernamePro = find[0].username

            socket.emit('proPic', {pic, nameProPic, usernamePro})
            socket.emit('conn')
        }).catch((err) => {
            res.reload()
        })

        socket.once('join', () => {
            io.emit('join')
            socket.join(splitParam[0] + splitParam[1])
            socket.join(splitParam[1] + splitParam[0])
        })

        socket.join(splitParam[0] + splitParam[1])
        socket.join(splitParam[1] + splitParam[0])

        let name

        const user1 = await Chats.find({
            twoUser: splitParam[0] + splitParam[1]
        })

        const user2 = await Chats.find({
            twoUser: splitParam[1] + splitParam[0]
        })

        if (user1.length !== 0) {
            name = splitParam[0] + splitParam[1]
        } else {
            if (user2.length !== 0) {
                name = splitParam[1] + splitParam[0]
            } else {
                const newChat = new Chats({
                    twoUser: splitParam[0] + splitParam[1]
                })

                try {
                    await newChat.save()
                } catch (e) {
                    console.error(e)
                }

                name = splitParam[0] + splitParam[1]
            }
        }

        socket.on('message', async (msg) => {
            const proPic = await Users.find({
                username: msg.user
            })

            console.log('hi')

            let dbMsg

            if (msg.type === 'image') {
                if (msg.filename === 'image.name&base64') {
                    let uuid = short.uuid()
                    dbMsg = await uploadImage(`${uuid}.png}`, msg.message, 'base64')
                } else {
                    dbMsg = await uploadImage(msg.filename, msg.message, 'image')
                }
            } else if (msg.type === 'text') {
                dbMsg = msg.message
            }

            delete msg.message

            msg.message = dbMsg


            const pic = proPic[0].pic
            socket.join(splitParam[0] + splitParam[1])
            socket.join(splitParam[1] + splitParam[0])
            socket.to(splitParam[0] + splitParam[1]).to(splitParam[1] + splitParam[0]).emit('msg', {msg, pic})
            socket.to(splitParam[0] + splitParam[1]).to(splitParam[1] + splitParam[0]).emit('willRead', msg)

            try {
                const notification = {
                    contents: {},
                    headings: {
                        en: splitParam[0]
                    },
                    priority: 10,
                    filters: [
                        {
                            field: 'tag',
                            key: 'email',
                            relation: '=',
                            value: splitParam[1]
                        }
                    ]
                }

                if (msg.type === 'text') {
                    notification.contents.en = dbMsg
                } else if (msg.type === 'image') {
                    notification.contents.en = 'Image 📷'
                    notification.big_picture = dbMsg
                    notification.large_icon = dbMsg
                }

                console.log(notification)

                const send = await client.createNotification(notification)
                console.log(send.body)

                // sendNotification(notification)

            } catch (e) {
                if (e instanceof OneSignal.HTTPError) {
                    console.log(e.statusCode)
                    console.log(e.body)
                }
            }


            try {
                const icon = await Users.find({
                    username: msg.id
                })


                let publicKey
                let privateKey

                for (let i = 0; i < icon[0].vapidKeys.length; i++) {
                    const keys = icon[0].vapidKeys[i]
                    publicKey = keys.publicKey
                    privateKey = keys.privateKey

                    push.setVapidDetails(
                        'mailto:test@code.co.uk',
                        publicKey,
                        privateKey
                    )

                    const pic = await Users.find({
                        username: splitParam[0]
                    })


                    const payload = {
                        title: splitParam[0],
                        icon: pic[0].pic,
                        this: splitParam[1]
                    }

                    if (msg.type === 'image') {
                        payload.msg = 'Sent a Photo 📷'
                    } else if (msg.type === 'text') {
                        payload.msg = msg.message
                    }

                    for (let x = 0; x < icon[0].subscription.length; x++) {

                        if (keys.deviceId === icon[0].subscription[x].deviceId) {
                            let pushSubscription = {
                                endpoint: icon[0].subscription[0].endpoint,
                                expirationTime: null,
                                keys: {
                                    p256dh: icon[0].subscription[0].p256dh,
                                    auth: icon[0].subscription[0].auth
                                }
                            }

                            push.sendNotification(pushSubscription, JSON.stringify(payload))
                        }
                    }
                }
            } catch (e) {
                console.log(e)
            }


            const findA = await Chats.find({
                twoUser: name
            })

            if (findA[0].deleteChat === 'both') {
                if (name === splitParam[0] + splitParam[1]) {
                    await Chats.updateOne({
                        twoUser: name
                    }, {
                        $push: {
                            chats: {
                                username: msg.user,
                                msg: dbMsg,
                                msgId: msg.msgId,
                                msgType: msg.type,
                                status: "sent"
                            }
                        },
                        deleteChat: splitParam[1]
                    })
                } else if (name === splitParam[1] + splitParam[0]) {
                    await Chats.updateOne({
                        twoUser: name
                    }, {
                        $push: {
                            chats: {
                                username: msg.user,
                                msg: dbMsg,
                                msgId: msg.msgId,
                                msgType: msg.type,
                                status: "sent"
                            }
                        },
                        deleteChat: splitParam[0]
                    })
                }
            } else if (findA[0].deleteChat === splitParam[0]) {
                if (name === splitParam[0] + splitParam[1]) {
                    await Chats.updateOne({
                        twoUser: name
                    }, {
                        $push: {
                            chats: {
                                username: msg.user,
                                msg: dbMsg,
                                msgId: msg.msgId,
                                msgType: msg.type,
                                status: "sent"
                            }
                        },
                        deleteChat: 'none'
                    })
                } else if (name === splitParam[1] + splitParam[0]) {
                    await Chats.updateOne({
                        twoUser: name
                    }, {
                        $push: {
                            chats: {
                                username: msg.user,
                                msg: dbMsg,
                                msgId: msg.msgId,
                                msgType: msg.type,
                                status: "sent"
                            }
                        },
                        deleteChat: 'none'
                    })
                }
            } else if (findA[0].deleteChat === splitParam[1]) {

            } else {
                await Chats.updateOne({
                    twoUser: name
                }, {
                    $push: {
                        chats: {
                            username: msg.user,
                            msg: dbMsg,
                            msgId: msg.msgId,
                            msgType: msg.type,
                            status: "sent"
                        }
                    }
                })
            }

            await Chats.find({
                twoUser: name
            })
        })

        const personalChats = await Chats.find({
            twoUser: name
        })

        socket.on('dfa', async nameId => {
            const d1 = await Chats.find({
                twoUser: splitParam[0] + splitParam[1]
            })

            const d2 = await Chats.find({
                twoUser: splitParam[1] + splitParam[0]
            })

            if (d1.length !== 0) {
                await Chats.updateOne({
                    twoUser: splitParam[0] + splitParam[1]
                }, {
                    $pull: {
                        chats: {
                            msgId: nameId
                        }
                    }
                })
            } else if (d2.length !== 0) {
                await Chats.updateOne({
                    twoUser: splitParam[1] + splitParam[0]
                }, {
                    $pull: {
                        chats: {
                            msgId: nameId
                        }
                    }
                })
            }
        })

        socket.on('readDone', async msg => {
            const seen1 = await Chats.find({
                twoUser: splitParam[0] + splitParam[1]
            })

            const seen2 = await Chats.find({
                twoUser: splitParam[1] + splitParam[0]
            })

            if (seen1.length !== 0) {
                await Chats.updateMany({
                    twoUser: splitParam[0] + splitParam[1]
                }, {
                    $set: {
                        "chats.$[elem].status": "read"
                    }
                }, {
                    arrayFilters: [{
                        $and: [{
                            "elem.username": splitParam[1]
                        }]
                    }]
                })
            } else if (seen2.length !== 0) {
                await Chats.updateMany({
                    twoUser: splitParam[1] + splitParam[0]
                }, {
                    $set: {
                        "chats.$[elem].status": "read"
                    }
                }, {
                    arrayFilters: [{
                        $and: [{
                            "elem.username": splitParam[1]
                        }]
                    }]
                })
            }

            socket.to(splitParam[0] + splitParam[1]).to(splitParam[1] + splitParam[0]).emit('readDoneAgain', msg)
        })

        socket.on('deleteChat', async del => {
            const find1 = await Chats.find({
                twoUser: splitParam[0] + splitParam[1]
            })

            const find2 = await Chats.find({
                twoUser: splitParam[1] + splitParam[0]
            })

            if (find1.length !== 0) {
                const delet = find1[0].deleteChat
                if (delet !== 'none') {
                    await Chats.updateOne({
                        twoUser: splitParam[0] + splitParam[1]
                    }, {
                        deleteChat: 'both'
                    })

                    await Chats.deleteOne({
                        twoUser: splitParam[0] + splitParam[1]
                    })
                } else {
                    await Chats.updateOne({
                        twoUser: splitParam[0] + splitParam[1]
                    }, {
                        deleteChat: del
                    })

                    await Chats.updateMany({
                        twoUser: splitParam[0] + splitParam[1]
                    }, {
                        $set: {
                            "chats.$[elem].del": `${splitParam[0]}`
                        }
                    }, {
                        arrayFilters: [{
                            $and: [{
                                "elem.all": "1"
                            }]
                        }]
                    })
                }
            } else if (find2.length !== 0) {
                const delet = find2[0].deleteChat
                if (delet !== 'none') {
                    await Chats.updateOne({
                        twoUser: splitParam[1] + splitParam[0]
                    }, {
                        deleteChat: 'both'
                    })

                    await Chats.deleteOne({
                        twoUser: splitParam[1] + splitParam[0]
                    })
                } else {
                    await Chats.updateOne({
                        twoUser: splitParam[1] + splitParam[0]
                    }, {
                        deleteChat: del
                    })

                    await Chats.updateMany({
                        twoUser: splitParam[1] + splitParam[0]
                    }, {
                        $set: {
                            "chats.$[elem].del": `${splitParam[0]}`
                        }
                    }, {
                        arrayFilters: [{
                            $and: [{
                                "elem.all": "1"
                            }]
                        }]
                    })
                }
            }
        })


        socket.emit('chatHistory', personalChats)

        socket.on('disconnect', async () => {

            console.log('User disconnected.')

        })

    })

})

app.get('/*', cache(300), (req, res) => {
    res.render('error')
})
