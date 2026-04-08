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
const PDFDocument = require("pdfkit");
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

app.use(express.json({ limit: "10mb" }));

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

const IS_DEVELOPMENT = process.env.NODE_ENV !== "production";
const MAIL_REQUIRED = process.env.MAIL_REQUIRED === "true";

const AVINYA_EMAIL_LOGO_CANDIDATES = [
  path.join(__dirname, "Front-End", "src", "Pictures", "Avinya.png"),
  path.join(__dirname, "../Front-End", "src", "Pictures", "Avinya.png"),
];

const AVINYA_EMAIL_LOGO_PATH =
  AVINYA_EMAIL_LOGO_CANDIDATES.find((candidate) => fs.existsSync(candidate)) || null;

const PROFILE_PICTURES_DIR = path.join(__dirname, "Profile Pictures");

fs.mkdirSync(PROFILE_PICTURES_DIR, { recursive: true });

app.use("/profile-pictures", express.static(PROFILE_PICTURES_DIR));

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

const getDeleteAccountPasswordValidationError = (value) => {
  if (!value) {
    return "Please enter your password.";
  }

  if (value !== value.trim()) {
    return "Password must not start or end with spaces.";
  }

  return "";
};

const getDeleteAccountConfirmPasswordValidationError = (password, confirmPassword) => {
  if (!confirmPassword) {
    return "Please confirm your password.";
  }

  if (password !== confirmPassword) {
    return "Passwords do not match.";
  }

  return "";
};

const PHONE_COUNTRY_CODE_REGEX = /^\+[1-9]\d{0,3}$/;
const ALLOWED_PROFILE_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024;

const getPhoneCountryCodeValidationError = (value) => {
  const normalizedValue = String(value || "").trim();

  if (!normalizedValue) {
    return "";
  }

  if (!PHONE_COUNTRY_CODE_REGEX.test(normalizedValue)) {
    return "Please select a valid country code.";
  }

  return "";
};

const getPhoneNumberValidationError = (value) => {
  const normalizedValue = String(value || "");

  if (!normalizedValue) {
    return "";
  }

  if (normalizedValue !== normalizedValue.trim()) {
    return "Phone number must not start or end with spaces.";
  }

  if (/\s/.test(normalizedValue)) {
    return "Phone number must not contain spaces.";
  }

  if (normalizedValue.includes("+")) {
    return "Enter your phone number without the country code.";
  }

  if (!/^\d+$/.test(normalizedValue)) {
    return "Phone number must contain numbers only.";
  }

  if (normalizedValue.startsWith("0")) {
    return "Phone number must not start with 0.";
  }

  if (normalizedValue.length < 7) {
    return "Phone number must be at least 7 digits.";
  }

  if (normalizedValue.length > 15) {
    return "Phone number must not exceed 15 digits.";
  }

  return "";
};

const getSafeProfilePictureBaseName = ({ firstName, lastName, email }) => {
  const composedName = [String(lastName || "").trim(), String(firstName || "").trim()]
    .filter(Boolean)
    .join(", ")
    .trim();

  const fallbackName = composedName || String(email || "").trim() || "User";

  return (
    fallbackName
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "")
      .replace(/\s+/g, " ")
      .trim() || "User"
  );
};

const getProfilePicturePublicPath = (fileName = "") =>
  fileName ? `/profile-pictures/${encodeURIComponent(fileName)}` : "";

const getStoredProfilePictureAbsolutePath = (storedUrl = "") => {
  const cleanStoredUrl = String(storedUrl || "").trim().split("?")[0];

  if (!cleanStoredUrl) {
    return "";
  }

  const rawFileName = cleanStoredUrl.split("/").pop() || "";
  const decodedFileName = decodeURIComponent(rawFileName);

  return path.join(PROFILE_PICTURES_DIR, decodedFileName);
};

const removeStoredProfilePicture = (storedUrl = "") => {
  const absolutePath = getStoredProfilePictureAbsolutePath(storedUrl);

  if (absolutePath && fs.existsSync(absolutePath)) {
    fs.unlinkSync(absolutePath);
  }
};

const saveProfilePictureFromDataUrl = ({
  profileImageDataUrl,
  firstName,
  lastName,
  email,
  previousProfilePictureUrl = "",
}) => {
  const matches = String(profileImageDataUrl || "").match(
    /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/i
  );

  if (!matches) {
    throw new Error("Please select a JPG, JPEG, PNG, or WEBP image.");
  }

  const mimeType = matches[1].toLowerCase();
  const base64Payload = matches[2];

  if (!ALLOWED_PROFILE_IMAGE_MIME_TYPES.has(mimeType)) {
    throw new Error("Please select a JPG, JPEG, PNG, or WEBP image.");
  }

  const imageBuffer = Buffer.from(base64Payload, "base64");

  if (imageBuffer.length > MAX_PROFILE_IMAGE_BYTES) {
    throw new Error("Profile image must be 5 MB or smaller.");
  }

  const fileExtension = mimeType === "image/jpeg" ? "jpg" : mimeType.split("/")[1];
  const nextFileName = `${getSafeProfilePictureBaseName({
    firstName,
    lastName,
    email,
  })}.${fileExtension}`;

  const nextAbsolutePath = path.join(PROFILE_PICTURES_DIR, nextFileName);

  removeStoredProfilePicture(previousProfilePictureUrl);
  fs.writeFileSync(nextAbsolutePath, imageBuffer);

  return getProfilePicturePublicPath(nextFileName);
};

