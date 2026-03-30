const express = require("express");
const pool = require("./Database");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const app = express();

const PORT = Number(process.env.PORT || 5000);
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }

      const allowedOrigins = new Set([
        FRONTEND_URL,
        "http://localhost:5173",
        "http://127.0.0.1:5173",
      ]);

      if (allowedOrigins.has(origin)) {
        return callback(null, true);
      }

      if (
        IS_DEVELOPMENT &&
        /^http:\/\/(?:localhost|127\.0\.0\.1|\d{1,3}(?:\.\d{1,3}){3})(:\d+)?$/.test(origin)
      ) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
  })
);

app.use(express.json());

const OTP_EXPIRY_SECONDS = Number(process.env.OTP_EXPIRY_SECONDS || 60);
const PASSWORD_RESET_EXPIRY_MINUTES = Number(
  process.env.PASSWORD_RESET_EXPIRY_MINUTES || 15
);
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_SECURE = process.env.SMTP_SECURE === "true";

const mailTransporter =
  process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
    ? nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_SECURE,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      })
    : null;

if (!mailTransporter) {
  console.warn(
    "[MAIL] SMTP transporter is not configured. OTP and password reset emails will not be sent from this machine. Add SMTP_* values in Back-End/.env for real email testing."
  );
}

const normalizeEmail = (email = "") => email.trim().toLowerCase();

const NAME_REGEX = /^[A-Za-zÀ-ÖØ-öø-ÿ]+(?:[ '-][A-Za-zÀ-ÖØ-öø-ÿ]+)*$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_UPPERCASE_REGEX = /[A-Z]/;
const PASSWORD_LOWERCASE_REGEX = /[a-z]/;
const PASSWORD_NUMBER_REGEX = /[0-9]/;
const PASSWORD_SPECIAL_REGEX = /[^A-Za-z0-9\s]/;
const OTP_CODE_REGEX = /^[A-Z0-9]{6}$/;
const PASSWORD_RESET_TOKEN_REGEX = /^[a-f0-9]{64}$/i;

const APP_ENCRYPTION_KEY = Buffer.from(process.env.APP_ENCRYPTION_KEY || "", "hex");
const TB_BASE_URL = (process.env.TB_BASE_URL || "").replace(/\/$/, "");
const TB_TENANT_USERNAME = process.env.TB_TENANT_USERNAME || "";
const TB_TENANT_PASSWORD = process.env.TB_TENANT_PASSWORD || "";
const TB_CUSTOMER_ADMIN_GROUP_NAME = "Customer Administrators";
const IS_DEVELOPMENT = process.env.NODE_ENV !== "production";
const MAIL_REQUIRED = process.env.MAIL_REQUIRED === "true";

const AVINYA_EMAIL_LOGO_CANDIDATES = [
  path.join(__dirname, "Front-End", "src", "Pictures", "Avinya.png"),
  path.join(__dirname, "../Front-End", "src", "Pictures", "Avinya.png"),
];

const AVINYA_EMAIL_LOGO_PATH =
  AVINYA_EMAIL_LOGO_CANDIDATES.find((candidate) => fs.existsSync(candidate)) || null;

const getAvinyaMailAttachments = () =>
  AVINYA_EMAIL_LOGO_PATH
    ? [
        {
          filename: "Avinya.png",
          path: AVINYA_EMAIL_LOGO_PATH,
          cid: "avinya-logo",
        },
      ]
    : [];

const handleEmailDeliveryFailure = ({ label, email, fallbackValue, error }) => {
  console.error(`${label} EMAIL ERROR:`, error);

  if (IS_DEVELOPMENT && !MAIL_REQUIRED) {
    console.warn(`[DEV ONLY] ${label} email was not sent to ${email}.`);

    if (fallbackValue) {
      console.warn(`[DEV ONLY] ${label} fallback value: ${fallbackValue}`);
    }

    return;
  }

  throw error;
};

const getTbEntityId = (entity) => entity?.id?.id || entity?.id || null;

const assertRequiredConfig = () => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is required.");
  }

  if (
    MAIL_REQUIRED &&
    (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS)
  ) {
    throw new Error("SMTP configuration is incomplete.");
  }

  if (APP_ENCRYPTION_KEY.length !== 32) {
    throw new Error("APP_ENCRYPTION_KEY must be a 64-character hex string.");
  }

  if (!TB_BASE_URL || !TB_TENANT_USERNAME || !TB_TENANT_PASSWORD) {
    throw new Error("ThingsBoard configuration is incomplete.");
  }
};

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

