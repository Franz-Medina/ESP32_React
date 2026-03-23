const express = require("express");
const pool = require("./Database");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const path = require("path");
const rateLimit = require("express-rate-limit");
require("dotenv").config();
const authenticateToken = require("./middleware/authMiddleware");
require("./config/validateENV");


const app = express();

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is not defined");
}

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
const PASSWORD_RESET_EXPIRY_MINUTES = Number(
  process.env.PASSWORD_RESET_EXPIRY_MINUTES || 15
);
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

const NAME_REGEX = /^[A-Za-zÀ-ÖØ-öø-ÿ]+(?:[ '-][A-Za-zÀ-ÖØ-öø-ÿ]+)*$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_UPPERCASE_REGEX = /[A-Z]/;
const PASSWORD_LOWERCASE_REGEX = /[a-z]/;
const PASSWORD_NUMBER_REGEX = /[0-9]/;
const PASSWORD_SPECIAL_REGEX = /[^A-Za-z0-9\s]/;
const OTP_CODE_REGEX = /^[A-Z0-9]{6}$/;
const PASSWORD_RESET_TOKEN_REGEX = /^[a-f0-9]{64}$/i;

const getNameValidationError = (value, label) => {
  if (!value) {
    return `Please enter your ${label.toLowerCase()}.`;
  }

  if (value.length < 2) {
    return `${label} must be at least 2 characters.`;
  }

  if (value.length > 50) {
    return `${label} must not exceed 50 characters.`;
  }

  if (!NAME_REGEX.test(value)) {
    return `${label} contains invalid characters.`;
  }

  return "";
};

const getEmailValidationError = (value) => {
  if (!value) {
    return "Please enter your email.";
  }

  if (/\s/.test(value)) {
    return "Email address must not contain spaces.";
  }

  if (value.length > 254) {
    return "Email address is too long.";
  }

  if (!EMAIL_REGEX.test(value)) {
    return "Please enter a valid email address.";
  }

  return "";
};

const getPasswordValidationError = (value, email) => {
  if (!value) {
    return "Please enter your password.";
  }

  if (value !== value.trim()) {
    return "Password must not start or end with spaces.";
  }

  if (value.length < 8) {
    return "Password must be at least 8 characters.";
  }

  if (value.length > 72) {
    return "Password must not exceed 72 characters.";
  }

  if (!PASSWORD_UPPERCASE_REGEX.test(value)) {
    return "Password must include at least one uppercase letter.";
  }

  if (!PASSWORD_LOWERCASE_REGEX.test(value)) {
    return "Password must include at least one lowercase letter.";
  }

  if (!PASSWORD_NUMBER_REGEX.test(value)) {
    return "Password must include at least one number.";
  }

  if (!PASSWORD_SPECIAL_REGEX.test(value)) {
    return "Password must include at least one special character.";
  }

  if (email && value.toLowerCase() === email.toLowerCase()) {
    return "Password must not be the same as your email address.";
  }

  return "";
};

const getLoginPasswordValidationError = (value) => {
  if (!value) {
    return "Please enter your password.";
  }

  if (value !== value.trim()) {
    return "Password must not start or end with spaces.";
  }

  return "";
};

const registrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many registration attempts. Please try again later.",
  },
});

const otpVerificationLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many verification attempts. Please try again later.",
  },
});

const otpResendLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many resend attempts. Please try again later.",
  },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many login attempts. Please try again later.",
  },
});

const passwordResetRequestLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many reset link requests. Please wait 1 minute before trying again.",
  },
});

const passwordResetConfirmLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many password reset attempts. Please try again later.",
  },
});

const generateOtpCode = () =>
  crypto.randomBytes(4).toString("hex").toUpperCase().slice(0, 6);

const getOtpExpiryDate = () =>
  new Date(Date.now() + OTP_EXPIRY_SECONDS * 1000);

const generatePasswordResetToken = () =>
  crypto.randomBytes(32).toString("hex");

const hashPasswordResetToken = (token = "") =>
  crypto.createHash("sha256").update(token).digest("hex");

const getPasswordResetExpiryDate = () =>
  new Date(Date.now() + PASSWORD_RESET_EXPIRY_MINUTES * 60 * 1000);

const AVINYA_EMAIL_LOGO_PATH = path.join(
  __dirname,
  "../Front-End/src/Pictures/Avinya.png"
);

const ensureUsersTableSchema = async () => {
  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS password_reset_token_hash TEXT;
  `);

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS password_reset_expires_at TIMESTAMP;
  `);
};

