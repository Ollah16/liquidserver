const express = require('express')
const { handleUserLogin, handleUserReg, getOtp, submitOtp, getUserCredentials, getStatement, deposit, withdraw, getAccountInfo } = require('../controller/user')
const router = express.Router()
const jwt = require('jsonwebtoken')

const jwtMiddleWare = async (req, res, next) => {
    let { authorization } = req.headers
    let [, token] = authorization.split(' ')
    let userId = await jwt.verify(token, process.env.JWT_SECRET)
    if (userId) {
        req.userId = userId
        next()
    }
    else {
        res.send('Cannot Execute Request')
    }
}

router.post('/login', handleUserLogin)
router.post('/register', handleUserReg)

router.get('/getOtp', jwtMiddleWare, getOtp)
router.post('/submitotp', jwtMiddleWare, submitOtp)
router.get('/getdetails', jwtMiddleWare, getUserCredentials)
router.get('/getstatement', jwtMiddleWare, getStatement)
router.post('/deposit', jwtMiddleWare, deposit)
router.post('/withdraw', jwtMiddleWare, withdraw)
router.get('/getaccountinformation', jwtMiddleWare, getAccountInfo)



module.exports = router