const encryptSecret = (plainText = "") => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", APP_ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([
    cipher.update(plainText, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    iv.toString("hex"),
    authTag.toString("hex"),
    encrypted.toString("hex"),
  ].join(":");
};

const decryptSecret = (encryptedValue = "") => {
  const [ivHex, authTagHex, encryptedHex] = encryptedValue.split(":");

  if (!ivHex || !authTagHex || !encryptedHex) {
    throw new Error("Encrypted pending password is invalid.");
  }

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    APP_ENCRYPTION_KEY,
    Buffer.from(ivHex, "hex")
  );

  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, "hex")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
};

const ensureUsersTableExists = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      first_name VARCHAR(100) NOT NULL,
      last_name VARCHAR(100) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password TEXT NOT NULL,
      is_verified BOOLEAN NOT NULL DEFAULT FALSE,
      otp_code VARCHAR(6),
      otp_expires_at TIMESTAMP,
      password_reset_token_hash TEXT,
      password_reset_expires_at TIMESTAMP,
      pending_password_encrypted TEXT,
      tb_password_encrypted TEXT,
      tb_customer_id UUID,
      tb_user_id UUID,
      role_label VARCHAR(30) NOT NULL DEFAULT 'Customer Administrator'
        CHECK (role_label IN ('Tenant Administrator', 'Customer Administrator')),
      phone_country_code VARCHAR(10),
      phone_number VARCHAR(30),
      profile_picture_url TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
};

const ensureUsersTableSchema = async () => {
  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS password_reset_token_hash TEXT;
  `);

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS password_reset_expires_at TIMESTAMP;
  `);

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS pending_password_encrypted TEXT;
  `);

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS tb_password_encrypted TEXT;
  `);

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS tb_customer_id UUID;
  `);

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS tb_user_id UUID;
  `);

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS role_label VARCHAR(30) NOT NULL DEFAULT 'Customer Administrator';
  `);

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS phone_country_code VARCHAR(10);
  `);

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS phone_number VARCHAR(30);
  `);

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'users_role_label_check'
      ) THEN
        ALTER TABLE users
        ADD CONSTRAINT users_role_label_check
        CHECK (role_label IN ('Tenant Administrator', 'Customer Administrator'));
      END IF;
    END
    $$;
  `);

  await pool.query(`
    UPDATE users
    SET role_label = CASE
      WHEN LOWER(email) = 'tbd.avinya@gmail.com' THEN 'Tenant Administrator'
      ELSE 'Customer Administrator'
    END
    WHERE role_label IS NULL
       OR role_label NOT IN ('Tenant Administrator', 'Customer Administrator')
       OR LOWER(email) = 'tbd.avinya@gmail.com';
  `);
};

