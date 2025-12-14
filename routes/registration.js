const express = require("express");
const db = require("../config/db.js");
require("dotenv").config();

const router = express.Router();

// --- FIELD MAPPINGS FOR NORMALIZED SCHEMA ---
// These remain unchanged
const FIELD_MAPS = {
    USERS: ['pricing_plan', 'full_name', 'email', 'phone', 'profile_image'],
    PROFILE: [
        'gender', 'dob', 'marital_status', 'education_level', 'height', 'ethnicity', 'beliefs',
        'children_in_household', 'city', 'profession', 'income_bracket',
        'smoking_habit', 'drinking_habit', 'partner_role', 'reconcile_style', 'willingness_change',
        'marketing_source'
    ],
    IMPORTANCE: [
        'edu_importance', 'height_importance', 'ethnicity_importance', 'appearance_importance',
        'distance_importance', 'income_importance'
    ],
    PARTNER_PREFS: ['partner_gender', 'partner_smoking', 'partner_drinking', 'partner_children', 'max_distance'],
    TEXT_ANSWERS: ['thankful_for', 'free_time_activities']
};

const MULTI_SELECT_MAPS = [
    { formKey: 'ethnic_preference', table: 'user_ethnic_preferences', column: 'preferred_ethnicity' },
    { formKey: 'partner_beliefs', table: 'user_partner_beliefs', column: 'acceptable_belief' },
    { formKey: 'relationship_values', table: 'user_relationship_values', column: 'value_name' },
    { formKey: 'friend_desc', table: 'user_friend_description', column: 'descriptor' },
    { formKey: 'interests', table: 'user_interests', column: 'interest' },
    { formKey: 'passions', table: 'user_passions', column: 'passion_name' },
    { formKey: 'age_pref', table: 'user_age_preferences', column: 'age_range' }
];

const PSYCHO_KEYS = [
    'psycho_upset', 'psycho_understanding', 'psycho_patience',
    'psycho_stress', 'psycho_discouraged', 'psycho_funny', 'psycho_outgoing'
];

// ✅ ADDED: agree/disagree → numeric scale
const PSYCHO_SCALE_MAP = {
    "Strongly Disagree": 1,
    "Disagree": 2,
    "Slightly Disagree": 3,
    "Neither Agree nor Disagree": 4,
    "Slightly Agree": 5,
    "Agree": 6,
    "Strongly Agree": 7
};