const renameStoredProfilePictureIfNeeded = ({
  previousProfilePictureUrl = "",
  firstName,
  lastName,
  email,
}) => {
  const previousAbsolutePath = getStoredProfilePictureAbsolutePath(
    previousProfilePictureUrl
  );

  if (!previousAbsolutePath || !fs.existsSync(previousAbsolutePath)) {
    return "";
  }

  const existingExtension = path.extname(previousAbsolutePath) || ".jpg";
  const nextFileName = `${getSafeProfilePictureBaseName({
    firstName,
    lastName,
    email,
  })}${existingExtension}`;
  const nextAbsolutePath = path.join(PROFILE_PICTURES_DIR, nextFileName);

  if (previousAbsolutePath !== nextAbsolutePath) {
    if (fs.existsSync(nextAbsolutePath)) {
      fs.unlinkSync(nextAbsolutePath);
    }

    fs.renameSync(previousAbsolutePath, nextAbsolutePath);
  }

  return getProfilePicturePublicPath(nextFileName);
};

const mapUserRowToClientUser = (userRow) => ({
  id: userRow.id,
  firstName: userRow.first_name,
  lastName: userRow.last_name,
  email: userRow.email,
  isVerified: userRow.is_verified,
  phoneCountryCode: userRow.phone_country_code || "+63",
  phoneNumber: userRow.phone_number || "",
  roleLabel: userRow.role_label || "User",
  profilePictureUrl: userRow.profile_picture_url || "",
});

const USERS_SORT_SQL = {
  newest: "created_at DESC, id DESC",
  oldest: "created_at ASC, id ASC",
  last_name_asc: "LOWER(last_name) ASC, LOWER(first_name) ASC, id ASC",
  last_name_desc: "LOWER(last_name) DESC, LOWER(first_name) DESC, id DESC",
  first_name_asc: "LOWER(first_name) ASC, LOWER(last_name) ASC, id ASC",
  first_name_desc: "LOWER(first_name) DESC, LOWER(last_name) DESC, id DESC",
  email_asc: "LOWER(email) ASC, id ASC",
  email_desc: "LOWER(email) DESC, id DESC",
};

const USERS_EXPORT_MAX_ROWS = 1000;

const USERS_PDF_SORT_LABELS = {
  newest: "Newest",
  oldest: "Oldest",
  last_name_asc: "Last Name A-Z",
  last_name_desc: "Last Name Z-A",
  first_name_asc: "First Name A-Z",
  first_name_desc: "First Name Z-A",
  email_asc: "Email A-Z",
  email_desc: "Email Z-A",
};

const getUsersRouteFilters = (source = {}) => {
  const search = typeof source.search === "string" ? source.search.trim() : "";
  const escapedSearch = search.replace(/[\\%_]/g, "\\$&");
  const status =
    typeof source.status === "string" ? source.status.trim().toLowerCase() : "all";
  const countryCode =
    typeof source.countryCode === "string" ? source.countryCode.trim() : "all";
  const photo =
    typeof source.photo === "string" ? source.photo.trim().toLowerCase() : "all";
  const sortBy =
    typeof source.sortBy === "string" ? source.sortBy.trim().toLowerCase() : "newest";

  return {
    search,
    escapedSearch,
    status: ["all", "verified", "not_verified"].includes(status) ? status : "all",
    countryCode: countryCode || "all",
    photo: ["all", "with_photo", "without_photo"].includes(photo) ? photo : "all",
    sortBy: USERS_SORT_SQL[sortBy] ? sortBy : "newest",
  };
};