const sendOtpEmail = async ({ firstName, email, otpCode }) => {
  if (!mailTransporter) {
    throw new Error("SMTP transporter is not configured.");
  }
  const displayName = firstName?.trim() || "User";
  const expiryText = `${OTP_EXPIRY_SECONDS} seconds`;

  await mailTransporter.sendMail({
  from: `"${process.env.MAIL_FROM_NAME || "AVINYA"}" <${process.env.SMTP_USER}>`,
  to: email,
  subject: "AVINYA OTP Verification Code",
  attachments: getAvinyaMailAttachments(),
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
  if (!mailTransporter) {
    throw new Error("SMTP transporter is not configured.");
  }
  const displayName = firstName?.trim() || "User";
  const expiryText = `${PASSWORD_RESET_EXPIRY_MINUTES} minutes`;

  await mailTransporter.sendMail({
    from: `"${process.env.MAIL_FROM_NAME || "AVINYA"}" <${process.env.SMTP_USER}>`,
    to: email,
    subject: "AVINYA Password Reset",
    attachments: getAvinyaMailAttachments(),
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

const tbRequest = async (
  pathname,
  { method = "GET", token = "", body, isText = false } = {}
) => {
  const response = await fetch(`${TB_BASE_URL}${pathname}`, {
    method,
    headers: {
      Accept: isText ? "text/plain" : "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { "X-Authorization": `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const data = isText
    ? await response.text()
    : await response.json().catch(() => ({}));

  if (!response.ok) {
    console.error("THINGSBOARD REQUEST ERROR:", {
      pathname,
      method,
      status: response.status,
      body,
      response: data,
    });

    throw new Error(
      typeof data === "string"
        ? data
        : data.message || `ThingsBoard request failed: ${pathname}`
    );
  }

  return data;
};

const tbLogin = async () => {
  const data = await tbRequest("/api/auth/login", {
    method: "POST",
    body: {
      username: TB_TENANT_USERNAME,
      password: TB_TENANT_PASSWORD,
    },
  });

  return data.token;
};

const tbGetUserToken = async (adminToken, userId) => {
  return tbRequest(`/api/user/${userId}/token`, {
    token: adminToken,
  });
};

const tbChangeCurrentUserPassword = async (
  userToken,
  currentPassword,
  newPassword
) => {
  return tbRequest("/api/auth/changePassword", {
    method: "POST",
    token: userToken,
    body: {
      currentPassword,
      newPassword,
    },
  });
};

const findTbCustomerByTitle = async (token, title) => {
  const data = await tbRequest(
    `/api/customers?pageSize=100&page=0&textSearch=${encodeURIComponent(title)}`,
    { token }
  );

  return (
    data?.data?.find(
      (item) => item.title?.toLowerCase() === title.toLowerCase()
    ) || null
  );
};

const findOrCreateTbCustomer = async (token, title) => {
  const existingCustomer = await findTbCustomerByTitle(token, title);

  if (existingCustomer) {
    return existingCustomer;
  }

  return tbRequest("/api/customer", {
    method: "POST",
    token,
    body: { title },
  });
};

const findTbCustomerUserByEmail = async (token, customerId, email) => {
  const data = await tbRequest(
    `/api/customer/${customerId}/users?pageSize=100&page=0&textSearch=${encodeURIComponent(email)}`,
    { token }
  );

  return (
    data?.data?.find(
      (item) => item.email?.toLowerCase() === email.toLowerCase()
    ) || null
  );
};

const findTbCustomerAdminGroup = async (token, customerId) => {
  const groupsResponse = await tbRequest(
    `/api/entityGroups/CUSTOMER/${customerId}/USER`,
    { token }
  );

  const groups = Array.isArray(groupsResponse)
    ? groupsResponse
    : groupsResponse?.data || [];

  return (
    groups.find(
      (group) =>
        group.name?.trim().toLowerCase() ===
        TB_CUSTOMER_ADMIN_GROUP_NAME.toLowerCase()
    ) || null
  );
};

const addTbUserToGroup = async (token, entityGroupId, userId) => {
  return tbRequest(`/api/entityGroup/${entityGroupId}/addEntities`, {
    method: "POST",
    token,
    body: [userId],
  });
};

const toTbUserIdPayload = (userId) => ({
  entityType: "USER",
  id: userId,
});

const saveTbCustomerUser = async (
  token,
  { userId = null, customerId, email, firstName, lastName }
) => {
  return tbRequest("/api/user?sendActivationMail=false", {
    method: "POST",
    token,
    body: {
      ...(userId ? { id: toTbUserIdPayload(userId) } : {}),
      authority: "CUSTOMER_USER",
      email,
      firstName,
      lastName,
      customerId: {
        entityType: "CUSTOMER",
        id: customerId,
      },
    },
  });
};

const createOrReuseTbCustomerUser = async (
  token,
  customerId,
  { email, firstName, lastName }
) => {
  const existingCustomerUser = await findTbCustomerUserByEmail(
    token,
    customerId,
    email
  );

  if (existingCustomerUser) {
    return {
      user: await saveTbCustomerUser(token, {
        userId: getTbEntityId(existingCustomerUser),
        customerId,
        email,
        firstName,
        lastName,
      }),
      isNew: false,
    };
  }

  try {
    return {
      user: await saveTbCustomerUser(token, {
        customerId,
        email,
        firstName,
        lastName,
      }),
      isNew: true,
    };
  } catch (error) {
    if (!/already present in database/i.test(String(error.message || ""))) {
      throw error;
    }

    const duplicateCustomerUser = await findTbCustomerUserByEmail(
      token,
      customerId,
      email
    );

    if (!duplicateCustomerUser) {
      throw error;
    }

    return {
      user: await saveTbCustomerUser(token, {
        userId: getTbEntityId(duplicateCustomerUser),
        customerId,
        email,
        firstName,
        lastName,
      }),
      isNew: false,
    };
  }
};

const getTbUserActivationLink = async (token, userId) => {
  return tbRequest(`/api/user/${userId}/activationLink`, {
    token,
    isText: true,
  });
};

const activateTbUser = async (activationToken, password) => {
  return tbRequest("/api/noauth/activate?sendActivationMail=false", {
    method: "POST",
    body: {
      activateToken: activationToken,
      password,
    },
  });
};

const syncVerifiedUserToThingsBoard = async ({
  firstName,
  lastName,
  email,
  pendingPasswordEncrypted,
  existingTbCustomerId,
  existingTbUserId,
}) => {
  const adminToken = await tbLogin();
  const plainPassword = decryptSecret(pendingPasswordEncrypted);

  const normalizedFirstName = (firstName || "")
    .trim()
    .split(/\s+/)[0]
    .toUpperCase();

  const customerTitle = `AVINYA - ${normalizedFirstName || "USER"}`;

  const customer = existingTbCustomerId
    ? { id: { id: existingTbCustomerId } }
    : await findOrCreateTbCustomer(adminToken, customerTitle);

  const tbCustomerId = getTbEntityId(customer);

  const tbUserResult = existingTbUserId
    ? {
        user: await saveTbCustomerUser(adminToken, {
          userId: existingTbUserId,
          customerId: tbCustomerId,
          email,
          firstName,
          lastName,
        }),
        isNew: false,
      }
    : await createOrReuseTbCustomerUser(adminToken, tbCustomerId, {
        email,
        firstName,
        lastName,
      });

  const tbUser = tbUserResult.user;
  const tbUserId = getTbEntityId(tbUser);

  if (tbUserResult.isNew) {
    const activationLink = await getTbUserActivationLink(adminToken, tbUserId);

    const activationToken = new URL(activationLink).searchParams.get("activateToken");

    if (!activationToken) {
      throw new Error("ThingsBoard activation token was not returned.");
    }

    await activateTbUser(activationToken, plainPassword);
  }

  const customerAdminGroup = await findTbCustomerAdminGroup(
    adminToken,
    tbCustomerId
  );

  if (!customerAdminGroup) {
    throw new Error(
      'ThingsBoard "Customer Administrators" group was not found for this customer.'
    );
  }

  const customerAdminGroupId = getTbEntityId(customerAdminGroup);

  console.log("TB GROUP ASSIGNMENT:", {
    customerId: tbCustomerId,
    groupName: TB_CUSTOMER_ADMIN_GROUP_NAME,
    customerAdminGroupId,
    tbUserId,
    email,
  });

  await addTbUserToGroup(
    adminToken,
    customerAdminGroupId,
    tbUserId
  );

  return {
    tbCustomerId,
    tbUserId: getTbEntityId(tbUser),
  };
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
    const pendingPasswordEncrypted = encryptSecret(rawPassword);
    const otpCode = generateOtpCode();
    const otpExpiresAt = getOtpExpiryDate();

    const result = await client.query(
      `INSERT INTO users (
          first_name,
          last_name,
          email,
          password,
          otp_code,
          otp_expires_at,
          is_verified,
          pending_password_encrypted,
          role_label
        )
      VALUES ($1, $2, $3, $4, $5, $6, FALSE, $7, $8)
      RETURNING id, first_name, last_name, email, is_verified, created_at`,
      [
        trimmedFirstName,
        trimmedLastName,
        trimmedEmail,
        hashedPassword,
        otpCode,
        otpExpiresAt,
        pendingPasswordEncrypted,
        "Customer Administrator",
      ]
    );

    try {
      await sendOtpEmail({
        firstName: trimmedFirstName,
        email: trimmedEmail,
        otpCode,
      });
    } catch (mailError) {
      handleEmailDeliveryFailure({
        label: "OTP",
        email: trimmedEmail,
        fallbackValue: otpCode,
        error: mailError,
      });
    }

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
      `SELECT
          id,
          first_name,
          last_name,
          email,
          is_verified,
          otp_code,
          otp_expires_at,
          pending_password_encrypted,
          tb_customer_id,
          tb_user_id
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

    if (!user.pending_password_encrypted && !user.tb_user_id) {
      return res.status(500).json({
        message: "Pending password data is missing. Please register again.",
      });
    }

    const { tbCustomerId, tbUserId } = await syncVerifiedUserToThingsBoard({
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email,
      pendingPasswordEncrypted: user.pending_password_encrypted,
      existingTbCustomerId: user.tb_customer_id,
      existingTbUserId: user.tb_user_id,
    });

    await pool.query(
      `UPDATE users
      SET is_verified = TRUE,
          otp_code = NULL,
          otp_expires_at = NULL,
          tb_password_encrypted = $4,
          pending_password_encrypted = NULL,
          tb_customer_id = $2,
          tb_user_id = $3
      WHERE id = $1`,
      [user.id, tbCustomerId, tbUserId, user.pending_password_encrypted]
    );

    return res.status(200).json({
      message: "Account verified successfully.",
    });
  } catch (error) {
    console.error("OTP VERIFY ERROR:", {
      message: error.message,
      stack: error.stack,
    });

    const normalizedErrorMessage = String(error.message || "");

    if (/permission/i.test(normalizedErrorMessage)) {
      return res.status(500).json({
        message:
          "ThingsBoard denied one of the sync steps for this tenant administrator account. The tenant-wide user lookup has been removed, but please make sure this tenant admin can create customer users and assign them to the customer group.",
      });
    }

    return res.status(500).json({
      message:
        error.message ||
        "Something went wrong while verifying your code. Please try again.",
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

    try {
      await sendOtpEmail({
        firstName: user.first_name,
        email: user.email,
        otpCode,
      });
    } catch (mailError) {
      handleEmailDeliveryFailure({
        label: "OTP RESEND",
        email: user.email,
        fallbackValue: otpCode,
        error: mailError,
      });
    }

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
    const resetLink = `${FRONTEND_URL}/?page=create-new-password&token=${encodeURIComponent(rawResetToken)}`;

    await pool.query(
      `UPDATE users
      SET password_reset_token_hash = $1,
          password_reset_expires_at = $2
      WHERE id = $3`,
      [hashedResetToken, resetExpiresAt, user.id]
    );

    try {
      await sendPasswordResetEmail({
        firstName: user.first_name,
        email: user.email,
        resetLink,
      });
    } catch (mailError) {
      handleEmailDeliveryFailure({
        label: "PASSWORD RESET",
        email: user.email,
        fallbackValue: resetLink,
        error: mailError,
      });
    }

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
      `SELECT id, email, tb_user_id, tb_password_encrypted
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

    if (!user.tb_user_id) {
      return res.status(409).json({
        message: "This account is not linked to ThingsBoard yet.",
      });
    }

    const passwordValidationError = getPasswordValidationError(rawPassword, user.email);

    if (passwordValidationError) {
      return res.status(400).json({
        message: passwordValidationError,
      });
    }

    const hashedPassword = await bcrypt.hash(rawPassword, 10);
    const nextTbPasswordEncrypted = encryptSecret(rawPassword);

    if (user.tb_user_id) {
      if (!user.tb_password_encrypted) {
        return res.status(500).json({
          message: "ThingsBoard password sync data is missing for this account.",
        });
      }

      const currentTbPassword = decryptSecret(user.tb_password_encrypted);
      const adminToken = await tbLogin();
      const userTokenData = await tbGetUserToken(adminToken, user.tb_user_id);
      const userToken = userTokenData.token;

      await tbChangeCurrentUserPassword(
        userToken,
        currentTbPassword,
        rawPassword
      );
    }

    await pool.query(
      `UPDATE users
      SET password = $1,
          password_reset_token_hash = NULL,
          password_reset_expires_at = NULL,
          tb_password_encrypted = $3
      WHERE id = $2`,
      [hashedPassword, user.id, nextTbPasswordEncrypted]
    );

    return res.status(200).json({
      message: "Password updated successfully.",
    });
  } catch (error) {
    console.error("PASSWORD RESET CONFIRM ERROR:", {
      message: error.message,
      stack: error.stack,
    });

    const normalizedErrorMessage = String(error.message || "");

    if (normalizedErrorMessage.includes("WRITE") && normalizedErrorMessage.includes("PROFILE")) {
      return res.status(403).json({
        message: "ThingsBoard user does not have permission to change its password yet. Assign a role with Profile Write permission to this customer user in ThingsBoard Cloud first.",
      });
    }

    return res.status(500).json({
      message: error.message || "Something went wrong while updating your password. Please try again.",
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
    });
  }
});

const startServer = async () => {
  try {
    assertRequiredConfig();
    await ensureUsersTableExists();
    await ensureUsersTableSchema();

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("STARTUP ERROR:", error);
    process.exit(1);
  }
};

startServer();