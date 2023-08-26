const checkCookie = async (req, res, next) => {
    try {
        if (!req.cookies.user) {
            res.render('index')
        } else {
            res.render('index', {
                logout: true
            })
        }

        next()
    } catch (e) {

    }
}

module.exports = checkCookie
