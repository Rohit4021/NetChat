const fs = require("fs");
const imgbbUploader = require('imgbb-uploader')
const path = require("path");

exports.uploadImage = async (filename, imageData, imgType) => {
    if (imgType === 'base64') {
        return await imgbbUploader({
            apiKey: process.env.IMGBB_API_KEY,
            filename,
            base64string: imageData
        }).then((response) => {
            console.log('base64')
            console.log(response.url)
            return response.url.toString().trim()
        })
    } else if (imgType === 'image') {
        if (!fs.existsSync('./temp')) {
            fs.mkdirSync(path.join(__dirname, 'temp'))
        }
        fs.writeFileSync(`./temp/${filename}`, imageData)

        return await imgbbUploader(process.env.IMGBB_API_KEY, `./temp/${filename}`).then(async (response) => {

            console.log('image')
            console.log(response.url)

            fs.rmSync(`./temp/${filename}`)

            return response.url.toString().trim()
        })
    }
}