router.post("/register", async (req, res) => {
    let connection;

    try {
        const incoming_data = req.body;
        // 🔍 DEBUG LOG — Shows exactly what the frontend sent
        console.log("🚀 Incoming Registration Data:", JSON.stringify(incoming_data, null, 2));

        if (!incoming_data.email || !incoming_data.password) {
            return res.status(400).json({ success: false, message: "Email and password are required." });
        }

        const password_plain = incoming_data.password;

        connection = await db.getConnection();
        await connection.beginTransaction();

        // --- A. INSERT INTO users (Primary Table) ---
        const userColumns = [
            'pricing_plan', 'full_name', 'email', 'phone', 'password_hash', 'profile_photo_base64'
        ];

        // 🔥 FIX: pricingPlan → pricing_plan
        const pricingPlan =
            incoming_data.pricing_plan ??
            incoming_data.pricingPlan ??
            null;

        const userValues = [
            pricingPlan,
            incoming_data.full_name ?? incoming_data.fullName ?? null,
            incoming_data.email,
            incoming_data.phone ?? incoming_data.phoneNumber ?? null,
            password_plain,
            incoming_data.profile_image ?? null
        ];

        let sql = `INSERT INTO users (${userColumns.join(', ')}) VALUES (${userColumns.map(() => '?').join(', ')})`;
        let [result] = await connection.execute(sql, userValues);
        const userId = result.insertId;

        // --- B. INSERT INTO secondary tables ---
        const insertSingleRow = async (tableName, formKeys, dbMap) => {
            const columns = ['user_id'];
            const values = [userId];

            formKeys.forEach(key => {
                const dbCol = dbMap[key] || key;

                // 🔥 Fix: support camelCase and snake_case
                const altName = Object.keys(incoming_data).find(
                    f => f.toLowerCase() === dbCol.toLowerCase()
                );

                columns.push(dbCol);
                values.push(incoming_data[dbCol] ?? incoming_data[altName] ?? null);
            });

            const sql = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`;
            await connection.execute(sql, values);
        };

        // user_profile
        await insertSingleRow('user_profile', FIELD_MAPS.PROFILE, {
            'children_under_18': 'children_in_household',
            'smoking_frequency': 'smoking_habit',
            'drinking_frequency': 'drinking_habit',
            'how_heard': 'marketing_source',
            'roleInRelationship': 'partner_role',
            'conflictResolutionStyle': 'reconcile_style',
            'willingnessToChange': 'willingness_change'
        });

        // user_importance_scores
        await insertSingleRow('user_importance_scores', FIELD_MAPS.IMPORTANCE, {
            eduImportance: 'edu_importance',
            heightImportance: 'height_importance',
            ethnicityImportance: 'ethnicity_importance',
            appearanceImportance: 'appearance_importance',
            distanceImportance: 'distance_importance',
            incomeImportance: 'income_importance'
        });

        // partner preferences
        await insertSingleRow('partner_single_preferences', FIELD_MAPS.PARTNER_PREFS, {
            'partner_gender': 'partner_gender',
            'partner_smoking_acceptance': 'partner_smoking',
            'partner_drinking_acceptance': 'partner_drinking',
            'accept_partner_with_children': 'partner_children',
            'willing_distance': 'max_distance'
        });

        // text answers
        await insertSingleRow('user_text_answers', FIELD_MAPS.TEXT_ANSWERS, {
            'top_free_time_activities': 'free_time_activities',
            'thankfulFor': 'thankful_for'
        });

        // --- C. MULTI-SELECT INSERTS ---
        for (const map of MULTI_SELECT_MAPS) {
            const selections = incoming_data[map.formKey];
            if (Array.isArray(selections)) {
                const sql = `INSERT INTO ${map.table} (user_id, ${map.column}) VALUES (?, ?)`;
                for (const value of selections) {
                    await connection.execute(sql, [userId, value]);
                }
            }
        }

        // --- D. PSYCHOMETRIC (FIXED) ---
        const psychoSql = `INSERT INTO user_psychometric_responses (user_id, question_key, score) VALUES (?, ?, ?)`;
        for (const key of PSYCHO_KEYS) {
            const raw = incoming_data[key];
            const val = PSYCHO_SCALE_MAP[raw];

            if (val !== undefined) {
                await connection.execute(psychoSql, [userId, key, val]);
            }
        }

        await connection.commit();
        res.json({ success: true, message: "Registration saved successfully" });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error("Registration Transaction Failed:", error);

        if (error.code === 'ER_DUP_ENTRY' && error.sqlMessage.includes('email')) {
            return res.status(409).json({ success: false, message: "A user with this email already exists." });
        }

        res.status(500).json({ success: false, message: "Database error occurred during registration." });
    } finally {
        if (connection) connection.release();
    }
});

//User Login
router.post("/sign-in", async (req, res) => {
  console.log('Login request received');
  console.log('Request body:', req.body);
  let connection;

  try {
    console.error(`RAW INPUT: Email: [${req.body.email}], Password: [${req.body.password}]`);
    
    // 1. INPUT VALIDATION
    let { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required." });
    }

    email = email.trim();
    password = password.trim();

    connection = await db.getConnection();

    // 2. FETCH CORE USER
    const userSql = `
      SELECT id, email, password_hash, full_name, phone, profile_photo_base64, pricing_plan
      FROM users
      WHERE email = ?
    `;
    const [users] = await connection.execute(userSql, [email]);
    
    console.error(`DB QUERY RESULT: Users found: ${users.length}`); 

    if (users.length === 0) {
      return res.status(401).json({ success: false, message: "User not found." });
    }

    const user = users[0];

    // 3. VERIFY PASSWORD
    const dbPassword = user.password_hash.trim();
    const inputPassword = password;

    console.error(`DB Password: [${dbPassword}]`);
    console.error(`Input Password: [${inputPassword}]`);

    if (dbPassword !== inputPassword) {
        console.error("Password mismatch for:", email); 
        return res.status(401).json({ success: false, message: "Invalid credentials" }); 
    }
    
    // 4. FETCH LINKED DATA (Safely)
    
    // A. Profile (Demographics)
    const [profiles] = await connection.execute(
      "SELECT * FROM user_profile WHERE user_id = ?", 
      [user.id]
    );
    const profile = profiles[0] || {};

    // B. Importance Scores
    const [importance] = await connection.execute(
      "SELECT * FROM user_importance_scores WHERE user_id = ?", 
      [user.id]
    );
    const importanceScores = importance[0] || {};

    // C. Psychometric Responses (Map to object)
    const [psychoData] = await connection.execute(
      "SELECT question_key, score FROM user_psychometric_responses WHERE user_id = ?", 
      [user.id]
    );
    const psychometrics = {};
    psychoData.forEach((row) => {
      psychometrics[row.question_key] = row.score;
    });

    // D. Partner Preferences (Single Select)
    const [partners] = await connection.execute(
      "SELECT * FROM partner_single_preferences WHERE user_id = ?", 
      [user.id]
    );
    const partnerPrefs = partners[0] || {};

    // E. Text Answers
    const [textAnswers] = await connection.execute(
      "SELECT * FROM user_text_answers WHERE user_id = ?", 
      [user.id]
    );
    const textData = textAnswers[0] || {};

    // F. Multi-Select Data (Arrays)
    const multiSelectTables = [
      { table: "user_ethnic_preferences", column: "preferred_ethnicity", key: "ethnic_preferences" },
      { table: "user_partner_beliefs", column: "acceptable_belief", key: "partner_beliefs" },
      { table: "user_relationship_values", column: "value_name", key: "relationship_values" },
      { table: "user_friend_description", column: "descriptor", key: "friend_descriptions" },
      { table: "user_interests", column: "interest", key: "interests" },
      { table: "user_passions", column: "passion_name", key: "passions" },
      { table: "user_age_preferences", column: "age_range", key: "age_preferences" },
    ];

    const multiSelectData = {};
    
    for (const item of multiSelectTables) {
      try {
        const [rows] = await connection.execute(
          `SELECT ${item.column} FROM ${item.table} WHERE user_id = ?`,
          [user.id]
        );
        multiSelectData[item.key] = rows.map((row) => row[item.column]);
      } catch (err) {
        console.warn(`Warning: Could not fetch ${item.table}`, err.message);
        multiSelectData[item.key] = [];
      }
    }

    // 5. CONSTRUCT FINAL RESPONSE
    const userData = {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      phone: user.phone,
      profile_photo_base64: user.profile_photo_base64,
      pricing_plan: user.pricing_plan,
      profile,
      importanceScores,
      psychometrics,
      partnerPrefs,
      textData,
      multiSelectData,
    };

    res.json({ success: true, user: userData });

  } catch (error) {
    // 🛑 DEBUG: Catch and log any server error
    console.error("Login Error:", error);
    res.status(500).json({ success: false, message: "Server error during login." });
  } finally {
    if (connection) connection.release();
  }
});


module.exports = router;
