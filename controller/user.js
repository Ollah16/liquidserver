const bcrypt = require('bcrypt')
const jwt = require("jsonwebtoken");
const { authenticator } = require('otplib');
const nodemailer = require('nodemailer');
const { User } = require('../model/userSchema');

const secret = authenticator.generateSecret();
const otp = authenticator.generate(secret);

const transporter = nodemailer.createTransport({
    host: 'smtp.office365.com',
    port: 587,
    secure: false,
    auth: {
        user: process.env.EMAIL,
        pass: process.env.PASSWORD
    },
    tls: {
        ciphers: 'SSLv3',
        rejectUnauthorized: false
    },
    pool: true,
    rateLimit: true,
    maxConnections: 5,
    maxMessages: 100
});

const sendOTPByEmail = async (email, otp, retries = 3) => {
    const mailOptions = {
        from: process.env.EMAIL,
        to: email,
        subject: 'Your OTP Code',
        text: `Your one time password is ${otp}`
    };

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            await transporter.sendMail(mailOptions);
            console.log('Email sent successfully');
            return;
        } catch (error) {
            console.error(`Attempt ${attempt} - Error sending email:`, error.message);
            if (attempt === retries) {
                throw new Error('Email sending failed after multiple attempts');
            }
        }
    }
};

transporter.verify(function (error, success) {
    if (error) {
        console.log(error);
    } else {
        console.log("Server is ready to take our messages");
    }
});

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

        //Generate token
        const token = jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });

        // Respond with the token
        return res.status(200).json({ token });
    } catch (error) {
        console.error('Error handling user login:', error.message);
        return res.status(500).json({ error: 'Internal server error.' });
    }
};

exports.handleUserReg = async (req, res) => {
    const { firstName, lastName, dob, accountNumber, email, phone, password, userId } = req.body;

    try {
        // Check if user already exists
        const existingUser = await User.findOne({ $or: [{ email }, { accountNumber }] });

        if (existingUser) {
            return res.status(400).json({ error: 'User with this email or account number already exists.' });
        }

        // Hash the password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create a new user instance
        const newUser = new User({
            firstName,
            lastName,
            dob,
            accountNumber,
            email,
            phone,
            password: hashedPassword,
            userId
        });

        // Save the user to the database
        await newUser.save();

        // Respond with success message
        res.status(201).json({ message: 'User registered successfully.' });

    } catch (error) {
        console.error('Error handling user registration:', error.message);
        res.status(500).json({ error: 'Internal server error.' });
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

        const { email } = user;

        //Generate one time password

        // Send OTP to user's email
        sendOTPByEmail(email, otp);

        // Respond with success message
        return res.status(200).json({ message: 'OTP sent successfully' });
    } catch (error) {
        console.error('Error generating OTP:', error.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

exports.submitOtp = async (req, res) => {
    const { oneTimeP = otp } = req.body;

    try {
        const { userId } = req.userId;

        // Retrieve user's email from database using the provided id
        const user = await User.findById(userId);

        if (!oneTimeP) {
            return res.status(400).json({ error: 'OTP is required.' });
        }

        // Verify OTP token
        const isValid = authenticator.verify({ token: oneTimeP, secret });
        console.log(otp, oneTimeP, isValid)

        if (!isValid) {
            return res.status(401).json({ error: 'Invalid OTP token.' });
        }

        //Generate token
        const token = jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });

        res.status(200).json({ token });

    } catch (error) {
        console.error('Error verifying OTP:', error.message);
        res.status(500).json({ error: 'Internal server error.' });
    }
};