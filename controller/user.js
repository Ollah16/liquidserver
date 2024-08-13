const bcrypt = require('bcrypt')
const jwt = require("jsonwebtoken");
const speakeasy = require('speakeasy');
const axios = require('axios')

const { User, Statement, Beneficiary } = require('../model/userSchema');
const { sendOTPByEmail } = require('../utils/mailer');

exports.handleUserLogin = async (req, res) => {
    const { userId, password } = req.body;

    try {
        // Validate input
        if (!userId || !password) {
            return res.status(400).json({ error: 'User ID or password is missing.' });
        }

        // Check if the user exists
        const user = await User.findOne({ userId });

        if (!user) {
            return res.status(404).json({ error: 'User does not exist.' });
        }

        // Compare passwords
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Incorrect user ID or password.' });
        }

        await User.findOneAndUpdate({ userId }, { lastLogin: new Date() })

        //Generate token
        const token = jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '10m' });

        // Respond with the token
        return res.status(200).json({ token });
    } catch (error) {
        console.error('Error handling user login:', error.message);
        return res.status(500).json({ error: 'Internal server error.' });
    }
};

exports.handleUserReg = async (req, res) => {
    const { title, firstName, lastName, userId, password, dob, email, phone, street, city, state, postCode, accountNumber, accountType, sortCode, balance } = req.body;

    const address = { street, city, state, postCode }

    // Validate input
    if (!firstName || !lastName || !dob || !accountNumber || !email || !phone || !password || !userId) {
        return res.status(400).json({ error: 'All fields are required.' });
    }

    try {
        // Check if the user already exists
        const existingUser = await User.findOne({ $or: [{ email }, { accountNumber }, { userId }] });
        if (existingUser) {
            return res.status(409).json({ error: 'Email or account number already in use.' });
        }

        // Hash the password
        const salt = await bcrypt.genSalt(10);
        const hashPassword = await bcrypt.hash(password, salt);

        //generate secret for one time password
        const authSecret = speakeasy.generateSecret();

        // Create a new user
        const newUser = new User({
            title,
            firstName,
            lastName,
            userId,
            password: hashPassword,
            dob,
            email,
            phone,
            address,
            accountNumber,
            accountType,
            balance: parseFloat(balance),
            sortCode,
            lastLogin: 0,
            authSecret: authSecret.base32
        });

        // Save the user to the database
        await newUser.save();

        return res.status(201).json({ message: 'User registered successfully.' });
    } catch (error) {
        console.error('Error handling user registration:', error.message);
        return res.status(500).json({ error: 'Internal server error.' });
    }
};

