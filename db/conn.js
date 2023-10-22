const mongoose = require('mongoose')
const jwt = require("jsonwebtoken");
const res = require("express/lib/response");
mongoose.set('strictQuery', false)
require('dotenv').config()

mongoose.connect(`mongodb+srv://${process.env.USER}:${process.env.PASS}@chatapp.t4fgyxk.mongodb.net/?retryWrites=true&w=majority`, {
//     useNewUrlParser: true,
//     useUnifiedTopology: true
// mongoose.connect(`mongodb://0.0.0.0/netchat`, {
//     useNewUrlParser: true,
//     useUnifiedTopology: true
}).then(() => {
    console.log('Connection Successful')
}).catch((e) => {
    console.log(e)
})


const users = new mongoose.Schema({
    name: String,
    pic: {
        type: String,
        default: '/pics/default_profile.jpg'
    },
    email: String,
    dob: String,
    username: String,
    password: String,
    success: {
        type: Boolean,
        default: false
    },
    subscription: [
        {
            endpoint: String,
            p256dh: String,
            auth: String,
            deviceId: String,
            serverKey: String
        }
    ],
    friends: [
        {
            friend: String,
            success: {
                type: Boolean,
                default: false
            },
            num: {
                type: Number,
                default: 5
            }
        }
    ],
    requests: [
        {
            user: String
        }
    ],
    tokens: [{
        token: {
            type: String,
            required: true
        }
    }],
    vapidKeys: [
        {
            publicKey: String,
            privateKey: String,
            deviceId: String
        }
    ]
})


users.methods.generateAuthToken = async function () {
    try {
        const token = await jwt.sign({_id: this._id.toString()}, process.env.SECRET_KEY)
        this.tokens = this.tokens.concat({token})
        await this.save()
        return token
    } catch (e) {
        res.send("Error!")
        console.log(e)
    }
}


const Users = new mongoose.model('User', users)


const conn = new mongoose.Schema({
    twoUser: {
        type: String,
        unique: true
    },
    deleteChat: {
        type: String,
        default: 'none'
    },
    chats: [
        {
            username: String,
            msg: {
                type: String,
                required: true
            },
            status: String,
            all: {
                type: String,
                default: "1"
            },
            msgType: String,
            msgId: Number,
            del: String,
            date: {
                type: Date,
                default: new Date()
            }
        }
    ]
})

const Chats = new mongoose.model('Chat', conn)

async function deleteUsers() {
    await Users.deleteMany({
        success: true
    }).then(r => console.log(r))
}

async function deleteChats() {
    await Chats.deleteMany({
        deleteChat: 'none'
    }).then(r => console.log(r))
}

// deleteChats()
// deleteUsers()

module.exports = {
    Chats,
    Users
}