const buildUsersListWhereClause = (filters) => {
  const params = ["User"];
  const whereParts = [`role_label = $1`];
  let nextParamIndex = 2;

  if (filters.escapedSearch) {
    params.push(`%${filters.escapedSearch}%`);
    whereParts.push(`(
      first_name ILIKE $${nextParamIndex} ESCAPE '\\'
      OR last_name ILIKE $${nextParamIndex} ESCAPE '\\'
      OR email ILIKE $${nextParamIndex} ESCAPE '\\'
      OR COALESCE(phone_country_code, '') ILIKE $${nextParamIndex} ESCAPE '\\'
      OR COALESCE(phone_number, '') ILIKE $${nextParamIndex} ESCAPE '\\'
      OR CONCAT_WS(' ', first_name, last_name) ILIKE $${nextParamIndex} ESCAPE '\\'
      OR CONCAT_WS(', ', last_name, first_name) ILIKE $${nextParamIndex} ESCAPE '\\'
      OR CASE WHEN is_verified THEN 'Verified' ELSE 'Not Verified' END ILIKE $${nextParamIndex} ESCAPE '\\'
    )`);
    nextParamIndex += 1;
  }

  if (filters.status === "verified") {
    whereParts.push("is_verified = TRUE");
  } else if (filters.status === "not_verified") {
    whereParts.push("is_verified = FALSE");
  }

  if (filters.countryCode !== "all") {
    params.push(filters.countryCode);
    whereParts.push(
      `COALESCE(NULLIF(TRIM(phone_country_code), ''), '+63') = $${nextParamIndex}`
    );
    nextParamIndex += 1;
  }

  if (filters.photo === "with_photo") {
    whereParts.push(`COALESCE(NULLIF(TRIM(profile_picture_url), ''), '') <> ''`);
  } else if (filters.photo === "without_photo") {
    whereParts.push(`COALESCE(NULLIF(TRIM(profile_picture_url), ''), '') = ''`);
  }

  return {
    params,
    whereSql: `WHERE ${whereParts.join("\n       AND ")}`,
  };
};

const getUsersSortSql = (sortBy = "newest") =>
  USERS_SORT_SQL[sortBy] || USERS_SORT_SQL.newest;

const getUsersPdfFilterSummaryText = (filters, totalCount) =>
  [
    `Search: ${filters.search || "All users"}`,
    `Status: ${
      filters.status === "verified"
        ? "Verified"
        : filters.status === "not_verified"
        ? "Not Verified"
        : "All"
    }`,
    `Country Code: ${filters.countryCode !== "all" ? filters.countryCode : "All"}`,
    `Photo: ${
      filters.photo === "with_photo"
        ? "With Photo"
        : filters.photo === "without_photo"
        ? "Without Photo"
        : "All"
    }`,
    `Sort: ${USERS_PDF_SORT_LABELS[filters.sortBy] || "Newest"}`,
    `Rows: ${totalCount}`,
  ].join(" | ");

const getUsersPdfReadableDate = (date = new Date()) =>
  new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);

const getUsersPdfReadableTime = (date = new Date()) =>
  new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(date);

const getUsersPdfGeneratedOnText = (date = new Date()) =>
  `Generated on ${getUsersPdfReadableDate(date)} at ${getUsersPdfReadableTime(date)}`;

const getUsersPdfFontFamily = () => ({
  regular: "Helvetica",
  semibold: "Helvetica-Bold",
});

const getUsersPdfFileName = (date = new Date()) =>
  `Avinya Users - ${getUsersPdfReadableDate(date)}.pdf`;