exports.getOtp = async (req, res) => {
    try {
        const { userId } = req.userId;

        // Retrieve user's email from database using the provided id
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        const { email, authSecret } = user;

        // Generate one-time password
        const oneTimePass = speakeasy.time({
            secret: authSecret,
            encoding: 'base32',
            algorithm: "sha256",
            step: 300
        });

        // Send OTP to user's email
        await sendOTPByEmail(email, oneTimePass);

        // Respond with success message
        return res.status(200).json({ message: 'OTP sent successfully' });
    } catch (error) {
        console.error('Error generating OTP:', error.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

exports.submitOtp = async (req, res) => {
    const { oneTimePass } = req.body;

    try {
        const { userId } = req.userId;

        if (!oneTimePass) {
            return res.status(400).json({ error: 'OTP is required.' });
        }

        // Retrieve user's email from database using the provided id
        const user = await User.findById(userId);

        const { authSecret } = user

        if (!authSecret) {
            return res.status(401).json({ error: 'internal error, authsecret not found' })
        }

        // Verify OTP token
        const verified = speakeasy.time.verify({
            secret: authSecret,
            token: oneTimePass,
            encoding: 'base32',
            algorithm: "sha256",
            step: 300
        });

        if (!verified) {
            return res.status(401).json({ error: 'Invalid OTP token.' });
        }

        // Generate token
        const token = jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });

        return res.status(200).json({ token });

    } catch (error) {
        console.error('Error verifying OTP:', error.message);
        return res.status(500).json({ error: 'Internal server error.', details: error.message });
    }
};

exports.getUserCredentials = async (req, res) => {
    //validate user
    const { userId } = req.userId

    try {
        const user = await User.findById(userId)

        if (!user) {
            res.status(404).json({ error: 'User does not exist' })
        }

        const { title, firstName, lastName, dob, email, phone, balance, address, accountNumber, accountType, sortCode, lastLogin } = user

        const userDetails = { title, firstName, lastName, dob, email, phone, balance, address, accountNumber, accountType, sortCode, lastLogin }

        res.status(200).json({ userDetails })

    } catch (error) {

        console.error('Error generating details:', error.message);
        return res.status(500).json({ error: 'Internal server error' });

    }
}

exports.getStatement = async (req, res) => {
    const { userId } = req.userId

    try {
        const statement = await Statement.find({ userId })
        res.status(200).json({ statement })

    } catch (error) {
        console.error(error.message)
        return res.status(500).json({ error: 'Internal server error' });

    }


}

function generateRandomDigits() {
    let digits = '';

    for (let i = 0; i < 19; i++) {
        const randomDigit = Math.floor(Math.random() * 10); // Generate a random digit between 0 and 9
        digits += randomDigit;
    }

    return digits;
}

const handleTransaction = async (req, res, type) => {
    const { userId } = req.userId;
    const { amount, transaction_description, transaction_type, payment_detail } = req.body;
    const reference_Number = generateRandomDigits()
    // Validate the amount
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ error: 'Invalid transaction amount' });
    }

    try {
        // Get current balance
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Calculate new balance
        const newBalance = type === 'deposit'
            ? Math.floor(user.balance + parsedAmount)
            : Math.floor(user.balance - parsedAmount);

        if (newBalance < 0) {
            return res.status(400).json({ error: 'Insufficient funds' });
        }

        // Update user's balance
        await User.findByIdAndUpdate(userId, { balance: newBalance });

        // Create and save the transaction statement
        const newTransaction = new Statement({
            transaction_description,
            transaction_type,
            amount: parsedAmount,
            balance_after_transaction: newBalance,
            payment_detail,
            reference_Number,
            userId
        });
        await newTransaction.save();

        res.status(200).json({ message: `Funds ${type}ed successfully` });
    } catch (error) {
        console.error('Error handling transaction:', error.message);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.deposit = async (req, res) => {
    await handleTransaction(req, res, 'deposit');
};

exports.withdraw = async (req, res) => {
    await handleTransaction(req, res, 'withdrawal');
};

exports.getAccountInfo = async (req, res) => {
    const { userId } = req.userId;

    try {
        // Check if the user already exists
        const user = await User.findById(userId);

        const { accountType, sortCode, balance, accountNumber } = user

        const accountInformation = { accountType, sortCode, balance, accountNumber }

        res.json({ accountInformation })

    } catch (error) {
        console.error('Error handling user registration:', error.message);
        return res.status(500).json({ error: 'Internal server error.' });
    }
}

exports.addBeneficiary = async (req, res) => {
    const { userId } = req.userId;
    const { recipientFullName, recipientAccountNumber, recipientSortCode } = req.body;

    try {
        // Check if the user exists
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        // Create and save new beneficiary
        const newBeneficiary = new Beneficiary({ recipientFullName, recipientAccountNumber, recipientSortCode, userId });
        await newBeneficiary.save();

        // Respond with success message and the new beneficiary's ID
        res.status(200).json({ beneficiaryId: newBeneficiary._id });

    } catch (error) {
        console.error('Error adding beneficiary:', error.message);
        return res.status(500).json({ error: 'Internal server error.' });
    }
};

exports.getAllBeneficiary = async (req, res) => {
    const { userId } = req.userId;

    try {
        // Check if the user already exists
        const user = await User.findById(userId);

        if (!user) return res.status(404).json({ error: 'user not found' })

        const allBeneficiary = await Beneficiary.find({ userId })

        res.status(200).json({ allBeneficiary })

    } catch (error) {
        console.error('Error fetching beneficiaries:', error.message);
        return res.status(500).json({ error: 'Internal server error.' });
    }
}

exports.getRecipient = async (req, res) => {
    const { userId } = req.userId;
    const { id } = req.params

    try {
        // Check if the user already exists
        const user = await User.findById(userId);

        if (!user) return res.status(404).json({ error: 'user not found' })

        const recipient = await Beneficiary.findById(id)

        res.status(200).json({ recipient })

    } catch (error) {
        console.error('Error fetching recipient:', error.message);
        return res.status(500).json({ error: 'Internal server error.' });
    }
}

exports.deleteBeneficiary = async (req, res) => {
    const { userId } = req.userId;
    const { id } = req.params;

    try {
        // Check if the user exists
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Find and delete the beneficiary
        const beneficiary = await Beneficiary.findByIdAndDelete(id);

        if (!beneficiary) {
            return res.status(404).json({ error: 'Beneficiary not found' });
        }

        res.status(200).json({ message: 'Recipient deleted successfully' });

    } catch (error) {
        console.error('Error deleting recipient:', error.message);
        return res.status(500).json({ error: 'Internal server error.' });
    }
};

exports.getExchangeRates = async (req, res) => {

    try {
        const apiKey = process.env.EXCHANGE_API

        const response = await axios.get(`https://v6.exchangerate-api.com/v6/${apiKey}/latest/GBP`)
        const exchangeRates = response.data;

        res.status(200).json({ exchangeRates })

    } catch (error) {
        console.error('Error fetching exchange rates:', error);
        return null;
    }
};