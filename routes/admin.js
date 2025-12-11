const express = require("express")
const db = require("../config/db")
const router = express.Router()
router.use(express.json())

// Helper: wrap db.query in a promise

async function promiseQuery(sql, args = []) {
  // With mysql2/promise, .query() returns an array: [rows, fields]
  // We only need the first part (rows).
  const [rows] = await db.query(sql, args);
  return rows;
}

// ✅ Admin login (simple static for now)
const ADMIN = { username: "admin", password: "2025etc" }

router.post("/login", (req, res) => {
  const { username, password } = req.body
  if (username === ADMIN.username && password === ADMIN.password) {
    return res.status(200).json({ success: true, message: "Login successful" })
  }
  res.status(401).json({ success: false, message: "Invalid credentials" })
})

// ✅ Fetch all users with joined profile data
router.get("/users", async (req, res) => {
  try {
    console.log("[v0] GET /users called")
    const users = await promiseQuery(`
      SELECT 
        u.id, 
        u.full_name, 
        u.email, 
        u.created_at,
        up.gender,
        up.city,
        up.dob,
        YEAR(up.dob) AS birth_year,
        MONTH(up.dob) AS birth_month,
        DAY(up.dob) AS birth_day,
        psp.partner_gender,
        up.education_level
      FROM users u
      LEFT JOIN user_profile up ON u.id = up.user_id
      LEFT JOIN partner_single_preferences psp ON u.id = psp.user_id
      ORDER BY u.created_at DESC
    `)
    console.log("[v0] Users fetched successfully:", users?.length || 0)
    res.json(users)
  } catch (err) {
    console.error("[v0] Error in GET /users:", err.message)
    res.status(500).json({ message: "Failed to load users" })
  }
})

// ✅ Fetch single user with all profile details
router.get("/users/:id", async (req, res) => {
  try {
    console.log("[v0] GET /users/:id called with id:", req.params.id)
    const userRows = await promiseQuery(
      `
      SELECT 
        u.id, 
        u.full_name, 
        u.email, 
        u.phone,
        u.pricing_plan,
        u.profile_photo_base64,
        u.created_at,
        up.gender,
        up.dob,
        YEAR(up.dob) AS birth_year,
        MONTH(up.dob) AS birth_month,
        DAY(up.dob) AS birth_day,
        up.marital_status,
        up.education_level,
        up.height,
        up.ethnicity,
        up.beliefs,
        up.children_in_household,
        up.city,
        up.profession,
        up.income_bracket,
        up.smoking_habit,
        up.drinking_habit,
        up.partner_role,
        up.reconcile_style,
        up.willingness_change,
        up.marketing_source,
        psp.partner_gender,
        psp.partner_smoking,
        psp.partner_drinking,
        psp.partner_children,
        psp.max_distance AS willing_distance,
        uis.edu_importance AS intelligence_importance,
        uis.height_importance,
        uis.ethnicity_importance,
        uis.appearance_importance AS partner_appearance_importance,
        uis.distance_importance,
        uis.income_importance
      FROM users u
      LEFT JOIN user_profile up ON u.id = up.user_id
      LEFT JOIN partner_single_preferences psp ON u.id = psp.user_id
      LEFT JOIN user_importance_scores uis ON u.id = uis.user_id
      WHERE u.id = ?
    `,
      [req.params.id],
    )

    if (!userRows.length) {
      console.log("[v0] User not found for id:", req.params.id)
      return res.status(404).json({ message: "User not found" })
    }

    const user = userRows[0]
    console.log("[v0] User found:", user.full_name)

    // Get interests
    const interests = await promiseQuery(`SELECT interest FROM user_interests WHERE user_id = ?`, [req.params.id])
    user.interests = interests.map((i) => i.interest).join(", ")

    // Get passions
    const passions = await promiseQuery(`SELECT passion_name FROM user_passions WHERE user_id = ?`, [req.params.id])
    user.passionate_about = passions.map((p) => p.passion_name).join(", ")

    // Get ethnic preferences
    const ethnicPrefs = await promiseQuery(
      `SELECT preferred_ethnicity FROM user_ethnic_preferences WHERE user_id = ?`,
      [req.params.id],
    )
    user.ethnic_preferences = ethnicPrefs.map((e) => e.preferred_ethnicity).join(", ")

    // Get age ranges
    const ageRanges = await promiseQuery(`SELECT age_range FROM user_age_preferences WHERE user_id = ?`, [
      req.params.id,
    ])
    user.age_ranges = ageRanges.map((a) => a.age_range).join(", ")

    // Get text answers
    const textAnswers = await promiseQuery(
      `SELECT thankful_for, free_time_activities FROM user_text_answers WHERE user_id = ?`,
      [req.params.id],
    )
    if (textAnswers.length > 0) {
      user.thankful_for = textAnswers[0].thankful_for
      user.top_free_time_activities = textAnswers[0].free_time_activities
    }

    // Get relationship values
    
 relValues = await promiseQuery(
   `SELECT GROUP_CONCAT(value_name SEPARATOR ', ') AS relationship_values FROM user_relationship_values WHERE user_id = ?`,
   [req.params.id],
  )
  // Update the property access to match the new alias
  user.relationship_importance = relValues[0]?.relationship_values || null

    // Get friend descriptions
    const friendDescs = await promiseQuery(
      `SELECT GROUP_CONCAT(descriptor SEPARATOR ', ') AS descriptors FROM user_friend_description WHERE user_id = ?`,
      [req.params.id],
    )
    user.enjoy_activity = friendDescs[0]?.descriptors || null

    res.json(user)
  } catch (err) {
    console.error("[v0] Error in GET /users/:id:", err.message)
    res.status(500).json({ message: "Failed to load user" })
  }
})

// ✅ Create manual match
router.post("/matches", async (req, res) => {
  try {
    const { userA, userB } = req.body
    if (!userA || !userB) return res.status(400).json({ message: "Missing user IDs" })

    console.log("[v0] Creating match:", userA, "<->", userB)
    const query = `INSERT INTO matches (user_a, user_b, matched_on) VALUES (?, ?, NOW())`
    await promiseQuery(query, [userA, userB])

    res.status(200).json({ message: "Match created successfully!" })
  } catch (err) {
    console.error("[v0] Error creating match:", err.message)
    res.status(500).json({ message: "Error creating match" })
  }
})

// ✅ Fetch all matches
router.get("/matches", async (req, res) => {
  try {
    console.log("[v0] GET /matches called")
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
    `
    const matches = await promiseQuery(query)
    console.log("[v0] Matches fetched:", matches?.length || 0)
    res.json(matches)
  } catch (err) {
    console.error("[v0] Error fetching matches:", err.message)
    res.status(500).json({ message: "Failed to load matches" })
  }
})

// ✅ DELETE match by ID
router.delete("/matches/:id", async (req, res) => {
  const matchId = req.params.id
  try {
    console.log("[v0] DELETE /matches/:id called with id:", matchId)
    const result = await promiseQuery("DELETE FROM matches WHERE id = ?", [matchId])

    if (result.affectedRows === 0) {
      console.log("[v0] Match not found:", matchId)
      return res.status(404).json({ message: "Match not found or already deleted." })
    }

    console.log("[v0] Match deleted successfully:", matchId)
    res.status(200).json({ message: "Match deleted successfully." })
  } catch (error) {
    console.error("[v0] Error deleting match:", error.message)
    res.status(500).json({ message: "Internal server error during deletion." })
  }
})

module.exports = router
