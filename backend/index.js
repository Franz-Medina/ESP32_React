const express = require("express");
const pool = require("./db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(cors({ origin: process.env.NODE_ENV === "production" ? process.env.FRONTEND_URL : "http://localhost:5173" }));
app.use(express.json());

app.post("/register", async (req, res) => {
    console.log("🔵 BODY RECEIVED:", req.body);

    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: "Email and password required" });
    }

    try {
        // Check if user already exists
        const existing = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
        if (existing.rows.length > 0) {
            return res.status(400).json({ message: "User already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await pool.query(
            "INSERT INTO users (email, password) VALUES ($1, $2) RETURNING *",
            [email, hashedPassword]
        );

        console.log("USER CREATED:", result.rows[0]);
        res.status(201).json({ message: "User created successfully" });
    } catch (err) {
        console.error("REGISTER ERROR:", err.message);
        res.status(500).json({ error: "Server error" });
    }
});

app.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await pool.query(
            "SELECT * FROM users WHERE email = $1",
        [email]
        );

    if (user.rows.length === 0) {
        return res.status(400).json({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(
        password,
        user.rows[0].password
    );

    if (!isMatch) {
        return res.status(400).json({ message: "Invalid credentials" });
    }

    res.json({ message: "Login successful" });
  } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Server error" });
  }
});

app.listen(process.env.PORT, () => {
    console.log(`Server running on port ${process.env.PORT}`);
});