const sendOtpEmail = async ({ firstName, email, otpCode }) => {
  const displayName = firstName?.trim() || "User";
  const expiryText = `${OTP_EXPIRY_SECONDS} seconds`;

  await mailTransporter.sendMail({
    from: `"${process.env.MAIL_FROM_NAME || "AVINYA"}" <${process.env.SMTP_USER}>`,
    to: email,
    subject: "AVINYA OTP Verification Code",
    attachments: [
      {
        filename: "Avinya.png",
        path: AVINYA_EMAIL_LOGO_PATH,
        cid: "avinya-logo",
      },
    ],
    text: [
      "AVINYA OTP Verification",
      "",
      `Hello ${displayName},`,
      "",
      "We received a request to verify your AVINYA account.",
      "Use the 6-character code below to continue setting up your account.",
      "",
      otpCode,
      "",
      `This code will expire in ${expiryText}.`,
      "",
      "If you did not request this, you may safely ignore this email.",
    ].join("\n"),
    html: `
      <div style="margin:0; padding:0; background-color:#f4f4f4;">
        <div
          style="
            display:none;
            max-height:0;
            overflow:hidden;
            opacity:0;
            color:transparent;
            visibility:hidden;
            mso-hide:all;
          "
        >
          Your AVINYA verification code is ${otpCode}.
        </div>

        <table
          role="presentation"
          cellpadding="0"
          cellspacing="0"
          border="0"
          width="100%"
          style="margin:0; padding:24px 0; background-color:#f4f4f4;"
        >
          <tr>
            <td align="center" style="padding:24px 16px;">
              <table
                role="presentation"
                cellpadding="0"
                cellspacing="0"
                border="0"
                width="100%"
                style="
                  width:100%;
                  max-width:640px;
                  background-color:#ffffff;
                  border:1px solid #dddddd;
                  border-radius:5px;
                  overflow:hidden;
                "
              >
                <tr>
                  <td
                    align="center"
                    style="
                      padding:18px 24px;
                      background-color:#980000;
                    "
                  >
                    <div
                      style="
                        margin:0;
                        font-family:Poppins, Arial, Helvetica, sans-serif;
                        font-size:20px;
                        font-weight:600;
                        line-height:1.2;
                        color:#ffffff;
                        text-align:center;
                      "
                    >
                      AVINYA OTP Verification
                    </div>
                  </td>
                </tr>

                <tr>
                  <td style="padding:28px 24px 10px 24px;">
                    <div
                      style="
                        margin:0 0 16px 0;
                        font-family:Poppins, Arial, Helvetica, sans-serif;
                        font-size:14px;
                        font-weight:400;
                        line-height:1.6;
                        color:#1f1f1f;
                        text-align:left;
                      "
                    >
                      Hello ${displayName},
                    </div>

                    <div
                      style="
                        margin:0 0 18px 0;
                        font-family:Poppins, Arial, Helvetica, sans-serif;
                        font-size:14px;
                        font-weight:400;
                        line-height:1.8;
                        color:#6b6b6b;
                        text-align:justify;
                        text-justify:inter-word;
                      "
                    >
                      We received a request to verify your AVINYA account.
                      Use the 6-character code below to continue setting up your account.
                    </div>

                    <table
                      role="presentation"
                      cellpadding="0"
                      cellspacing="0"
                      border="0"
                      width="100%"
                      style="
                        margin:0 0 18px 0;
                        background-color:#ffffff;
                        border:1px solid #dddddd;
                        border-radius:5px;
                      "
                    >
                      <tr>
                        <td
                          align="center"
                          style="
                            padding:22px 16px;
                            font-family:Poppins, Arial, Helvetica, sans-serif;
                            font-size:20px;
                            font-weight:700;
                            line-height:1.2;
                            letter-spacing:8px;
                            color:#980000;
                            text-align:center;
                          "
                        >
                          ${otpCode}
                        </td>
                      </tr>
                    </table>

                    <div
                      style="
                        margin:0 0 12px 0;
                        font-family:Poppins, Arial, Helvetica, sans-serif;
                        font-size:14px;
                        font-weight:400;
                        line-height:1.8;
                        color:#6b6b6b;
                        text-align:justify;
                        text-justify:inter-word;
                      "
                    >
                      This code will expire in
                      <span style="font-weight:600; color:#1f1f1f;">${expiryText}</span>.
                    </div>

                    <div
                      style="
                        margin:0 0 18px 0;
                        font-family:Poppins, Arial, Helvetica, sans-serif;
                        font-size:14px;
                        font-weight:400;
                        line-height:1.8;
                        color:#6b6b6b;
                        text-align:justify;
                        text-justify:inter-word;
                      "
                    >
                      If you did not request this, you may safely ignore this email.
                    </div>
                  </td>
                </tr>

                <tr>
                  <td
                    align="center"
                    style="
                      padding:16px 24px 24px 24px;
                      border-top:1px solid #dddddd;
                    "
                  >
                    <table
                      role="presentation"
                      cellpadding="0"
                      cellspacing="0"
                      border="0"
                      align="center"
                      style="margin:0 auto;"
                    >
                      <tr>
                        <td valign="middle" style="padding-right:8px;">
                          <img
                            src="cid:avinya-logo"
                            alt="Avinya Logo"
                            width="18"
                            height="18"
                            style="
                              display:block;
                              width:18px;
                              height:18px;
                              border:0;
                              outline:none;
                            "
                          />
                        </td>
                        <td
                          valign="middle"
                          style="
                            font-family:Poppins, Arial, Helvetica, sans-serif;
                            font-size:14px;
                            font-weight:400;
                            line-height:1.5;
                            color:#6b6b6b;
                          "
                        >
                          Powered by
                          <span style="font-weight:700; color:#1f1f1f;">AVINYA</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </div>
    `,
  });
};

