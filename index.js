const express = require("express");
const cors = require("cors");
require('dotenv').config();

const registration = require('./routes/registration');
const admin = require('./routes/admin');
//const login = require('./routes/login');

const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static('public/uploads'));
app.use(cors({ origin: '*' }));

app.use('/api', registration);
app.use('/api', admin);
//app.use('/api', login);

//const HOST = '127.0.0.1';
const HOST = 'localhost';
const PORT = process.env.PORT || 7000;

app.listen(PORT, HOST, () => {
    console.log(`HTTP Server running on http://${HOST}:${PORT}`);
});

app.use((req, res) => res.status(404).send('Not Found'));

process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled rejection:', reason);
});