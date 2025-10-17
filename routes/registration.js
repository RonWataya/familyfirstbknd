const express = require("express");
const db = require("../config/db.js");
require("dotenv").config();

const router = express.Router();

// Columns now exactly match the cleaned SQL table and HTML form (sections 1-10)
const ALL_USER_COLUMNS = [
    'full_name', 'email', 'phone','profile_image',
    'gender', 'partner_gender', 'marital_status', 'education_level', 'intelligence_importance',
    'height', 'height_importance', 'ethnic_group', 'ethnic_preferences', 'ethnicity_importance',
    'appearance_satisfaction', 'partner_appearance_importance', 'beliefs', 'religious_preferences',
    'religion_importance', 'partner_role', 'first_date_activity', 'first_date_impression',
    'first_kiss_initiation', 'weekend_plans', 'shared_calendar', 'reconciliation',
    'meeting_friends', 'relationship_importance', 'sex_desire', 'monogamy_belief',
    'willingness_to_change', 'tardiness_response', 'time_share', 'enjoy_activity',
    'pattern_preference', 'optimism_level', 'settling_in', 'time_for_others',
    'order_consistency', 'ambition_level', 'attention_to_detail', 'get_upset_easily',
    'handle_information', 'do_nice_things', 'protective', 'understanding',
    'little_patience', 'responsible', 'well_informed', 'creative', 'accomplish_a_lot',
    'mood_week', 'stressed_picture', 'recharge_help', 'variety_liking',
    'get_stressed_easily', 'make_people_laugh', 'spontaneous', 'chatting_easy',
    'outgoing', 'trendy', 'athletic', 'friend_terms', 'thankful_for',
    'interests', 'passionate_about', 'top_free_time_activities', 'smoking_frequency',
    'partner_smoking_acceptance', 'smoking_importance', 'drinking_frequency',
    'partner_drinking_acceptance', 'drinking_importance', 'children_under_18',
    'imagine_children', 'accept_partner_with_children', 'first_name', 'city',
    'willing_distance', 'distance_importance', 'birth_month', 'birth_day', 'birth_year',
    'age_importance', 'age_ranges', 'profession', 'income_bracket', 'income_importance',
    'how_heard'
];

router.post("/register", (req, res) => {
    try {
        const incoming_data = req.body;
        const INT_FIELDS = ['birth_month', 'birth_day', 'birth_year'];

        const values = ALL_USER_COLUMNS.map(column => {
            let value = incoming_data[column];
            if (value === undefined || value === "") {
                return INT_FIELDS.includes(column) ? null : "";
            }
            return value;
        });

        const columnNames = ALL_USER_COLUMNS.join(", ");
        const placeholders = ALL_USER_COLUMNS.map(() => "?").join(",");

        const sql = `INSERT INTO users (${columnNames}) VALUES (${placeholders})`;

        db.query(sql, values, (err, result) => {
            if (err) {
                console.error("DB Error:", err);
                if (err.code === 'ER_DUP_ENTRY' && err.sqlMessage.includes('email')) {
                    return res.status(409).json({ success: false, message: "A user with this email already exists." });
                }
                return res.status(500).json({ success: false, message: "Database error occurred during registration." });
            }
            res.json({ success: true, message: "Registration saved successfully" });
        });
    } catch (error) {
        console.error("Server Error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
});

module.exports = router;
