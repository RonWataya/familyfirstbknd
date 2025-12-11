// config/db.js

// 1. CRITICAL CHANGE: Require the promise-based API
const mysql = require("mysql2/promise"); 

const dbConfig = require("./db.config.js");

// Create a connection pool
const pool = mysql.createPool({
 connectionLimit: 1000,
 host: dbConfig.HOST,
 user: dbConfig.USER,
 password: dbConfig.PASSWORD,
 database: dbConfig.DB,
 port: dbConfig.PORTAWS,
 waitForConnections: true,
 queueLimit: 0
});

// 2. CRITICAL CHANGE: Use async/await to test the connection (no callback)
// This immediately starts the test and doesn't block the export.
async function testDbConnection() {
    let connection;
    try {
        connection = await pool.getConnection();
        console.log("Successfully connected to the database.");
        connection.release();
    } catch (error) {
        console.error("Database connection failed:", error.message);
        // If the connection fails, it's safer to throw or exit the process
        throw error;
    }
}

testDbConnection();

// 3. Export the Pool object
module.exports = pool;