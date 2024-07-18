if (process.NODE_ENV != 'production') { require('dotenv').config(); }

const express = require('express');
const cors = require('cors')

// Create an instance of the Express app
const app = express();

// Routes
const userRoute = require('./routes/user')

// Middleware
app.use(express.urlencoded({ extended: true }));


const corsOptions = {
    origin: 'https://liquid-store.vercel.app', // Allow this origin
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true, // Allow credentials (cookies, authorization headers, etc.)
    optionsSuccessStatus: 204 // For legacy browser support
};

app.use(cors(corsOptions))

// Using Route
app.use('/user', userRoute)

// Define the port
const PORT = process.env.PORT || 8080;

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