const sendPasswordResetEmail = async ({ firstName, email, resetLink }) => {
  const displayName = firstName?.trim() || "User";
  const expiryText = `${PASSWORD_RESET_EXPIRY_MINUTES} minutes`;

  await mailTransporter.sendMail({
    from: `"${process.env.MAIL_FROM_NAME || "AVINYA"}" <${process.env.SMTP_USER}>`,
    to: email,
    subject: "AVINYA Password Reset",
    attachments: [
      {
        filename: "Avinya.png",
        path: AVINYA_EMAIL_LOGO_PATH,
        cid: "avinya-logo",
      },
    ],
    text: [
      "AVINYA Password Reset",
      "",
      `Hello ${displayName},`,
      "",
      "We received a request to reset your AVINYA account password.",
      "Use the link below to create a new password.",
      "",
      resetLink,
      "",
      `This link will expire in ${expiryText}.`,
      "",
      "If you did not request this, you may safely ignore this email.",
    ].join("\n"),
    html: `
      <div style="margin:0; padding:0; background-color:#f4f4f4;">
        <table
          role="presentation"
          cellpadding="0"
          cellspacing="0"
          border="0"
          width="100%"
          style="margin:0; padding:24px 0; background-color:#f4f4f4;"
        >
          <tr>
            <td align="center" style="padding:24px 16px;">
              <table
                role="presentation"
                cellpadding="0"
                cellspacing="0"
                border="0"
                width="100%"
                style="
                  width:100%;
                  max-width:640px;
                  background-color:#ffffff;
                  border:1px solid #dddddd;
                  border-radius:5px;
                  overflow:hidden;
                "
              >
                <tr>
                  <td
                    align="center"
                    style="
                      padding:18px 24px;
                      background-color:#980000;
                    "
                  >
                    <div
                      style="
                        margin:0;
                        font-family:Poppins, Arial, Helvetica, sans-serif;
                        font-size:20px;
                        font-weight:600;
                        line-height:1.2;
                        color:#ffffff;
                        text-align:center;
                      "
                    >
                      AVINYA Password Reset
                    </div>
                  </td>
                </tr>

                <tr>
                  <td style="padding:28px 24px 10px 24px;">
                    <div
                      style="
                        margin:0 0 16px 0;
                        font-family:Poppins, Arial, Helvetica, sans-serif;
                        font-size:14px;
                        font-weight:400;
                        line-height:1.6;
                        color:#1f1f1f;
                        text-align:left;
                      "
                    >
                      Hello ${displayName},
                    </div>

                    <div
                      style="
                        margin:0 0 18px 0;
                        font-family:Poppins, Arial, Helvetica, sans-serif;
                        font-size:14px;
                        font-weight:400;
                        line-height:1.8;
                        color:#6b6b6b;
                        text-align:justify;
                        text-justify:inter-word;
                      "
                    >
                      We received a request to reset your AVINYA account password.
                      Click the button below to create a new password.
                    </div>

                    <table
                      role="presentation"
                      cellpadding="0"
                      cellspacing="0"
                      border="0"
                      width="100%"
                      style="margin:0 0 18px 0;"
                    >
                      <tr>
                        <td align="center">
                          <a
                            href="${resetLink}"
                            style="
                              display:inline-block;
                              min-width:190px;
                              padding:14px 22px;
                              border-radius:5px;
                              background-color:#980000;
                              color:#ffffff;
                              font-family:Poppins, Arial, Helvetica, sans-serif;
                              font-size:14px;
                              font-weight:600;
                              text-decoration:none;
                              text-align:center;
                            "
                          >
                            Create New Password
                          </a>
                        </td>
                      </tr>
                    </table>

                    <div
                      style="
                        margin:0 0 12px 0;
                        font-family:Poppins, Arial, Helvetica, sans-serif;
                        font-size:14px;
                        font-weight:400;
                        line-height:1.8;
                        color:#6b6b6b;
                        text-align:justify;
                        text-justify:inter-word;
                        word-break:break-word;
                      "
                    >
                      This link will expire in
                      <span style="font-weight:600; color:#1f1f1f;">${expiryText}</span>.
                    </div>

                    <div
                      style="
                        margin:0 0 12px 0;
                        font-family:Poppins, Arial, Helvetica, sans-serif;
                        font-size:14px;
                        font-weight:400;
                        line-height:1.8;
                        color:#6b6b6b;
                        text-align:justify;
                        text-justify:inter-word;
                        word-break:break-word;
                      "
                    >
                      If the button does not work, copy and paste this link into your browser:
                      <br />
                      <span style="color:#980000;">${resetLink}</span>
                    </div>

                    <div
                      style="
                        margin:0 0 18px 0;
                        font-family:Poppins, Arial, Helvetica, sans-serif;
                        font-size:14px;
                        font-weight:400;
                        line-height:1.8;
                        color:#6b6b6b;
                        text-align:justify;
                        text-justify:inter-word;
                      "
                    >
                      If you did not request this, you may safely ignore this email.
                    </div>
                  </td>
                </tr>

                <tr>
                  <td
                    align="center"
                    style="
                      padding:16px 24px 24px 24px;
                      border-top:1px solid #dddddd;
                    "
                  >
                    <table
                      role="presentation"
                      cellpadding="0"
                      cellspacing="0"
                      border="0"
                      align="center"
                      style="margin:0 auto;"
                    >
                      <tr>
                        <td valign="middle" style="padding-right:8px;">
                          <img
                            src="cid:avinya-logo"
                            alt="Avinya Logo"
                            width="18"
                            height="18"
                            style="
                              display:block;
                              width:18px;
                              height:18px;
                              border:0;
                              outline:none;
                            "
                          />
                        </td>
                        <td
                          valign="middle"
                          style="
                            font-family:Poppins, Arial, Helvetica, sans-serif;
                            font-size:14px;
                            font-weight:400;
                            line-height:1.5;
                            color:#6b6b6b;
                          "
                        >
                          Powered by
                          <span style="font-weight:700; color:#1f1f1f;">AVINYA</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </div>
    `,
  });
};

