const express = require("express");
const pool = require("./Database");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
require("dotenv").config();

const app = express();

app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? process.env.FRONTEND_URL
        : "http://localhost:5173",
  })
);

app.use(express.json());

const OTP_EXPIRY_SECONDS = Number(process.env.OTP_EXPIRY_SECONDS || 60);
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_SECURE = process.env.SMTP_SECURE === "true";

const mailTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_SECURE,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const normalizeEmail = (email = "") => email.trim().toLowerCase();

const generateOtpCode = () =>
  crypto.randomBytes(4).toString("hex").toUpperCase().slice(0, 6);

const getOtpExpiryDate = () =>
  new Date(Date.now() + OTP_EXPIRY_SECONDS * 1000);

const sendOtpEmail = async ({ firstName, email, otpCode }) => {
  const displayName = firstName?.trim() || "User";

  await mailTransporter.sendMail({
    from: `"${process.env.MAIL_FROM_NAME || "AVINYA"}" <${process.env.SMTP_USER}>`,
    to: email,
    subject: "Your AVINYA OTP Verification Code",
    html: `
      <div style="font-family: Poppins, Arial, sans-serif; color: #1f1f1f; line-height: 1.6;">
        <h2 style="margin-bottom: 12px;">AVINYA OTP Verification</h2>
        <p>Hello ${displayName},</p>
        <p>Your 6-character verification code is:</p>
        <div style="margin: 18px 0; font-size: 28px; font-weight: 700; letter-spacing: 6px; color: #980000;">
          ${otpCode}
        </div>
        <p>This code will expire in 60 seconds.</p>
        <p>If you did not request this, you may ignore this email.</p>
      </div>
    `,
  });
};

app.post("/register", async (req, res) => {
  const client = await pool.connect();

  try {
    const { firstName, lastName, email, password } = req.body;

    const trimmedFirstName = firstName?.trim();
    const trimmedLastName = lastName?.trim();
    const trimmedEmail = normalizeEmail(email);
    const trimmedPassword = password?.trim();

    if (!trimmedFirstName || !trimmedLastName || !trimmedEmail || !trimmedPassword) {
      return res.status(400).json({
        message: "First name, last name, email, and password are required.",
      });
    }

    await client.query("BEGIN");

    const existing = await client.query(
      "SELECT id FROM users WHERE email = $1",
      [trimmedEmail]
    );

    if (existing.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(trimmedPassword, 10);
    const otpCode = generateOtpCode();
    const otpExpiresAt = getOtpExpiryDate();

    const result = await client.query(
      `INSERT INTO users (first_name, last_name, email, password, otp_code, otp_expires_at, is_verified)
       VALUES ($1, $2, $3, $4, $5, $6, FALSE)
       RETURNING id, first_name, last_name, email, is_verified, created_at`,
      [
        trimmedFirstName,
        trimmedLastName,
        trimmedEmail,
        hashedPassword,
        otpCode,
        otpExpiresAt,
      ]
    );

    await sendOtpEmail({
      firstName: trimmedFirstName,
      email: trimmedEmail,
      otpCode,
    });

    await client.query("COMMIT");

    console.log("USER CREATED:", result.rows[0]);

    return res.status(201).json({
      message: "Account created successfully.",
      user: result.rows[0],
      otpExpiresAt: otpExpiresAt.toISOString(),
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("REGISTER ERROR:", error);
    return res.status(500).json({
      message: error.message || "Registration failed. Please try again.",
    });
  } finally {
    client.release();
  }
});

app.post("/otp/verify", async (req, res) => {
  try {
    const trimmedEmail = normalizeEmail(req.body.email);
    const trimmedCode = req.body.code?.trim().toUpperCase();

    if (!trimmedEmail || !trimmedCode) {
      return res.status(400).json({
        message: "Email and verification code are required.",
      });
    }

    const result = await pool.query(
      `SELECT id, email, is_verified, otp_code, otp_expires_at
       FROM users
       WHERE email = $1`,
      [trimmedEmail]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Account not found.",
      });
    }

    const user = result.rows[0];

    if (user.is_verified) {
      return res.status(400).json({
        message: "This account is already verified.",
      });
    }

    if (!user.otp_code || !user.otp_expires_at) {
      return res.status(400).json({
        message: "No verification code found. Please resend a new code.",
      });
    }

    if (new Date(user.otp_expires_at).getTime() < Date.now()) {
      return res.status(400).json({
        message: "The verification code has expired. Please resend a new code.",
      });
    }

    if (user.otp_code !== trimmedCode) {
      return res.status(400).json({
        message: "Invalid verification code.",
      });
    }

    await pool.query(
      `UPDATE users
       SET is_verified = TRUE,
           otp_code = NULL,
           otp_expires_at = NULL
       WHERE id = $1`,
      [user.id]
    );

    return res.status(200).json({
      message: "Account verified successfully.",
    });
  } catch (error) {
    console.error("OTP VERIFY ERROR:", error);
    return res.status(500).json({
      message: "Verification failed. Please try again.",
    });
  }
});

app.post("/otp/resend", async (req, res) => {
  try {
    const trimmedEmail = normalizeEmail(req.body.email);

    if (!trimmedEmail) {
      return res.status(400).json({
        message: "Email is required.",
      });
    }

    const result = await pool.query(
      `SELECT id, first_name, email, is_verified
       FROM users
       WHERE email = $1`,
      [trimmedEmail]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Account not found.",
      });
    }

    const user = result.rows[0];

    if (user.is_verified) {
      return res.status(400).json({
        message: "This account is already verified.",
      });
    }

    const otpCode = generateOtpCode();
    const otpExpiresAt = getOtpExpiryDate();

    await pool.query(
      `UPDATE users
       SET otp_code = $1,
           otp_expires_at = $2
       WHERE id = $3`,
      [otpCode, otpExpiresAt, user.id]
    );

    await sendOtpEmail({
      firstName: user.first_name,
      email: user.email,
      otpCode,
    });

    return res.status(200).json({
      message: "A new verification code has been sent.",
      otpExpiresAt: otpExpiresAt.toISOString(),
    });
  } catch (error) {
    console.error("OTP RESEND ERROR:", error);
    return res.status(500).json({
      message: "Failed to resend the verification code.",
    });
  }
});

app.delete("/otp/pending-user", async (req, res) => {
  try {
    const trimmedEmail = normalizeEmail(req.body.email);

    if (!trimmedEmail) {
      return res.status(400).json({
        message: "Email is required.",
      });
    }

    await pool.query(
      `DELETE FROM users
       WHERE email = $1
         AND is_verified = FALSE`,
      [trimmedEmail]
    );

    return res.status(200).json({
      message: "Pending account cleanup completed.",
    });
  } catch (error) {
    console.error("OTP CLEANUP ERROR:", error);
    return res.status(500).json({
      message: "Failed to clean up the pending account.",
    });
  }
});

app.post("/login", async (req, res) => {
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

app.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`);
});