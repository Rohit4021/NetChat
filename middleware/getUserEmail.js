const getUserEmail = async (req, res, next) => {
    if(req.cookies.user) {
        next()
    } else {
        res.status(401).send('Error')
    }
}

module.exports = getUserEmail
