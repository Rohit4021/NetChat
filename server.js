const express = require('express')
const app = express()
const hbs = require('hbs')
const http = require('http')
const server = http.createServer(app)
const {Chats, Users} = require('./db/conn')
const cookieParser = require('cookie-parser')
const nodemailer = require('nodemailer')
const fs = require('fs')
const validator = require('validator')
const io = require('socket.io')(server)
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
const cors = require('cors')
const schedule = require('node-schedule')
require('dotenv').config()

const PORT = process.env.PORT || 8000

const client = new OneSignal.Client(process.env.ONESIGNAL_APP_ID, process.env.ONESIGNAL_API_KEY)

const corsOpts = {
    origin: '*',
    methods: [
        'GET',
        'POST'
    ],
    allowedHeaders: [
        'Content-Type',
    ],
}

app.use(cors(corsOpts))
app.use(fileUpload())
app.use(cookieParser())
app.set('view engine', 'hbs')
app.use(express.urlencoded({
    extended: true
}))
app.use(express.json())

server.listen(PORT, () => {
    console.log(`Listening at port : ${PORT}`)
})

const partial_path = path.join(__dirname + '/views/partials/')

hbs.registerPartials(partial_path)

const split = (word, sign) => {
    return word.split(sign)
}

async function updateSub() {
    const users = await Users.find()
    console.log(`Users length ===>  ${users.length}`)
    for (let i = 0; i < users.length; i++) {
        const subscription = users[i].subscription
        console.log(`Subscription length ===> ${subscription.length}`)

        let publicKey
        let privateKey

        for (let x = 0; x < users[i].vapidKeys.length; x++) {
            const keys = users[i].vapidKeys[x]
            publicKey = keys.publicKey
            privateKey = keys.privateKey

            console.log(`Vapid Keys Length ====> ${users[i].vapidKeys.length}`)

            push.setVapidDetails(
                'mailto:test@code.co.uk',
                publicKey,
                privateKey
            )

            const payload = {
                type: 'pushsubscriptionchange'
            }

            for (let y = 0; y < users[i].subscription.length; y++) {

                if (keys.deviceId === users[i].subscription[y].deviceId) {
                    console.log('match')
                    let pushSubscription = {
                        endpoint: users[i].subscription[y].endpoint,
                        expirationTime: null,
                        keys: {
                            p256dh: users[i].subscription[y].p256dh,
                            auth: users[i].subscription[y].auth
                        }
                    }

                    push.sendNotification(pushSubscription, JSON.stringify(payload))
                }
            }
        }
    }
}

