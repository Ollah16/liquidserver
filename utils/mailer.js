const nodemailer = require('nodemailer');

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

transporter.verify(function (error, success) {
    if (error) {
        console.log(error);
    } else {
        console.log("Server is ready to take our messages");
    }
});

exports.sendOTPByEmail = async (email, oneTimePass, retries = 3) => {
    const mailOptions = {
        from: process.env.EMAIL,
        to: email,
        subject: 'Your One-Time Password (OTP) Code',
        text: `Dear User,
    
    Your one-time password (OTP) is: ${oneTimePass}
    
    Please use this code to complete your verification process. This OTP is valid for 5 minutes.
    
    If you did not request this code, please ignore this email.`
    };

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            await transporter.sendMail(mailOptions);
            return;
        } catch (error) {
            console.error(`Attempt ${attempt} - Error sending email:`, error.message);
            if (attempt === retries) {
                throw new Error('Email sending failed after multiple attempts');
            }
        }
    }
};