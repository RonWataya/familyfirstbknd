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
app.use('/api', registration); // All routes in registration.js will now start with /api
app.use('/api', admin);        // All routes in admin.js will now start with /api



// ✅ Node.js should run ONLY HTTP, because Apache handles HTTPS
const HOST = '127.0.0.1'; // Ensure this is set
const PORT = process.env.PORT || 7000;

app.listen(PORT, HOST, () => { // Include HOST here
    console.log(`HTTP Server running on http://${HOST}:${PORT}`);
});
// Error Handling
process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled rejection:', reason);
});