const createUsersPdfBuffer = ({ rows, filters, generatedAt = new Date() }) =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margin: 32,
      info: {
        Title: "Avinya Users Report",
        Author: "Avinya",
      },
    });

    const chunks = [];
    const pdfFonts = getUsersPdfFontFamily();
    const columns = [
      { key: "no", label: "No.", width: 34, align: "center" },
      { key: "photo", label: "Photo", width: 60, align: "center" },
      { key: "last_name", label: "Last Name", width: 92, align: "center" },
      { key: "first_name", label: "First Name", width: 92, align: "center" },
      { key: "email", label: "Email", width: 230, align: "center" },
      { key: "phone_country_code", label: "Country Code", width: 92, align: "center" },
      { key: "phone_number", label: "Phone Number", width: 92, align: "center" },
      { key: "status", label: "Status", width: 78, align: "center" },
    ];
    const rowHeight = 24;
    const pageLeft = doc.page.margins.left;
    const pageTop = doc.page.margins.top;
    const getPageBottom = () => doc.page.height - doc.page.margins.bottom;

    const drawCellText = (
      text,
      x,
      y,
      width,
      align = "center",
      color = "#1f1f1f",
      font = pdfFonts.regular
    ) => {
      doc
        .font(font)
        .fontSize(9)
        .fillColor(color)
        .text(String(text ?? "—"), x + 6, y + 7, {
          width: width - 12,
          align,
          lineBreak: false,
          ellipsis: true,
        });
    };

    const drawTableHeader = (y) => {
      let x = pageLeft;

      columns.forEach((column) => {
        doc.rect(x, y, column.width, rowHeight).fillAndStroke("#980000", "#dddddd");
        drawCellText(column.label, x, y, column.width, "center", "#ffffff", pdfFonts.semibold);
        x += column.width;
      });
    };

    const drawTableRow = (row, y, rowIndex) => {
      let x = pageLeft;

      columns.forEach((column) => {
        const backgroundColor = rowIndex % 2 === 0 ? "#ffffff" : "#faf7f7";

        doc.rect(x, y, column.width, rowHeight).fillAndStroke(backgroundColor, "#ececec");

        const cellValue =
          column.key === "no"
            ? rowIndex + 1
            : column.key === "status"
            ? row.is_verified
              ? "Verified"
              : "Not Verified"
            : column.key === "photo"
            ? row.profile_picture_url
              ? "Yes"
              : "No"
            : column.key === "phone_country_code"
            ? row.phone_country_code || "+63"
            : column.key === "phone_number"
            ? row.phone_number || "N/A"
            : row[column.key] || "—";

        drawCellText(
          cellValue,
          x,
          y,
          column.width,
          column.align || "center",
          column.key === "status" && row.is_verified ? "#980000" : "#1f1f1f",
          column.key === "status" ? pdfFonts.semibold : pdfFonts.regular
        );

        x += column.width;
      });
    };

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc
      .font(pdfFonts.semibold)
      .fontSize(20)
      .fillColor("#1f1f1f")
      .text("Users Report", pageLeft, pageTop);

    doc
      .font(pdfFonts.regular)
      .fontSize(10)
      .fillColor("#6b6b6b")
      .text(getUsersPdfGeneratedOnText(generatedAt), pageLeft, pageTop + 28);

    doc
      .font(pdfFonts.regular)
      .fontSize(9)
      .fillColor("#6b6b6b")
      .text(getUsersPdfFilterSummaryText(filters, rows.length), pageLeft, pageTop + 48, {
        width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
        lineGap: 3,
      });

    let currentY = pageTop + 92;
    drawTableHeader(currentY);
    currentY += rowHeight;

    rows.forEach((row, rowIndex) => {
      if (currentY + rowHeight > getPageBottom()) {
        doc.addPage({
          size: "A4",
          layout: "landscape",
          margin: 32,
        });

        currentY = doc.page.margins.top;
        drawTableHeader(currentY);
        currentY += rowHeight;
      }

      drawTableRow(row, currentY, rowIndex);
      currentY += rowHeight;
    });

    if (rows.length === 0) {
      doc
        .font(pdfFonts.regular)
        .fontSize(10)
        .fillColor("#6b6b6b")
        .text("No matching users found for the selected filters.", pageLeft, currentY + 16);
    }

    doc.end();
  });

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
      role_label VARCHAR(30) NOT NULL DEFAULT 'User'
        CHECK (role_label IN ('Administrator', 'User')),
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
    ADD COLUMN IF NOT EXISTS role_label VARCHAR(30) NOT NULL DEFAULT 'User';
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
    ALTER TABLE users
    DROP COLUMN IF EXISTS pending_password_encrypted;
  `);

  await pool.query(`
    ALTER TABLE users
    DROP COLUMN IF EXISTS tb_password_encrypted;
  `);

  await pool.query(`
    ALTER TABLE users
    DROP COLUMN IF EXISTS tb_customer_id;
  `);

  await pool.query(`
    ALTER TABLE users
    DROP COLUMN IF EXISTS tb_user_id;
  `);

  await pool.query(`
    ALTER TABLE users
    DROP CONSTRAINT IF EXISTS users_role_label_check;
  `);

  await pool.query(`
    ALTER TABLE users
    ADD CONSTRAINT users_role_label_check
    CHECK (role_label IN ('Administrator', 'User'));
  `);

  await pool.query(`
    ALTER TABLE users
    ALTER COLUMN role_label SET DEFAULT 'User';
  `);

  await pool.query(`
    UPDATE users
    SET role_label = CASE
      WHEN role_label = 'Tenant Administrator' THEN 'Administrator'
      WHEN role_label = 'Customer Administrator' THEN 'User'
      WHEN role_label = 'Administrator' THEN 'Administrator'
      WHEN role_label = 'User' THEN 'User'
      WHEN LOWER(email) = 'tbd.avinya@gmail.com' THEN 'Administrator'
      ELSE 'User'
    END
    WHERE role_label IS NULL
       OR role_label NOT IN ('Administrator', 'User')
       OR role_label IN ('Tenant Administrator', 'Customer Administrator');
  `);
};

const authenticateToken = (req, res, next) => {
  const authorizationHeader =
    req.headers.authorization || req.headers["x-authorization"] || "";

  const token = String(authorizationHeader)
    .replace(/^Bearer\s+/i, "")
    .trim();

  if (!token) {
    return res.status(401).json({
      message: "Authentication required.",
    });
  }

  try {
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);

    req.user = {
      id: decodedToken.id,
      email: decodedToken.email,
    };

    return next();
  } catch {
    return res.status(401).json({
      message: "Invalid or expired session. Please log in again.",
    });
  }
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

app.get("/account/me", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         id,
         first_name,
         last_name,
         email,
         is_verified,
         phone_country_code,
         phone_number,
         role_label,
         profile_picture_url
       FROM users
       WHERE id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "User account not found.",
      });
    }

    return res.status(200).json({
      user: mapUserRowToClientUser(result.rows[0]),
    });
  } catch (error) {
    console.error("ACCOUNT ME ERROR:", error);
    return res.status(500).json({
      message: "Unable to load your account details right now.",
    });
  }
});

app.put("/account/profile", authenticateToken, async (req, res) => {
  const client = await pool.connect();

  try {
    const trimmedFirstName =
      typeof req.body.firstName === "string" ? req.body.firstName.trim() : "";
    const trimmedLastName =
      typeof req.body.lastName === "string" ? req.body.lastName.trim() : "";
    const trimmedEmail = normalizeEmail(
      typeof req.body.email === "string" ? req.body.email : ""
    );
    const trimmedPhoneCountryCode =
      typeof req.body.phoneCountryCode === "string"
        ? req.body.phoneCountryCode.trim()
        : "+63";
    const trimmedPhoneNumber =
      typeof req.body.phoneNumber === "string" ? req.body.phoneNumber.trim() : "";
    const profileImageDataUrl =
      typeof req.body.profileImageDataUrl === "string"
        ? req.body.profileImageDataUrl.trim()
        : "";
    const removeProfileImage = req.body.removeProfileImage === true;

    const firstNameValidationError = getNameValidationError(
      trimmedFirstName,
      "First name"
    );
    const lastNameValidationError = getNameValidationError(
      trimmedLastName,
      "Last name"
    );
    const emailValidationError = getEmailValidationError(trimmedEmail);
    const phoneCountryCodeValidationError =
      getPhoneCountryCodeValidationError(trimmedPhoneCountryCode);
    const phoneNumberValidationError =
      getPhoneNumberValidationError(trimmedPhoneNumber);

    if (firstNameValidationError) {
      return res.status(400).json({ message: firstNameValidationError });
    }

    if (lastNameValidationError) {
      return res.status(400).json({ message: lastNameValidationError });
    }

    if (emailValidationError) {
      return res.status(400).json({ message: emailValidationError });
    }

    if (phoneCountryCodeValidationError) {
      return res.status(400).json({ message: phoneCountryCodeValidationError });
    }

    if (phoneNumberValidationError) {
      return res.status(400).json({ message: phoneNumberValidationError });
    }

    await client.query("BEGIN");

    const currentUserResult = await client.query(
      `SELECT
        id,
        email,
        is_verified,
        role_label,
        phone_country_code,
        phone_number,
        profile_picture_url
      FROM users
      WHERE id = $1
      FOR UPDATE`,
      [req.user.id]
    );

    if (currentUserResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        message: "User account not found.",
      });
    }

    const currentUser = currentUserResult.rows[0];

    const duplicateEmailResult = await client.query(
      `SELECT id
       FROM users
       WHERE email = $1
         AND id <> $2
       LIMIT 1`,
      [trimmedEmail, currentUser.id]
    );

    if (duplicateEmailResult.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        message: "This email address is already registered.",
      });
    }

    let nextProfilePictureUrl = currentUser.profile_picture_url || "";

    if (removeProfileImage) {
      removeStoredProfilePicture(currentUser.profile_picture_url);
      nextProfilePictureUrl = "";
    } else if (profileImageDataUrl) {
      nextProfilePictureUrl = saveProfilePictureFromDataUrl({
        profileImageDataUrl,
        firstName: trimmedFirstName,
        lastName: trimmedLastName,
        email: trimmedEmail,
        previousProfilePictureUrl: currentUser.profile_picture_url,
      });
    } else if (currentUser.profile_picture_url) {
      nextProfilePictureUrl =
        renameStoredProfilePictureIfNeeded({
          previousProfilePictureUrl: currentUser.profile_picture_url,
          firstName: trimmedFirstName,
          lastName: trimmedLastName,
          email: trimmedEmail,
        }) || "";
    }

    const updatedUserResult = await client.query(
      `UPDATE users
       SET first_name = $1,
           last_name = $2,
           email = $3,
           phone_country_code = $4,
           phone_number = $5,
           profile_picture_url = NULLIF($6, '')
       WHERE id = $7
       RETURNING
         id,
         first_name,
         last_name,
         email,
         is_verified,
         phone_country_code,
         phone_number,
         role_label,
         profile_picture_url`,
      [
        trimmedFirstName,
        trimmedLastName,
        trimmedEmail,
        trimmedPhoneCountryCode,
        trimmedPhoneNumber,
        nextProfilePictureUrl,
        currentUser.id,
      ]
    );

    await client.query("COMMIT");

    return res.status(200).json({
      message: "Your account details have been saved successfully.",
      user: mapUserRowToClientUser(updatedUserResult.rows[0]),
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("ACCOUNT PROFILE SAVE ERROR:", error);

    return res.status(500).json({
      message:
        error.message ||
        "Something went wrong while saving your account details. Please try again.",
    });
  } finally {
    client.release();
  }
});

app.delete("/account", authenticateToken, async (req, res) => {
  const client = await pool.connect();

  try {
    const rawPassword = typeof req.body.password === "string" ? req.body.password : "";
    const rawConfirmPassword =
      typeof req.body.confirmPassword === "string" ? req.body.confirmPassword : "";

    const passwordValidationError =
      getDeleteAccountPasswordValidationError(rawPassword);
    const confirmPasswordValidationError =
      getDeleteAccountConfirmPasswordValidationError(
        rawPassword,
        rawConfirmPassword
      );

    if (passwordValidationError) {
      return res.status(400).json({
        message: passwordValidationError,
      });
    }

    if (confirmPasswordValidationError) {
      return res.status(400).json({
        message: confirmPasswordValidationError,
      });
    }

    const currentUserResult = await client.query(
      `SELECT
         id,
         email,
         password,
         profile_picture_url,
         role_label
       FROM users
       WHERE id = $1`,
      [req.user.id]
    );

    if (currentUserResult.rows.length === 0) {
      return res.status(404).json({
        message: "User account not found.",
      });
    }

    const currentUser = currentUserResult.rows[0];

    if (currentUser.role_label === "Administrator") {
      return res.status(403).json({
        message: "Administrator account cannot be deleted.",
      });
    }

    const isPasswordMatch = await bcrypt.compare(
      rawPassword,
      currentUser.password
    );

    if (!isPasswordMatch) {
      return res.status(400).json({
        message: "Invalid email or password. Please try again.",
      });
    }

    await client.query("BEGIN");

    await client.query(`DELETE FROM users WHERE id = $1`, [currentUser.id]);

    await client.query("COMMIT");

    if (currentUser.profile_picture_url) {
      try {
        removeStoredProfilePicture(currentUser.profile_picture_url);
      } catch (fileError) {
        console.error("ACCOUNT PROFILE PICTURE DELETE ERROR:", fileError);
      }
    }

    return res.status(200).json({
      message: "User account deleted successfully.",
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("ACCOUNT DELETE ERROR:", error);

    return res.status(500).json({
      message:
        error.message ||
        "Something went wrong while deleting your account. Please try again.",
    });
  } finally {
    client.release();
  }
});

app.get("/users", authenticateToken, async (req, res) => {
  try {
    const filters = getUsersRouteFilters(req.query);

    const requestedPage = Number.parseInt(String(req.query.page || ""), 10);
    const requestedLimit = Number.parseInt(String(req.query.limit || ""), 10);

    const safeLimit = Number.isInteger(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 15)
      : 15;

    const safeRequestedPage =
      Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;

    const { params: baseParams, whereSql } = buildUsersListWhereClause(filters);
    const sortSql = getUsersSortSql(filters.sortBy);

    const requestingUserResult = await pool.query(
      `SELECT role_label
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [req.user.id]
    );

    if (requestingUserResult.rows.length === 0) {
      return res.status(404).json({
        message: "User account not found.",
      });
    }

    if (requestingUserResult.rows[0].role_label !== "Administrator") {
      return res.status(403).json({
        message: "You are not authorized to view this page.",
      });
    }

    const totalCountResult = await pool.query(
      `SELECT COUNT(*)::int AS total_count
      FROM users
      ${whereSql}`,
      baseParams
    );

    const totalCount = Number(totalCountResult.rows[0]?.total_count || 0);
    const totalPages = Math.max(1, Math.ceil(totalCount / safeLimit));
    const currentPage = Math.min(safeRequestedPage, totalPages);
    const offset = (currentPage - 1) * safeLimit;

    const listParams = [...baseParams, safeLimit, offset];

    const result = await pool.query(
      `SELECT
        id,
        first_name,
        last_name,
        email,
        is_verified,
        phone_country_code,
        phone_number,
        role_label,
        profile_picture_url
      FROM users
      ${whereSql}
      ORDER BY ${sortSql}
      LIMIT $${baseParams.length + 1}
      OFFSET $${baseParams.length + 2}`,
      listParams
    );

    return res.status(200).json({
      users: result.rows.map(mapUserRowToClientUser),
      pagination: {
        page: currentPage,
        limit: safeLimit,
        totalCount,
        totalPages,
        search: filters.search,
        status: filters.status,
        countryCode: filters.countryCode,
        photo: filters.photo,
        sortBy: filters.sortBy,
        hasPreviousPage: currentPage > 1,
        hasNextPage: currentPage < totalPages,
      },
    });
  } catch (error) {
    console.error("USERS LIST ERROR:", error);

    return res.status(500).json({
      message: "Unable to load users right now.",
    });
  }
});