app.post("/register", registrationLimiter, async (req, res) => {
  const client = await pool.connect();

  try {
    const { firstName, lastName, email, password } = req.body;

    const trimmedFirstName = typeof firstName === "string" ? firstName.trim() : "";
    const trimmedLastName = typeof lastName === "string" ? lastName.trim() : "";
    const trimmedEmail = normalizeEmail(typeof email === "string" ? email : "");
    const rawPassword = typeof password === "string" ? password : "";

    const firstNameValidationError = getNameValidationError(trimmedFirstName, "First name");
    const lastNameValidationError = getNameValidationError(trimmedLastName, "Last name");
    const emailValidationError = getEmailValidationError(trimmedEmail);
    const passwordValidationError = getPasswordValidationError(rawPassword, trimmedEmail);

    if (firstNameValidationError) {
      return res.status(400).json({ message: firstNameValidationError });
    }

    if (lastNameValidationError) {
      return res.status(400).json({ message: lastNameValidationError });
    }

    if (emailValidationError) {
      return res.status(400).json({ message: emailValidationError });
    }

    if (passwordValidationError) {
      return res.status(400).json({ message: passwordValidationError });
    }

    await client.query("BEGIN");

    const existing = await client.query(
      "SELECT id, is_verified FROM users WHERE email = $1",
      [trimmedEmail]
    );

    if (existing.rows.length > 0) {
      await client.query("ROLLBACK");

      const existingUser = existing.rows[0];

      if (existingUser.is_verified) {
        return res.status(409).json({
          message: "This email address is already registered.",
        });
      }

      return res.status(409).json({
        message: "This email address already has a pending verification. Please verify your account or resend the code.",
      });
    }

    const hashedPassword = await bcrypt.hash(rawPassword, 10);
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

    if (error.code === "23505") {
      return res.status(409).json({
        message: "This email address is already registered.",
      });
    }

    return res.status(500).json({
      message: "Something went wrong while creating your account. Please try again.",
    });
  } finally {
    client.release();
  }
});

