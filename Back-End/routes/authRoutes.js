const express = require("express");
const router = express.Router();
const pool = require("../Database");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const {
  normalizeEmail,
  generateOtpCode,
  getOtpExpiryDate,
  sendOtpEmail,
} = require("../Utils/authHelpers");

router.post("/login", async (req, res) => {
  try {
    const trimmedEmail = normalizeEmail(req.body.email);
    const trimmedPassword = req.body.password?.trim();

    if (!trimmedEmail || !trimmedPassword) {
      return res.status(400).json({
        message: "Email and password are required.",
      });
    }

    const result = await pool.query(
      `SELECT id, first_name, last_name, email, password, is_verified
       FROM users
       WHERE email = $1`,
      [trimmedEmail]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        message: "Invalid email or password. Please try again.",
      });
    }

    const user = result.rows[0];

    const isMatch = await bcrypt.compare(trimmedPassword, user.password);

    if (!isMatch) {
      return res.status(400).json({
        message: "Invalid email or password. Please try again.",
      });
    }

    if (!user.is_verified) {
      return res.status(403).json({
        message: "Please verify your account first before logging in.",
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1d",
      }
    );

    return res.status(200).json({
      message: "Login successful.",
      token,
      user: {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        isVerified: user.is_verified,
      },
    });
  } catch (error) {
    console.error("LOGIN ERROR:", error);
    return res.status(500).json({
      message: "Login failed. Please try again.",
    });
  }
});

router.post("/password/forgot", async (req, res) => {
  const email = normalizeEmail(req.body.email);

  const result = await pool.query(
    "SELECT id, first_name FROM users WHERE email = $1",
    [email]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ message: "Account not found" });
  }

  const otpCode = generateOtpCode();
  const otpExpiresAt = getOtpExpiryDate();

  await pool.query(
    `UPDATE users
     SET otp_code = $1,
         otp_expires_at = $2
     WHERE email = $3`,
    [otpCode, otpExpiresAt, email]
  );

  await sendOtpEmail({
    firstName: result.rows[0].first_name,
    email,
    otpCode,
  });

  res.json({
    message: "Password reset code sent",
  });
});

module.exports = router;