app.get("/users/export/pdf", authenticateToken, async (req, res) => {
  try {
    const requestingUserResult = await pool.query(
      `SELECT role_label
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [req.user.id]
    );

    if (requestingUserResult.rows.length === 0) {
      return res.status(404).json({
        message: "User account not found.",
      });
    }

    if (requestingUserResult.rows[0].role_label !== "Administrator") {
      return res.status(403).json({
        message: "You are not authorized to export this page.",
      });
    }

    const filters = getUsersRouteFilters(req.query);
    const { params, whereSql } = buildUsersListWhereClause(filters);
    const sortSql = getUsersSortSql(filters.sortBy);

    const result = await pool.query(
      `SELECT
         id,
         first_name,
         last_name,
         email,
         is_verified,
         phone_country_code,
         phone_number,
         profile_picture_url,
         created_at
       FROM users
       ${whereSql}
       ORDER BY ${sortSql}
       LIMIT ${USERS_EXPORT_MAX_ROWS}`,
      params
    );

    const exportGeneratedAt = new Date();

    const pdfBuffer = await createUsersPdfBuffer({
      rows: result.rows,
      filters,
      generatedAt: exportGeneratedAt,
    });

    const fileName = getUsersPdfFileName(exportGeneratedAt);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Length", pdfBuffer.length);
    res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);

    return res.status(200).send(pdfBuffer);
  } catch (error) {
    console.error("USERS EXPORT PDF ERROR:", error);

    return res.status(500).json({
      message: "Unable to generate the PDF file right now.",
    });
  }
});

app.put("/users/:userId", authenticateToken, async (req, res) => {
  const client = await pool.connect();

  try {
    const targetUserId = Number.parseInt(req.params.userId, 10);
    const trimmedFirstName =
      typeof req.body.firstName === "string" ? req.body.firstName.trim() : "";
    const trimmedLastName =
      typeof req.body.lastName === "string" ? req.body.lastName.trim() : "";
    const trimmedEmail = normalizeEmail(
      typeof req.body.email === "string" ? req.body.email : ""
    );
    const trimmedPhoneCountryCode =
      typeof req.body.phoneCountryCode === "string"
        ? req.body.phoneCountryCode.trim()
        : "+63";
    const trimmedPhoneNumber =
      typeof req.body.phoneNumber === "string" ? req.body.phoneNumber.trim() : "";

    if (!Number.isInteger(targetUserId) || targetUserId < 1) {
      return res.status(400).json({
        message: "Invalid user account.",
      });
    }

    const firstNameValidationError = getNameValidationError(trimmedFirstName, "First name");
    const lastNameValidationError = getNameValidationError(trimmedLastName, "Last name");
    const emailValidationError = getEmailValidationError(trimmedEmail);
    const phoneCountryCodeValidationError =
      getPhoneCountryCodeValidationError(trimmedPhoneCountryCode);
    const phoneNumberValidationError = getPhoneNumberValidationError(trimmedPhoneNumber);

    if (firstNameValidationError) {
      return res.status(400).json({ message: firstNameValidationError });
    }

    if (lastNameValidationError) {
      return res.status(400).json({ message: lastNameValidationError });
    }

    if (emailValidationError) {
      return res.status(400).json({ message: emailValidationError });
    }

    if (phoneCountryCodeValidationError) {
      return res.status(400).json({ message: phoneCountryCodeValidationError });
    }

    if (phoneNumberValidationError) {
      return res.status(400).json({ message: phoneNumberValidationError });
    }

    await client.query("BEGIN");

    const requestingUserResult = await client.query(
      `SELECT id, role_label
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [req.user.id]
    );

    if (requestingUserResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        message: "User account not found.",
      });
    }

    if (requestingUserResult.rows[0].role_label !== "Administrator") {
      await client.query("ROLLBACK");
      return res.status(403).json({
        message: "You are not authorized to edit this account.",
      });
    }

    const targetUserResult = await client.query(
      `SELECT
        id,
        email,
        is_verified,
        role_label,
        profile_picture_url
      FROM users
      WHERE id = $1
      FOR UPDATE`,
      [targetUserId]
    );

    if (targetUserResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        message: "User account not found.",
      });
    }

    const targetUser = targetUserResult.rows[0];

    if (targetUser.role_label !== "User") {
      await client.query("ROLLBACK");
      return res.status(403).json({
        message: "You can only edit user accounts.",
      });
    }

    const duplicateEmailResult = await client.query(
      `SELECT id
       FROM users
       WHERE email = $1
         AND id <> $2
       LIMIT 1`,
      [trimmedEmail, targetUser.id]
    );

    if (duplicateEmailResult.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        message: "This email address is already registered.",
      });
    }

    const nextProfilePictureUrl = targetUser.profile_picture_url
      ? renameStoredProfilePictureIfNeeded({
          previousProfilePictureUrl: targetUser.profile_picture_url,
          firstName: trimmedFirstName,
          lastName: trimmedLastName,
          email: trimmedEmail,
        }) || ""
      : "";

    const updatedUserResult = await client.query(
      `UPDATE users
       SET first_name = $1,
           last_name = $2,
           email = $3,
           phone_country_code = $4,
           phone_number = $5,
           profile_picture_url = NULLIF($6, '')
       WHERE id = $7
       RETURNING
         id,
         first_name,
         last_name,
         email,
         is_verified,
         phone_country_code,
         phone_number,
         role_label,
         profile_picture_url`,
      [
        trimmedFirstName,
        trimmedLastName,
        trimmedEmail,
        trimmedPhoneCountryCode,
        trimmedPhoneNumber,
        nextProfilePictureUrl,
        targetUser.id,
      ]
    );

    await client.query("COMMIT");

    return res.status(200).json({
      message: "User account updated successfully.",
      user: mapUserRowToClientUser(updatedUserResult.rows[0]),
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("USER UPDATE ERROR:", error);

    return res.status(500).json({
      message:
        error.message ||
        "Something went wrong while saving this account. Please try again.",
    });
  } finally {
    client.release();
  }
});

