const validate = (req, res, next) => {
    if (!req.cookies.user) {
        res.redirect('/login')
    } else {
        next()
    }
}

module.exports = validate