app.post("/otp/verify", otpVerificationLimiter, async (req, res) => {
  try {
    const trimmedEmail = normalizeEmail(
      typeof req.body.email === "string" ? req.body.email : ""
    );
    const trimmedCode =
      typeof req.body.code === "string" ? req.body.code.trim().toUpperCase() : "";

    if (!trimmedEmail) {
      return res.status(400).json({
        message: "Email is required.",
      });
    }

    if (!trimmedCode) {
      return res.status(400).json({
        message: "Please enter the 6-character verification code.",
      });
    }

    if (trimmedCode.length !== 6) {
      return res.status(400).json({
        message: "Verification code must be exactly 6 characters.",
      });
    }

    if (!OTP_CODE_REGEX.test(trimmedCode)) {
      return res.status(400).json({
        message: "Verification code must contain letters and numbers only.",
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
      message: "Something went wrong while verifying your code. Please try again.",
    });
  }
});

app.post("/otp/resend", otpResendLimiter, async (req, res) => {
  try {
    const trimmedEmail = normalizeEmail(req.body.email);

    if (!trimmedEmail) {
      return res.status(400).json({
        message: "Email is required.",
      });
    }

    const result = await pool.query(
      `SELECT id, first_name, email, is_verified, otp_expires_at
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

    if (
      user.otp_expires_at &&
      new Date(user.otp_expires_at).getTime() > Date.now()
    ) {
      return res.status(429).json({
        message: "Please wait until the current code expires before requesting a new one.",
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
      message: "Something went wrong while resending the verification code. Please try again.",
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

<<<<<<< HEAD
const authRoutes = require("./routes/authRoutes");
app.use("/", authRoutes);

app.put("/profile", authenticateToken, async (req, res) => {
  try {
    const { firstName, lastName } = req.body;

    if (!firstName || !lastName) {
      return res.status(400).json({
        message: "First and last name are required",
=======
app.post("/password-reset/request", passwordResetRequestLimiter, async (req, res) => {
  try {
    const rawEmail = typeof req.body.email === "string" ? req.body.email : "";
    const trimmedEmail = normalizeEmail(rawEmail);
    const emailValidationError = getEmailValidationError(rawEmail);

    if (emailValidationError) {
      return res.status(400).json({
        message: emailValidationError,
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
        message: "No account found for this email address.",
      });
    }

    const user = result.rows[0];

    if (!user.is_verified) {
      return res.status(403).json({
        message: "This account is not verified yet. Please complete OTP verification first.",
      });
    }

    const rawResetToken = generatePasswordResetToken();
    const hashedResetToken = hashPasswordResetToken(rawResetToken);
    const resetExpiresAt = getPasswordResetExpiryDate();
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const resetLink = `${frontendUrl}/?page=create-new-password&token=${encodeURIComponent(rawResetToken)}`;

    await pool.query(
      `UPDATE users
      SET password_reset_token_hash = $1,
          password_reset_expires_at = $2
      WHERE id = $3`,
      [hashedResetToken, resetExpiresAt, user.id]
    );

    await sendPasswordResetEmail({
      firstName: user.first_name,
      email: user.email,
      resetLink,
    });

    return res.status(200).json({
      message: "Password reset link sent successfully.",
    });
  } catch (error) {
    console.error("PASSWORD RESET REQUEST ERROR:", {
      message: error.message,
      code: error.code,
      detail: error.detail,
      stack: error.stack,
    });

    return res.status(500).json({
      message: "Something went wrong while sending the reset link. Please try again.",
    });
  }
});

app.post("/password-reset/validate", async (req, res) => {
  try {
    const rawToken = typeof req.body.token === "string" ? req.body.token.trim() : "";

    if (!rawToken || !PASSWORD_RESET_TOKEN_REGEX.test(rawToken)) {
      return res.status(400).json({
        message: "This reset link is invalid, expired, or is no longer the latest request.",
      });
    }

    const hashedToken = hashPasswordResetToken(rawToken);

    const result = await pool.query(
      `SELECT id
       FROM users
       WHERE password_reset_token_hash = $1
         AND password_reset_expires_at IS NOT NULL
         AND password_reset_expires_at > NOW()
         AND is_verified = TRUE`,
      [hashedToken]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        message: "This reset link is invalid, expired, or is no longer the latest request.",
      });
    }

    return res.status(200).json({
      message: "Reset link is valid.",
    });
  } catch (error) {
    console.error("PASSWORD RESET VALIDATE ERROR:", error);
    return res.status(500).json({
      message: "Something went wrong while validating the reset link.",
    });
  }
});

app.post("/password-reset/confirm", passwordResetConfirmLimiter, async (req, res) => {
  try {
    const rawToken = typeof req.body.token === "string" ? req.body.token.trim() : "";
    const rawPassword = typeof req.body.password === "string" ? req.body.password : "";

    if (!rawToken || !PASSWORD_RESET_TOKEN_REGEX.test(rawToken)) {
      return res.status(400).json({
        message: "This reset link is invalid, expired, or is no longer the latest request.",
      });
    }

    const hashedToken = hashPasswordResetToken(rawToken);

    const result = await pool.query(
      `SELECT id, email
       FROM users
       WHERE password_reset_token_hash = $1
         AND password_reset_expires_at IS NOT NULL
         AND password_reset_expires_at > NOW()
         AND is_verified = TRUE`,
      [hashedToken]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        message: "This reset link is invalid, expired, or is no longer the latest request.",
      });
    }

    const user = result.rows[0];
    const passwordValidationError = getPasswordValidationError(rawPassword, user.email);

    if (passwordValidationError) {
      return res.status(400).json({
        message: passwordValidationError,
      });
    }

    const hashedPassword = await bcrypt.hash(rawPassword, 10);

    await pool.query(
      `UPDATE users
       SET password = $1,
           password_reset_token_hash = NULL,
           password_reset_expires_at = NULL
       WHERE id = $2`,
      [hashedPassword, user.id]
    );

    return res.status(200).json({
      message: "Password updated successfully.",
    });
  } catch (error) {
    console.error("PASSWORD RESET CONFIRM ERROR:", error);
    return res.status(500).json({
      message: "Something went wrong while updating your password. Please try again.",
    });
  }
});

app.post("/login", loginLimiter, async (req, res) => {
  try {
    const rawEmail = typeof req.body.email === "string" ? req.body.email : "";
    const rawPassword = typeof req.body.password === "string" ? req.body.password : "";
    const rememberMe = req.body.rememberMe === true;
    const trimmedEmail = normalizeEmail(rawEmail);

    const emailValidationError = getEmailValidationError(rawEmail);
    const passwordValidationError = getLoginPasswordValidationError(rawPassword);

    if (emailValidationError) {
      return res.status(400).json({
        message: emailValidationError,
      });
    }

    if (passwordValidationError) {
      return res.status(400).json({
        message: passwordValidationError,
>>>>>>> 15430deaacc78e1bc4ce27cb75658b466f774052
      });
    }

    await pool.query(
      `UPDATE users
       SET first_name = $1,
           last_name = $2
       WHERE id = $3`,
      [firstName.trim(), lastName.trim(), req.user.id]
    );

<<<<<<< HEAD
    res.json({
      message: "Profile updated successfully",
    });
  } catch (err) {
    console.error("PROFILE UPDATE ERROR:", err);
    res.status(500).json({
      message: "Failed to update profile",
=======
    if (result.rows.length === 0) {
      return res.status(400).json({
        message: "Invalid email or password. Please try again.",
      });
    }

    const user = result.rows[0];

    const isMatch = await bcrypt.compare(rawPassword, user.password);

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
        expiresIn: rememberMe ? "30d" : "1d",
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
      message: "Something went wrong while logging in. Please try again.",
>>>>>>> 15430deaacc78e1bc4ce27cb75658b466f774052
    });
  }
});

<<<<<<< HEAD
const errorHandler = require("./middleware/errorHandler");
app.use(errorHandler);

app.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`);
});
=======
const startServer = async () => {
  try {
    await ensureUsersTableSchema();

    app.listen(process.env.PORT, () => {
      console.log(`Server running on port ${process.env.PORT}`);
    });
  } catch (error) {
    console.error("STARTUP ERROR:", error);
    process.exit(1);
  }
};

startServer();
>>>>>>> 15430deaacc78e1bc4ce27cb75658b466f774052
