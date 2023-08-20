const fs = require("fs");
const short = require('short-uuid')
const imgbbUploader = require('imgbb-uploader')


exports.uploadImage = async (filename, imageData, imgType) => {
    if (imgType === 'base64') {
        return await imgbbUploader({
            apiKey: process.env.IMGBB_API_KEY,
            filename,
            base64string: imageData
        }).then((response) => {
            console.log('base64')
            console.log(response.url)
            console.log(imageData)
            return response.url.toString().trim()
        })
    } else if (imgType === 'image') {
        await fs.writeFileSync(`./temp/${filename}`, imageData)

        return await imgbbUploader(process.env.IMGBB_API_KEY, `./temp/${filename}`).then(async (response) => {

            console.log('image')
            console.log(response.url)

            fs.rmSync(`./temp/${filename}`)

            return response.url.toString().trim()
        })
    }
}
