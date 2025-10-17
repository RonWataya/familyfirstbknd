const express = require("express");
const cors = require("cors");
require('dotenv').config();
const https = require('https');
const fs = require('fs');


const registration = require('./routes/registration');
const admin = require('./routes/admin');


const app = express();

// Middleware
// FIX 2: Increased body size limit to 50mb to handle large Base64 encoded images (413 error).
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static('public/uploads'));

// Using the 'cors' middleware is sufficient and cleaner than setting headers manually.
app.use(cors({ origin: '*' }));

// Routes
app.use(registration);
app.use(admin);


// HTTPS Options - Replace with OmniPOS cert path
const options = {
    key: fs.readFileSync('/etc/letsencrypt/live/miwalletmw.com/privkey.pem'),
    cert: fs.readFileSync('/etc/letsencrypt/live/miwalletmw.com/fullchain.pem'),
};

// FIX 1: Changed default port to 7000 to match the client's fetch URL in app.js.
const PORT = process.env.PORT || 7000;
/*app.listen(PORT, () => {
    console.log(`Server is running on ${PORT}`);
});*/
https.createServer(options, app)
    .listen(PORT, () => {
        console.log(`HTTPS Server running on port ${PORT}`);
    })
    .on('error', (error) => {
        console.error('HTTPS server error:', error);
    });

// Graceful error handlers
process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled rejection:', reason, promise);
});