for (let i = 0; i < 24; i++) {
    schedule.scheduleJob({
        hour: i,
        minute: 0,
        second: 0
    }, updateSub)
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

app.get('/findData', async (req, res) => {
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

app.get('/publickey', async (req, res) => {
    const deviceId = req.query.deviceid

    const publicKey = await Users.find({
        vapidKeys: {
            $elemMatch: {
                deviceId: deviceId
            }
        }
    })

    const pubKey = publicKey[0].vapidKeys[0].publicKey

    console.log(pubKey)

    res.send(pubKey)
})

app.post('/subchange', async (req, res) => {
    const deviceId = req.body.deviceId
    const new_endpoint = req.body.new_endpoint
    const new_p256dh = req.body.new_p256dh
    const new_auth = req.body.new_auth

    await Users.findOneAndUpdate({
        subscription: {
            $elemMatch: {
                deviceId: deviceId
            }
        }
    }, {
        $set: {
            "subscription.$[el].endpoint": new_endpoint,
            "subscription.$[el].p256dh": new_p256dh,
            "subscription.$[el].auth": new_auth
        }
    }, {
        arrayFilters: [{
            "el.deviceId": deviceId
        }]
    }).then(r => res.send(r)).catch(e => console.log(e))

    fs.writeFileSync(`./temp/${new_auth}.json`, JSON.stringify({
        endpoint: new_endpoint,
        p256dh: new_p256dh,
        auth: new_auth,
        deviceId: deviceId
    }))
})

app.get('/', auth, async (req, res) => {

    const friend = await Users.find({username: req.cookies.user})
    const friends = friend[0].friends

    for (let i = 1; i < friends.length; i++) {
        if (friends[i].friend === friends[i - 1].friend) {
            friends[i]._id.deleteOne().then(r => res.redirect('/'))
        }
    }

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

                try {
                    if (getChat[0].chats[lastMsg].username !== req.cookies.user && getChat[0].chats[lastMsg].status !== 'read') {
                        pendingChats.push(chats[i])
                    }
                } catch (e) {
                    console.log(e)
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

app.get('/signup', (req, res) => {
    res.render('signup')
})

app.get('/profile/:user', validate, async (req, res) => {
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

app.get('/friends', friends, async (req, res) => {
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

    fs.writeFile(`./profilePics/${uuid}.png`, profilePic, {
        encoding: "base64"
    }, () => {
        console.log('File Created.')
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
    }).then(async (data) => {
        await Users.findOne({
            username: req.cookies.user
        }).then(username => {
            res.redirect(`/profile/${username.username}`)
        })
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
                            `https://netchat-nz-production.up.railway.app/user?email=${email}`
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

app.get('/login', (req, res) => {
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

app.get('/user', async (req, res) => {
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

app.get('/client.js', (req, res) => {
    res.sendFile(__dirname + '/public/client.js')
})

app.get('/friendsFilter.js', (req, res) => {
    res.sendFile(__dirname + '/public/friendsFilter.js')
})

app.get('/style.css', (req, res) => {
    res.sendFile(__dirname + '/public/style.css')
})

app.get('/edit.css', (req, res) => {
    res.sendFile(__dirname + '/public/edit.css')
})

app.get('/manifest.json', (req, res) => {
    res.sendFile(__dirname + '/public/manifest.json')
})

app.get('/style_profile.css', (req, res) => {
    res.sendFile(__dirname + '/public/style_profile.css')
})

app.get('/favicon.png', (req, res) => {
    res.sendFile(__dirname + '/public/favicon.png')
})

app.get('/req.js', (req, res) => {
    res.sendFile(__dirname + '/public/req.js')
})

app.get('/index.js', (req, res) => {
    res.sendFile(__dirname + '/public/index.js')
})

app.get('/sw.js', (req, res) => {
    res.sendFile(__dirname + '/public/sw.js')
})

app.get('/default_profile.jpg', (req, res) => {
    res.sendFile(__dirname + '/profilePics/default_profile.jpg')
})

app.get('/camera.png', (req, res) => {
    res.sendFile(__dirname + '/public/camera.png')
})

app.get('/x-circle.svg', (req, res) => {
    res.sendFile(__dirname + '/public/x-circle.svg')
})

app.get('/secret.css', (req, res) => {
    res.sendFile(__dirname + '/public/secretStyle.css')
})

app.get('/addRequests.jpg', (req, res) => {
    res.sendFile(__dirname + '/public/addRequest.png')
})

app.get('/pics/:pic', (req, res) => {
    const pic = req.params.pic
    res.sendFile(__dirname + `/profilePics/${pic}`)
})

app.get('/friendsSearch.js', (req, res) => {
    res.sendFile(__dirname + '/public/friendsSearch.js')
})

app.get('/removeFriend.png', (req, res) => {
    res.sendFile(__dirname + '/public/removeFriend.png')
})

app.get('/cancel.png', (req, res) => {
    res.sendFile(__dirname + '/public/cancel.png')
})

app.get('/node_modules/cropperjs/dist/cropper.min.js', (req, res) => {
    res.sendFile(__dirname + '/node_modules/cropperjs/dist/cropper.min.js')
})

app.get('/node_modules/cropperjs/dist/cropper.min.css', (req, res) => {
    res.sendFile(__dirname + '/node_modules/cropperjs/dist/cropper.min.css')
})

app.get('/tick.png', (req, res) => {
    res.sendFile(__dirname + '/public/tick.png')
})

app.get('/node_modules/device-uuid/lib/device-uuid.js', (req, res) => {
    res.sendFile(__dirname + '/node_modules/device-uuid/lib/device-uuid.js')
})

app.get('/request.jpg', (req, res) => {
    res.sendFile(__dirname + '/public/request.png')
})

app.get('/find', find_auth, async (req, res) => {
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

app.get('/requests', reqAuth, async (req, res) => {

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

            await Users.findOneAndUpdate({
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
        })
    })
})

app.get('/users', getUserEmail, (req, res) => {
    const username = req.cookies.user
    const to = req.query.user
    res.redirect(`/chats/${username}_${to}`)
})

app.get('/chats/:chat', async (req, res) => {

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
            if (find.length !== 0) {
                const pic = find[0].pic
                const nameProPic = find[0].name
                const usernamePro = find[0].username

                socket.emit('proPic', {pic, nameProPic, usernamePro})
                socket.emit('conn')
            }
        }).catch((err) => {
            res.redirect(req.url)
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
                        this: splitParam[1],
                        type: 'pushsubscription'
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

app.get('/*', (req, res) => {
    res.render('error')
})
