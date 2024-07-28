const express = require('express')
const {
    handleUserLogin,
    handleUserReg,
    getOtp,
    submitOtp,
    getUserCredentials,
    getStatement,
    deposit,
    withdraw,
    getAccountInfo,
    addBeneficiary,
    getAllBeneficiary,
    deleteBeneficiary,
    getRecipient,
    getExchangeRates } = require('../controller/user')

const router = express.Router()
const jwt = require('jsonwebtoken')

const jwtMiddleWare = async (req, res, next) => {
    try {
        let { authorization } = req.headers
        let [, token] = authorization.split(' ')
        let userId = await jwt.verify(token, process.env.JWT_SECRET)
        if (userId) {
            req.userId = userId
            next()
        }
    }
    catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired' });
        } else if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Invalid token' });
        }
        next(error);
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
router.post('/addBeneficiary', jwtMiddleWare, addBeneficiary)
router.get('/getAllBeneficiary', jwtMiddleWare, getAllBeneficiary)
router.patch('/delBeneficiary/:id', jwtMiddleWare, deleteBeneficiary)
router.get('/getrecipient/:id', jwtMiddleWare, getRecipient)
router.get('/rate', jwtMiddleWare, getExchangeRates)


module.exports = router