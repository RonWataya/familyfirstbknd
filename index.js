const express = require("express");
const cors = require("cors");
require('dotenv').config();

const registration = require('./routes/registration');
const admin = require('./routes/admin');

const app = express();

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static('public/uploads'));

app.use(cors({ origin: '*' }));

// Routes
app.use(registration);
app.use(admin);

// PORT for Node.js app (internal only)
const PORT = process.env.PORT || 7000;

// ✅ Node.js should run ONLY HTTP, because Apache handles HTTPS
app.listen(PORT, () => {
    console.log(`HTTP Server running on port ${PORT}`);
});

// Error Handling
process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled rejection:', reason);
});
