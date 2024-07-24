const mongoose = require('mongoose');
const { connect, Schema, model } = mongoose;

// Connect to MongoDB
connect(process.env.MONGODB_URI)
    .then(() => console.log('Connected to MongoDB successfully'))
    .catch(err => console.error('MongoDB connection error:', err));

// User Schema
const userSchema = new Schema({
    title: {
        type: String,
        required: true
    },
    firstName: {
        type: String,
        required: true
    },
    lastName: {
        type: String,
        required: true
    },
    userId: {
        type: String,
        required: true
    },
    password: {
        type: String,
        required: true
    },
    dob: {
        type: Date,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    phone: {
        type: Number,
        required: true
    },
    address: {
        houseNo: {
            type: String,
        },
        street: {
            type: String,
        },
        city: {
            type: String,
        },
        state: {
            type: String,
        },
        postCode: {
            type: String,
        }
    },
    sortCode: {
        type: String,
        required: true,
    },
    accountNumber: {
        type: Number,
        required: true,
    },
    accountType: {
        type: String,
        enum: ['classic', 'current', 'business'],
        required: true
    },
    balance: {
        type: Number,
        required: true,
        min: [0, 'Balance cannot be negative']
    },
    created_at: {
        type: Date,
        default: Date.now
    }
});

// Statement Schema
const statementSchema = new Schema({
    transaction_description: {
        type: String,
        required: true,
    },
    transaction_date: {
        type: Date,
        required: true,
        default: Date.now
    },
    transaction_type: {
        type: String,
        enum: ['deposit', 'withdrawal', 'transfer'],
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    balance_after_transaction: {
        type: Number,
        required: true
    },
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }

});

// Create models
const User = model('User', userSchema);
const Statement = model('Statement', statementSchema);

module.exports = { User, Statement };
