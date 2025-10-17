const express = require("express");
const db = require("../config/db");
const router = express.Router();
router.use(express.json());

// Helper: wrap db.query in a promise
function promiseQuery(sql, args = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, args, (err, rows) => {
      if (err) return reject(err);
      resolve([rows]);
    });
  });
}

// ✅ Admin login (simple static for now)
const ADMIN = { username: "admin", password: "2025etc" };

router.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN.username && password === ADMIN.password) {
    return res.status(200).json({ success: true, message: "Login successful" });
  }
  res.status(401).json({ success: false, message: "Invalid credentials" });
});

// ✅ Fetch all users
router.get("/users", async (req, res) => {
  try {
    const [users] = await promiseQuery(`
      SELECT id, full_name, email, gender, partner_gender, city,
             birth_year, birth_month, birth_day, created_at
      FROM users
      ORDER BY created_at DESC
    `);
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load users" });
  }
});

// ✅ Fetch single user details
router.get("/users/:id", async (req, res) => {
  try {
    const [rows] = await promiseQuery(`SELECT * FROM users WHERE id = ?`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: "User not found" });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load user" });
  }
});

// ✅ Create manual match
router.post("/matches", async (req, res) => {
  try {
    const { userA, userB } = req.body;
    if (!userA || !userB) return res.status(400).json({ message: "Missing user IDs" });

    const query = `INSERT INTO matches (user_a, user_b, matched_on) VALUES (?, ?, NOW())`;
    await promiseQuery(query, [userA, userB]);

    res.status(200).json({ message: "Match created successfully!" });
  } catch (err) {
    console.error("Error creating match:", err);
    res.status(500).json({ message: "Error creating match" });
  }
});

//  Fetch all matches
router.get("/matches", async (req, res) => {
    try {
        const query = `
            SELECT 
                m.id, 
                u1.id AS user_a_id, 
                u1.full_name AS user_a_name,
                u2.id AS user_b_id, 
                u2.full_name AS user_b_name,
                m.matched_on
            FROM matches m
            JOIN users u1 ON m.user_a = u1.id
            JOIN users u2 ON m.user_b = u2.id
            ORDER BY m.matched_on DESC
        `;
        const [matches] = await promiseQuery(query);
        res.json(matches);
    } catch (err) {
        console.error("Error fetching matches:", err);
        res.status(500).json({ message: "Failed to load matches" });
    }
});


// ✅ DELETE match by ID (UPDATED TO USE promiseQuery)
router.delete('/matches/:id', async (req, res) => {
    const matchId = req.params.id;
    try {
        const [result] = await promiseQuery('DELETE FROM matches WHERE id = ?', [matchId]); 
        
        // When using DELETE with mysql2, the result object (which is the first element of 
        // the resolved array: [result]) contains the affectedRows property.
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Match not found or already deleted.' });
        }
        
        // Respond with success (200 OK or 204 No Content is also common)
        res.status(200).json({ message: 'Match deleted successfully.' }); 
        
    } catch (error) {
        console.error('Error deleting match:', error);
        res.status(500).json({ message: 'Internal server error during deletion.' });
    }
});
module.exports = router;