app.delete("/users/:userId", authenticateToken, async (req, res) => {
  const client = await pool.connect();

  try {
    const targetUserId = Number.parseInt(req.params.userId, 10);
    const rawPassword = typeof req.body.password === "string" ? req.body.password : "";
    const rawConfirmPassword =
      typeof req.body.confirmPassword === "string" ? req.body.confirmPassword : "";

    if (!Number.isInteger(targetUserId) || targetUserId < 1) {
      return res.status(400).json({
        message: "Invalid user account.",
      });
    }

    const passwordValidationError =
      getDeleteAccountPasswordValidationError(rawPassword);
    const confirmPasswordValidationError =
      getDeleteAccountConfirmPasswordValidationError(
        rawPassword,
        rawConfirmPassword
      );

    if (passwordValidationError) {
      return res.status(400).json({
        message: passwordValidationError,
      });
    }

    if (confirmPasswordValidationError) {
      return res.status(400).json({
        message: confirmPasswordValidationError,
      });
    }

    const requestingUserResult = await client.query(
      `SELECT id, email, password, role_label
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [req.user.id]
    );

    if (requestingUserResult.rows.length === 0) {
      return res.status(404).json({
        message: "User account not found.",
      });
    }

    const requestingUser = requestingUserResult.rows[0];

    if (requestingUser.role_label !== "Administrator") {
      return res.status(403).json({
        message: "You are not authorized to delete this account.",
      });
    }

    const isPasswordMatch = await bcrypt.compare(
      rawPassword,
      requestingUser.password
    );

    if (!isPasswordMatch) {
      return res.status(400).json({
        message: "Invalid email or password. Please try again.",
      });
    }

    const targetUserResult = await client.query(
       `SELECT
         id,
         email,
         profile_picture_url,
         role_label
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [targetUserId]
    );

    if (targetUserResult.rows.length === 0) {
      return res.status(404).json({
        message: "User account not found.",
      });
    }

    const targetUser = targetUserResult.rows[0];

    if (targetUser.role_label !== "User") {
      return res.status(403).json({
        message: "You can only delete user accounts.",
      });
    }

    await client.query("BEGIN");

    await client.query(`DELETE FROM users WHERE id = $1`, [targetUser.id]);

    await client.query("COMMIT");

    if (targetUser.profile_picture_url) {
      try {
        removeStoredProfilePicture(targetUser.profile_picture_url);
      } catch (fileError) {
        console.error("TENANT DELETE TARGET PROFILE PICTURE ERROR:", fileError);
      }
    }

    return res.status(200).json({
      message: "User account deleted successfully.",
      deletedUserId: targetUser.id,
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("USER DELETE ERROR:", error);

    return res.status(500).json({
      message:
        error.message ||
        "Something went wrong while deleting this account. Please try again.",
    });
  } finally {
    client.release();
  }
});

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
      `INSERT INTO users (
          first_name,
          last_name,
          email,
          password,
          otp_code,
          otp_expires_at,
          is_verified,
          role_label
        )
      VALUES ($1, $2, $3, $4, $5, $6, FALSE, $7)
      RETURNING id, first_name, last_name, email, is_verified, created_at`,
      [
        trimmedFirstName,
        trimmedLastName,
        trimmedEmail,
        hashedPassword,
        otpCode,
        otpExpiresAt,
        "User",
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
          otp_expires_at
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
    console.error("OTP VERIFY ERROR:", {
      message: error.message,
      stack: error.stack,
    });

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
    console.error("PASSWORD RESET CONFIRM ERROR:", {
      message: error.message,
      stack: error.stack,
    });

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
      `SELECT
         id,
         first_name,
         last_name,
         email,
         password,
         is_verified,
         phone_country_code,
         phone_number,
         role_label,
         profile_picture_url
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
      user: mapUserRowToClientUser(user),
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