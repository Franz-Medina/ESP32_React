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

const TB_BASE_URL = String(
  process.env.TB_BASE_URL || "https://thingsboard.cloud"
).replace(/\/+$/, "");

const TB_TENANT_USERNAME = process.env.TB_TENANT_USERNAME || "";
const TB_TENANT_PASSWORD = process.env.TB_TENANT_PASSWORD || "";

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

const PDF_FONT_DIRECTORY_CANDIDATES = [
  path.join(__dirname, "assets", "fonts"),
  path.join(__dirname, "Assets", "Fonts"),
];

const PDF_SUPPORTED_FONT_SIGNATURES = new Set([
  "00010000",
  "4f54544f",
  "74727565",
]);

const getExistingPdfFontPath = (fileName = "") =>
  PDF_FONT_DIRECTORY_CANDIDATES
    .map((directoryPath) => path.join(directoryPath, fileName))
    .find((candidatePath) => fs.existsSync(candidatePath)) || "";

const isSupportedPdfFontFile = (fontPath = "") => {
  try {
    if (!fontPath || !fs.existsSync(fontPath)) {
      return false;
    }

    const fontSignature = fs
      .readFileSync(fontPath)
      .subarray(0, 4)
      .toString("hex")
      .toLowerCase();

    return PDF_SUPPORTED_FONT_SIGNATURES.has(fontSignature);
  } catch (error) {
    console.warn("[PDF FONT CHECK ERROR]", error);
    return false;
  }
};

const getPdfFontFamily = () => {
  const regularFontPath = getExistingPdfFontPath("Poppins-Regular.ttf");
  const semiboldFontPath = getExistingPdfFontPath("Poppins-SemiBold.ttf");

  return {
    regular: isSupportedPdfFontFile(regularFontPath)
      ? regularFontPath
      : "Helvetica",
    semibold: isSupportedPdfFontFile(semiboldFontPath)
      ? semiboldFontPath
      : "Helvetica-Bold",
  };
};

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

const MAX_DEVICES_PER_USER = 5;
const DEVICE_UID_REGEX = /^[A-Za-z0-9._:-]+$/;

const THINGSBOARD_DEVICE_ID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TB_TELEMETRY_KEYS_REGEX = /^[A-Za-z0-9_.,:-]+$/;
const TB_RPC_METHOD_REGEX = /^[A-Za-z0-9_:-]+$/;

let thingsBoardAuthCache = {
  token: "",
  expiresAt: 0,
};

const getThingsBoardAuthToken = async () => {
  if (
    thingsBoardAuthCache.token &&
    thingsBoardAuthCache.expiresAt > Date.now()
  ) {
    return thingsBoardAuthCache.token;
  }

  if (!TB_TENANT_USERNAME || !TB_TENANT_PASSWORD) {
    throw new Error("ThingsBoard tenant credentials are not configured.");
  }

  const response = await fetch(`${TB_BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username: TB_TENANT_USERNAME,
      password: TB_TENANT_PASSWORD,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.token) {
    throw new Error(data.message || "Unable to log in to ThingsBoard Cloud.");
  }

  thingsBoardAuthCache = {
    token: data.token,
    expiresAt: Date.now() + 10 * 60 * 1000,
  };

  return data.token;
};

const thingsBoardFetchJson = async (path, options = {}) => {
  const token = await getThingsBoardAuthToken();

  const response = await fetch(`${TB_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Authorization": `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || `ThingsBoard request failed with status ${response.status}.`);
  }

  return data;
};

const resolveThingsBoardDevice = async (deviceUid) => {
  const normalizedDeviceUid = String(deviceUid || "").trim();

  if (!normalizedDeviceUid) {
    throw new Error("Device ID cannot be empty.");
  }

  if (THINGSBOARD_DEVICE_ID_REGEX.test(normalizedDeviceUid)) {
    return {
      inputDeviceUid: normalizedDeviceUid,
      thingsboardDeviceId: normalizedDeviceUid,
    };
  }

  const device = await thingsBoardFetchJson(
    `/api/tenant/devices?deviceName=${encodeURIComponent(normalizedDeviceUid)}`
  );

  const resolvedDeviceId =
    typeof device?.id === "object" ? device.id.id : device?.id;

  if (!resolvedDeviceId) {
    throw new Error(
      `Device "${normalizedDeviceUid}" was not found in ThingsBoard Cloud.`
    );
  }

  return {
    inputDeviceUid: normalizedDeviceUid,
    thingsboardDeviceId: resolvedDeviceId,
  };
};

const getSafeThingsBoardQueryValue = (value = "") =>
  String(value || "").trim();

const getDeviceUidValidationError = (value) => {
  const normalizedValue = String(value || "").trim();

  if (!normalizedValue) {
    return "Device ID cannot be empty.";
  }

  if (normalizedValue.length > 64) {
    return "Device ID must not exceed 64 characters.";
  }

  if (!DEVICE_UID_REGEX.test(normalizedValue)) {
    return "Device ID may only contain letters, numbers, dots, underscores, colons, and hyphens.";
  }

  return "";
};

const getDeviceDescriptionValidationError = (value) => {
  const normalizedValue = String(value || "").trim();

  if (normalizedValue.length > 200) {
    return "Description must not exceed 200 characters.";
  }

  return "";
};

const mapDeviceRowToClientDevice = (deviceRow) => ({
  id: deviceRow.id,
  deviceUid: deviceRow.device_uid,
  thingsboardDeviceId: deviceRow.thingsboard_device_id || deviceRow.device_uid,
  description: deviceRow.description || "",
  createdAt: deviceRow.created_at,
  updatedAt: deviceRow.updated_at,
});

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

const getUsersPdfFontFamily = () => getPdfFontFamily();

const getUsersPdfFileName = (date = new Date()) =>
  `Avinya Users - ${getUsersPdfReadableDate(date)}.pdf`;

const LOG_ACTION_LABELS = {
  login: "Login",
  logout: "Logout",
  device_added: "Device Added",
  device_updated: "Device Updated",
  device_removed: "Device Removed",
};

const LOGS_EXPORT_MAX_ROWS = 1500;

const getLogsPdfReadableDate = (date = new Date()) =>
  new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);

const getLogsPdfReadableTime = (date = new Date()) =>
  new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(date);

const getLogsPdfGeneratedOnText = (date = new Date()) =>
  `Generated on ${getLogsPdfReadableDate(date)} at ${getLogsPdfReadableTime(date)}`;

const getLogsPdfFileName = (date = new Date()) =>
  `Avinya Logs - ${getLogsPdfReadableDate(date)}.pdf`;

const getLogsPdfTimestampText = (value) => {
  try {
    const date = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(date.getTime())) {
      return String(value || "");
    }

    const dateParts = new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }).formatToParts(date);

    const month = dateParts.find((part) => part.type === "month")?.value || "";
    const day = dateParts.find((part) => part.type === "day")?.value || "";
    const year = dateParts.find((part) => part.type === "year")?.value || "";

    const timePart = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    }).format(date);

    return `${month}, ${day}, ${year} | ${timePart}`;
  } catch {
    return String(value || "");
  }
};

const getLogsPdfFilterSummaryText = (filters, totalCount) =>
  [
    `Search: ${filters.search || "All logs"}`,
    `Action Type: ${
      filters.actionType === "all"
        ? "All Actions"
        : LOG_ACTION_LABELS[filters.actionType] || filters.actionType
    }`,
    `Role: ${filters.role === "all" ? "All Roles" : filters.role}`,
    `Sort: ${filters.sortBy === "oldest" ? "Oldest" : "Newest"}`,
    `Rows: ${totalCount}`,
  ].join(" | ");

const LOG_ACTION_TYPES = {
  LOGIN: "login",
  LOGOUT: "logout",
  DEVICE_ADDED: "device_added",
  DEVICE_UPDATED: "device_updated",
  DEVICE_REMOVED: "device_removed",
};

const LOG_ACTION_TYPE_VALUES = Object.values(LOG_ACTION_TYPES);

const LOGS_SORT_SQL = {
  newest: "created_at DESC, id DESC",
  oldest: "created_at ASC, id ASC",
};

const getSafeLogActorName = (userRow = {}) =>
  [String(userRow.first_name || "").trim(), String(userRow.last_name || "").trim()]
    .filter(Boolean)
    .join(" ")
    .trim() || String(userRow.email || "").trim() || "User";

const buildLogDetails = ({ actionType, deviceId = "" }) => {
  switch (actionType) {
    case LOG_ACTION_TYPES.LOGIN:
      return "User logged in successfully";
    case LOG_ACTION_TYPES.LOGOUT:
      return "User logged out";
    case LOG_ACTION_TYPES.DEVICE_ADDED:
      return `Device ID "${deviceId}" was added`;
    case LOG_ACTION_TYPES.DEVICE_UPDATED:
      return `Device ID "${deviceId}" was updated`;
    case LOG_ACTION_TYPES.DEVICE_REMOVED:
      return `Device ID "${deviceId}" was removed`;
    default:
      return "";
  }
};

const toClientLogTimestamp = (value) => {
  if (!value) {
    return "";
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  const rawValue = String(value).trim();

  if (!rawValue) {
    return "";
  }

  const hasTimezone = /(?:Z|[+\-]\d{2}(?::?\d{2})?)$/i.test(rawValue);
  const normalizedValue = hasTimezone
    ? rawValue.replace(" ", "T")
    : `${rawValue.replace(" ", "T")}Z`;

  const parsedValue = new Date(normalizedValue);

  return Number.isNaN(parsedValue.getTime())
    ? rawValue
    : parsedValue.toISOString();
};

const mapLogRowToClientLog = (logRow) => ({
  id: logRow.id,
  type: logRow.action_type,
  actorName: logRow.actor_name,
  actorEmail: logRow.actor_email || "",
  actorRole: logRow.actor_role || "User",
  detail: logRow.details || "",
  deviceId: logRow.device_id || "",
  timestamp: toClientLogTimestamp(logRow.created_at),
});

const getLogsRouteFilters = (source = {}) => {
  const actionType =
    typeof source.actionType === "string" ? source.actionType.trim().toLowerCase() : "all";
  const role =
    typeof source.role === "string" ? source.role.trim() : "all";
  const sortBy =
    typeof source.sortBy === "string" ? source.sortBy.trim().toLowerCase() : "newest";
  const search =
    typeof source.search === "string" ? source.search.trim() : "";
  const escapedSearch = search.replace(/[\\%_]/g, "\\$&");

  return {
    actionType:
      actionType === "all" || LOG_ACTION_TYPE_VALUES.includes(actionType)
        ? actionType
        : "all",
    role: role === "all" || role === "Administrator" || role === "User" ? role : "all",
    sortBy: LOGS_SORT_SQL[sortBy] ? sortBy : "newest",
    search,
    escapedSearch,
  };
};

const buildLogsListWhereClause = (filters) => {
  const params = [];
  const whereParts = [];
  let nextParamIndex = 1;

  if (filters.actionType !== "all") {
    params.push(filters.actionType);
    whereParts.push(`action_type = $${nextParamIndex}`);
    nextParamIndex += 1;
  }

  if (filters.role !== "all") {
    params.push(filters.role);
    whereParts.push(`actor_role = $${nextParamIndex}`);
    nextParamIndex += 1;
  }

  if (filters.escapedSearch) {
    params.push(`%${filters.escapedSearch}%`);
    whereParts.push(`(
      actor_name ILIKE $${nextParamIndex} ESCAPE '\\'
      OR actor_email ILIKE $${nextParamIndex} ESCAPE '\\'
      OR actor_role ILIKE $${nextParamIndex} ESCAPE '\\'
      OR details ILIKE $${nextParamIndex} ESCAPE '\\'
      OR COALESCE(device_id, '') ILIKE $${nextParamIndex} ESCAPE '\\'
      OR COALESCE(device_description, '') ILIKE $${nextParamIndex} ESCAPE '\\'
      OR CASE
        WHEN action_type = 'login' THEN 'Login'
        WHEN action_type = 'logout' THEN 'Logout'
        WHEN action_type = 'device_added' THEN 'Device Added'
        WHEN action_type = 'device_removed' THEN 'Device Removed'
        ELSE action_type
      END ILIKE $${nextParamIndex} ESCAPE '\\'
    )`);
    nextParamIndex += 1;
  }

  return {
    params,
    whereSql: whereParts.length > 0 ? `WHERE ${whereParts.join("\n        AND ")}` : "",
  };
};

const insertActivityLog = async ({
  actionType,
  actorUserId = null,
  actorName = "",
  actorEmail = "",
  actorRole = "User",
  details = "",
  deviceId = "",
  deviceDescription = "",
  client = pool,
}) => {
  const result = await client.query(
    `INSERT INTO logs (
      action_type,
      actor_user_id,
      actor_name,
      actor_email,
      actor_role,
      details,
      device_id,
      device_description
    )
    VALUES ($1, $2, $3, $4, $5, $6, NULLIF($7, ''), NULLIF($8, ''))
    RETURNING
      id,
      action_type,
      actor_name,
      actor_email,
      actor_role,
      details,
      device_id,
      created_at`,
    [
      actionType,
      actorUserId,
      actorName,
      actorEmail,
      actorRole,
      details,
      deviceId,
      deviceDescription,
    ]
  );

  return result.rows[0];
};

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

const createLogsPdfBuffer = ({ rows, filters, generatedAt = new Date() }) =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margin: 32,
      info: {
        Title: "Avinya Logs Report",
        Author: "Avinya",
      },
    });

    const chunks = [];
    const pdfFonts = getPdfFontFamily();
    const columns = [
      { key: "no", label: "No.", width: 34, align: "center" },
      { key: "action", label: "Action", width: 96, align: "center" },
      { key: "actor", label: "Performed By", width: 210, align: "center" },
      { key: "role", label: "Role", width: 110, align: "center" },
      { key: "details", label: "Details", width: 270, align: "center" },
      { key: "timestamp", label: "Timestamp", width: 176, align: "center" },
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

        let cellValue = "—";
        let cellColor = "#1f1f1f";
        let cellFont = pdfFonts.regular;

        if (column.key === "no") {
          cellValue = rowIndex + 1;
        } else if (column.key === "action") {
          cellValue = LOG_ACTION_LABELS[row.action_type] || row.action_type || "—";
        } else if (column.key === "actor") {
          cellValue = row.actor_email
            ? `${row.actor_name || "User"} (${row.actor_email})`
            : row.actor_name || "User";
          cellFont = pdfFonts.semibold;
        } else if (column.key === "role") {
          cellValue = row.actor_role || "User";
          cellColor = "#6b6b6b";
        } else if (column.key === "details") {
          cellValue = row.details || "—";
        } else if (column.key === "timestamp") {
          cellValue = getLogsPdfTimestampText(row.created_at);
          cellColor = "#6b6b6b";
        }

        drawCellText(cellValue, x, y, column.width, column.align, cellColor, cellFont);
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
      .text("Logs Report", pageLeft, pageTop);

    doc
      .font(pdfFonts.regular)
      .fontSize(10)
      .fillColor("#6b6b6b")
      .text(getLogsPdfGeneratedOnText(generatedAt), pageLeft, pageTop + 28);

    doc
      .font(pdfFonts.regular)
      .fontSize(9)
      .fillColor("#6b6b6b")
      .text(getLogsPdfFilterSummaryText(filters, rows.length), pageLeft, pageTop + 48, {
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
        .text("No matching logs found for the selected filters.", pageLeft, currentY + 16);
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

const ensureLogsTableExists = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS logs (
      id SERIAL PRIMARY KEY,
      action_type VARCHAR(30) NOT NULL
        CHECK (action_type IN ('login', 'logout', 'device_added', 'device_updated', 'device_removed')),
      actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      actor_name VARCHAR(201) NOT NULL,
      actor_email VARCHAR(255) NOT NULL DEFAULT '',
      actor_role VARCHAR(30) NOT NULL
        CHECK (actor_role IN ('Administrator', 'User')),
      details TEXT NOT NULL DEFAULT '',
      device_id VARCHAR(64),
      device_description VARCHAR(200),
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
};

const ensureLogsTableSchema = async () => {
  await pool.query(`
    ALTER TABLE logs
    ADD COLUMN IF NOT EXISTS actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
  `);

  await pool.query(`
    ALTER TABLE logs
    ADD COLUMN IF NOT EXISTS actor_name VARCHAR(201) NOT NULL DEFAULT 'User';
  `);

  await pool.query(`
    ALTER TABLE logs
    ADD COLUMN IF NOT EXISTS actor_email VARCHAR(255) NOT NULL DEFAULT '';
  `);

  await pool.query(`
    ALTER TABLE logs
    ADD COLUMN IF NOT EXISTS actor_role VARCHAR(30) NOT NULL DEFAULT 'User';
  `);

  await pool.query(`
    ALTER TABLE logs
    ADD COLUMN IF NOT EXISTS details TEXT NOT NULL DEFAULT '';
  `);

  await pool.query(`
    ALTER TABLE logs
    ADD COLUMN IF NOT EXISTS device_id VARCHAR(64);
  `);

  await pool.query(`
    ALTER TABLE logs
    ADD COLUMN IF NOT EXISTS device_description VARCHAR(200);
  `);

  await pool.query(`
    ALTER TABLE logs
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'logs'
          AND column_name = 'created_at'
          AND data_type = 'timestamp without time zone'
      ) THEN
        ALTER TABLE logs
        ALTER COLUMN created_at TYPE TIMESTAMPTZ
        USING created_at AT TIME ZONE 'UTC';
      END IF;
    END $$;
  `);

  await pool.query(`
    UPDATE logs
    SET created_at = CURRENT_TIMESTAMP
    WHERE created_at IS NULL;
  `);

  await pool.query(`
    ALTER TABLE logs
    ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;
  `);

  await pool.query(`
    ALTER TABLE logs
    ALTER COLUMN created_at SET NOT NULL;
  `);

  await pool.query(`
    ALTER TABLE logs
    DROP CONSTRAINT IF EXISTS logs_action_type_check;
  `);

  await pool.query(`
    ALTER TABLE logs
    ADD CONSTRAINT logs_action_type_check
    CHECK (action_type IN ('login', 'logout', 'device_added', 'device_updated', 'device_removed'));
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs (created_at DESC);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_logs_action_type ON logs (action_type);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_logs_actor_role ON logs (actor_role);
  `);
};

const ensureDevicesTableExists = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS devices (
      id SERIAL PRIMARY KEY,
      owner_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      device_uid VARCHAR(64) NOT NULL,
      thingsboard_device_id VARCHAR(64),
      description VARCHAR(200) NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
};

const ensureDevicesTableSchema = async () => {
  await pool.query(`
    ALTER TABLE devices
    ADD COLUMN IF NOT EXISTS owner_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
  `);

  await pool.query(`
    ALTER TABLE devices
    ADD COLUMN IF NOT EXISTS device_uid VARCHAR(64);
  `);

  await pool.query(`
    ALTER TABLE devices
    ADD COLUMN IF NOT EXISTS thingsboard_device_id VARCHAR(64);
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'devices'
          AND column_name = 'device_id'
      ) THEN
        EXECUTE '
          UPDATE devices
          SET device_uid = COALESCE(NULLIF(device_uid, ''''), NULLIF(device_id, ''''))
          WHERE device_uid IS NULL OR TRIM(device_uid) = ''''
        ';

        EXECUTE 'ALTER TABLE devices ALTER COLUMN device_id DROP NOT NULL';
        EXECUTE 'ALTER TABLE devices DROP COLUMN device_id';
      END IF;
    END $$;
  `);

  await pool.query(`
    UPDATE devices
    SET device_uid = CONCAT('legacy-device-', id)
    WHERE device_uid IS NULL OR TRIM(device_uid) = '';
  `);

  await pool.query(`
    UPDATE devices
    SET thingsboard_device_id = device_uid
    WHERE thingsboard_device_id IS NULL OR TRIM(thingsboard_device_id) = '';
  `);

  await pool.query(`
    ALTER TABLE devices
    ALTER COLUMN device_uid SET NOT NULL;
  `);

  await pool.query(`
    ALTER TABLE devices
    ADD COLUMN IF NOT EXISTS description VARCHAR(200) NOT NULL DEFAULT '';
  `);

  await pool.query(`
    ALTER TABLE devices
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
  `);

  await pool.query(`
    ALTER TABLE devices
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_devices_owner_device_uid_unique
    ON devices (owner_user_id, LOWER(device_uid));
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_devices_owner_user_id
    ON devices (owner_user_id);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_devices_created_at
    ON devices (created_at DESC);
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

app.get("/devices", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        id,
        device_uid,
        thingsboard_device_id,
        description,
        created_at,
        updated_at
      FROM devices
       WHERE owner_user_id = $1
       ORDER BY created_at ASC, id ASC`,
      [req.user.id]
    );

    return res.status(200).json({
      devices: result.rows.map(mapDeviceRowToClientDevice),
      limit: MAX_DEVICES_PER_USER,
    });
  } catch (error) {
    console.error("DEVICES LIST ERROR:", error);

    return res.status(500).json({
      message: "Unable to load devices right now.",
    });
  }
});

app.post("/devices", authenticateToken, async (req, res) => {
  const client = await pool.connect();

  try {
    const deviceUid =
      typeof req.body.deviceUid === "string" ? req.body.deviceUid.trim() : "";
    const description =
      typeof req.body.description === "string" ? req.body.description.trim() : "";

    const deviceUidValidationError = getDeviceUidValidationError(deviceUid);
    const descriptionValidationError = getDeviceDescriptionValidationError(description);

    if (deviceUidValidationError) {
      return res.status(400).json({ message: deviceUidValidationError });
    }

    if (descriptionValidationError) {
      return res.status(400).json({ message: descriptionValidationError });
    }

    let resolvedDevice;

    try {
      resolvedDevice = await resolveThingsBoardDevice(deviceUid);
    } catch (thingsBoardError) {
      return res.status(400).json({
        message:
          thingsBoardError.message ||
          "Unable to verify this device in ThingsBoard Cloud.",
      });
    }

    await client.query("BEGIN");

    const actorResult = await client.query(
      `SELECT id, first_name, last_name, email, role_label
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [req.user.id]
    );

    if (actorResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        message: "User account not found.",
      });
    }

    const countResult = await client.query(
      `SELECT COUNT(*)::int AS total_count
       FROM devices
       WHERE owner_user_id = $1`,
      [req.user.id]
    );

    const totalDevices = Number(countResult.rows[0]?.total_count || 0);

    if (totalDevices >= MAX_DEVICES_PER_USER) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: `You can only add up to ${MAX_DEVICES_PER_USER} devices.`,
      });
    }

    const duplicateResult = await client.query(
      `SELECT id
      FROM devices
      WHERE owner_user_id = $1
        AND (
          LOWER(device_uid) = LOWER($2)
          OR LOWER(COALESCE(thingsboard_device_id, '')) = LOWER($3)
        )
      LIMIT 1`,
      [req.user.id, deviceUid, resolvedDevice.thingsboardDeviceId]
    );

    if (duplicateResult.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        message: "This Device ID already exists.",
      });
    }

    const insertedDeviceResult = await client.query(
      `INSERT INTO devices (
        owner_user_id,
        device_uid,
        thingsboard_device_id,
        description
      )
      VALUES ($1, $2, $3, $4)
      RETURNING
        id,
        device_uid,
        thingsboard_device_id,
        description,
        created_at,
        updated_at`,
      [
        req.user.id,
        deviceUid,
        resolvedDevice.thingsboardDeviceId,
        description,
      ]
    );

    const actor = actorResult.rows[0];

    await insertActivityLog({
      actionType: LOG_ACTION_TYPES.DEVICE_ADDED,
      actorUserId: actor.id,
      actorName: getSafeLogActorName(actor),
      actorEmail: actor.email,
      actorRole: actor.role_label || "User",
      details: buildLogDetails({
        actionType: LOG_ACTION_TYPES.DEVICE_ADDED,
        deviceId: deviceUid,
      }),
      deviceId: deviceUid,
      deviceDescription: description,
      client,
    });

    await client.query("COMMIT");

    return res.status(201).json({
      message: "Device added successfully.",
      device: mapDeviceRowToClientDevice(insertedDeviceResult.rows[0]),
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("DEVICE CREATE ERROR:", error);

    if (error.code === "23505") {
      return res.status(409).json({
        message: "This Device ID already exists.",
      });
    }

    return res.status(500).json({
      message: error.message || "Unable to add device right now.",
    });
  } finally {
    client.release();
  }
});

app.put("/devices/:deviceId", authenticateToken, async (req, res) => {
  const client = await pool.connect();

  try {
    const targetDeviceId = Number.parseInt(req.params.deviceId, 10);
    const deviceUid =
      typeof req.body.deviceUid === "string" ? req.body.deviceUid.trim() : "";
    const description =
      typeof req.body.description === "string" ? req.body.description.trim() : "";

    if (!Number.isInteger(targetDeviceId) || targetDeviceId < 1) {
      return res.status(400).json({
        message: "Invalid device.",
      });
    }

    const deviceUidValidationError = getDeviceUidValidationError(deviceUid);
    const descriptionValidationError = getDeviceDescriptionValidationError(description);

    if (deviceUidValidationError) {
      return res.status(400).json({ message: deviceUidValidationError });
    }

    if (descriptionValidationError) {
      return res.status(400).json({ message: descriptionValidationError });
    }

    let resolvedDevice;

    try {
      resolvedDevice = await resolveThingsBoardDevice(deviceUid);
    } catch (thingsBoardError) {
      return res.status(400).json({
        message:
          thingsBoardError.message ||
          "Unable to verify this device in ThingsBoard Cloud.",
      });
    }

    await client.query("BEGIN");

    const actorResult = await client.query(
      `SELECT id, first_name, last_name, email, role_label
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [req.user.id]
    );

    if (actorResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        message: "User account not found.",
      });
    }

    const currentDeviceResult = await client.query(
      `SELECT
         id,
         device_uid,
         description
       FROM devices
       WHERE id = $1
         AND owner_user_id = $2
       FOR UPDATE`,
      [targetDeviceId, req.user.id]
    );

    if (currentDeviceResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        message: "Device not found.",
      });
    }

    const duplicateResult = await client.query(
      `SELECT id
      FROM devices
      WHERE owner_user_id = $1
        AND (
          LOWER(device_uid) = LOWER($2)
          OR LOWER(COALESCE(thingsboard_device_id, '')) = LOWER($3)
        )
        AND id <> $4
      LIMIT 1`,
      [
        req.user.id,
        deviceUid,
        resolvedDevice.thingsboardDeviceId,
        targetDeviceId,
      ]
    );

    if (duplicateResult.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        message: "This Device ID already exists.",
      });
    }

    const currentDevice = currentDeviceResult.rows[0];

    const updatedDeviceResult = await client.query(
      `UPDATE devices
      SET device_uid = $1,
          thingsboard_device_id = $2,
          description = $3,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
        AND owner_user_id = $5
      RETURNING
        id,
        device_uid,
        thingsboard_device_id,
        description,
        created_at,
        updated_at`,
      [
        deviceUid,
        resolvedDevice.thingsboardDeviceId,
        description,
        targetDeviceId,
        req.user.id,
      ]
    );

    const actor = actorResult.rows[0];
    const updateDetails =
      currentDevice.device_uid === deviceUid
        ? `Device ID "${deviceUid}" was updated`
        : `Device ID "${currentDevice.device_uid}" was updated to "${deviceUid}"`;

    await insertActivityLog({
      actionType: LOG_ACTION_TYPES.DEVICE_UPDATED,
      actorUserId: actor.id,
      actorName: getSafeLogActorName(actor),
      actorEmail: actor.email,
      actorRole: actor.role_label || "User",
      details: updateDetails,
      deviceId: deviceUid,
      deviceDescription: description,
      client,
    });

    await client.query("COMMIT");

    return res.status(200).json({
      message: "Device updated successfully.",
      device: mapDeviceRowToClientDevice(updatedDeviceResult.rows[0]),
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("DEVICE UPDATE ERROR:", error);

    if (error.code === "23505") {
      return res.status(409).json({
        message: "This Device ID already exists.",
      });
    }

    return res.status(500).json({
      message: error.message || "Unable to update device right now.",
    });
  } finally {
    client.release();
  }
});

app.delete("/devices/:deviceId", authenticateToken, async (req, res) => {
  const client = await pool.connect();

  try {
    const targetDeviceId = Number.parseInt(req.params.deviceId, 10);

    if (!Number.isInteger(targetDeviceId) || targetDeviceId < 1) {
      return res.status(400).json({
        message: "Invalid device.",
      });
    }

    await client.query("BEGIN");

    const actorResult = await client.query(
      `SELECT id, first_name, last_name, email, role_label
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [req.user.id]
    );

    if (actorResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        message: "User account not found.",
      });
    }

    const currentDeviceResult = await client.query(
      `SELECT
         id,
         device_uid,
         description
       FROM devices
       WHERE id = $1
         AND owner_user_id = $2
       FOR UPDATE`,
      [targetDeviceId, req.user.id]
    );

    if (currentDeviceResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        message: "Device not found.",
      });
    }

    const currentDevice = currentDeviceResult.rows[0];

    await client.query(
      `DELETE FROM devices
       WHERE id = $1
         AND owner_user_id = $2`,
      [targetDeviceId, req.user.id]
    );

    const actor = actorResult.rows[0];

    await insertActivityLog({
      actionType: LOG_ACTION_TYPES.DEVICE_REMOVED,
      actorUserId: actor.id,
      actorName: getSafeLogActorName(actor),
      actorEmail: actor.email,
      actorRole: actor.role_label || "User",
      details: buildLogDetails({
        actionType: LOG_ACTION_TYPES.DEVICE_REMOVED,
        deviceId: currentDevice.device_uid,
      }),
      deviceId: currentDevice.device_uid,
      deviceDescription: currentDevice.description,
      client,
    });

    await client.query("COMMIT");

    return res.status(200).json({
      message: "Device deleted successfully.",
      deletedDeviceId: targetDeviceId,
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("DEVICE DELETE ERROR:", error);

    return res.status(500).json({
      message: error.message || "Unable to delete device right now.",
    });
  } finally {
    client.release();
  }
});

app.get("/thingsboard/telemetry/latest", authenticateToken, async (req, res) => {
  try {
    const deviceId = getSafeThingsBoardQueryValue(req.query.deviceId);
    const keys = getSafeThingsBoardQueryValue(req.query.keys);

    if (!THINGSBOARD_DEVICE_ID_REGEX.test(deviceId)) {
      return res.status(400).json({
        message: "Invalid ThingsBoard device ID.",
      });
    }

    if (!keys || !TB_TELEMETRY_KEYS_REGEX.test(keys)) {
      return res.status(400).json({
        message: "Invalid telemetry keys.",
      });
    }

    const data = await thingsBoardFetchJson(
      `/api/plugins/telemetry/DEVICE/${encodeURIComponent(deviceId)}/values/timeseries?keys=${encodeURIComponent(keys)}&useLatestTs=true`
    );

    return res.status(200).json({ data });
  } catch (error) {
    console.error("THINGSBOARD LATEST TELEMETRY ERROR:", error);

    return res.status(500).json({
      message: error.message || "Unable to load ThingsBoard telemetry.",
    });
  }
});

app.get("/thingsboard/telemetry/history", authenticateToken, async (req, res) => {
  try {
    const deviceId = getSafeThingsBoardQueryValue(req.query.deviceId);
    const keys = getSafeThingsBoardQueryValue(req.query.keys);
    const startTs = Number(req.query.startTs);
    const endTs = Number(req.query.endTs);
    const limit = Number(req.query.limit || 50);

    if (!THINGSBOARD_DEVICE_ID_REGEX.test(deviceId)) {
      return res.status(400).json({
        message: "Invalid ThingsBoard device ID.",
      });
    }

    if (!keys || !TB_TELEMETRY_KEYS_REGEX.test(keys)) {
      return res.status(400).json({
        message: "Invalid telemetry keys.",
      });
    }

    if (!Number.isFinite(startTs) || !Number.isFinite(endTs)) {
      return res.status(400).json({
        message: "Invalid telemetry date range.",
      });
    }

    const safeLimit = Math.min(Math.max(Number.isFinite(limit) ? limit : 50, 1), 500);

    const data = await thingsBoardFetchJson(
      `/api/plugins/telemetry/DEVICE/${encodeURIComponent(deviceId)}/values/timeseries?keys=${encodeURIComponent(keys)}&startTs=${startTs}&endTs=${endTs}&limit=${safeLimit}`
    );

    return res.status(200).json({ data });
  } catch (error) {
    console.error("THINGSBOARD HISTORY TELEMETRY ERROR:", error);

    return res.status(500).json({
      message: error.message || "Unable to load ThingsBoard telemetry history.",
    });
  }
});

app.post("/thingsboard/rpc", authenticateToken, async (req, res) => {
  try {
    const deviceId = String(req.body.deviceId || "").trim();
    const method = String(req.body.method || "").trim();

    if (!THINGSBOARD_DEVICE_ID_REGEX.test(deviceId)) {
      return res.status(400).json({
        message: "Invalid ThingsBoard device ID.",
      });
    }

    if (!method || !TB_RPC_METHOD_REGEX.test(method)) {
      return res.status(400).json({
        message: "Invalid RPC method.",
      });
    }

    await thingsBoardFetchJson(
      `/api/plugins/rpc/oneway/${encodeURIComponent(deviceId)}`,
      {
        method: "POST",
        body: JSON.stringify({
          method,
          params: req.body.params,
        }),
      }
    );

    return res.status(200).json({
      message: "RPC command sent successfully.",
    });
  } catch (error) {
    console.error("THINGSBOARD RPC ERROR:", error);

    return res.status(500).json({
      message: error.message || "Unable to send ThingsBoard RPC command.",
    });
  }
});

app.get("/thingsboard/counts", authenticateToken, async (req, res) => {
  try {
    const [alarmData, entityData] = await Promise.all([
      thingsBoardFetchJson("/api/alarm/count?status=ACTIVE"),
      thingsBoardFetchJson("/api/tenant/entities?pageSize=1&page=0&textSearch="),
    ]);

    return res.status(200).json({
      alarmCount: Number(alarmData.count || 0),
      entityCount: Number(entityData.totalElements || 0),
    });
  } catch (error) {
    console.error("THINGSBOARD COUNTS ERROR:", error);

    return res.status(500).json({
      message: error.message || "Unable to load ThingsBoard counts.",
    });
  }
});

app.get("/thingsboard/entities", authenticateToken, async (req, res) => {
  try {
    const data = await thingsBoardFetchJson(
      "/api/tenant/entities?pageSize=50&page=0&sortProperty=createdTime&sortOrder=DESC"
    );

    return res.status(200).json({
      entities: Array.isArray(data.data) ? data.data : [],
    });
  } catch (error) {
    console.error("THINGSBOARD ENTITIES ERROR:", error);

    return res.status(500).json({
      message: error.message || "Unable to load ThingsBoard entities.",
    });
  }
});

app.get("/logs", authenticateToken, async (req, res) => {
  try {
    const requestingUserResult = await pool.query(
      `SELECT id, role_label
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
        message: "You are not authorized to view logs.",
      });
    }

    const filters = getLogsRouteFilters(req.query);

    const requestedPage = Number.parseInt(String(req.query.page || ""), 10);
    const requestedLimit = Number.parseInt(String(req.query.limit || ""), 10);

    const safeLimit = Number.isInteger(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 15)
      : 15;

    const safeRequestedPage =
      Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;

    const { params: baseParams, whereSql } = buildLogsListWhereClause(filters);
    const sortSql = LOGS_SORT_SQL[filters.sortBy] || LOGS_SORT_SQL.newest;

    const totalCountResult = await pool.query(
      `SELECT COUNT(*)::int AS total_count
       FROM logs
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
         action_type,
         actor_name,
         actor_email,
         actor_role,
         details,
         device_id,
         created_at
       FROM logs
       ${whereSql}
       ORDER BY ${sortSql}
       LIMIT $${baseParams.length + 1}
       OFFSET $${baseParams.length + 2}`,
      listParams
    );

    return res.status(200).json({
      logs: result.rows.map(mapLogRowToClientLog),
      pagination: {
        page: currentPage,
        limit: safeLimit,
        totalCount,
        totalPages,
        actionType: filters.actionType,
        role: filters.role,
        sortBy: filters.sortBy,
        search: filters.search,
        hasPreviousPage: currentPage > 1,
        hasNextPage: currentPage < totalPages,
      },
    });
  } catch (error) {
    console.error("LOGS LIST ERROR:", error);

    return res.status(500).json({
      message: "Unable to load logs right now.",
    });
  }
});

app.get("/logs/export/pdf", authenticateToken, async (req, res) => {
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
        message: "You are not authorized to export logs.",
      });
    }

    const filters = getLogsRouteFilters(req.query);
    const { params, whereSql } = buildLogsListWhereClause(filters);
    const sortSql = LOGS_SORT_SQL[filters.sortBy] || LOGS_SORT_SQL.newest;

    const result = await pool.query(
      `SELECT
         id,
         action_type,
         actor_name,
         actor_email,
         actor_role,
         details,
         device_id,
         created_at
       FROM logs
       ${whereSql}
       ORDER BY ${sortSql}
       LIMIT ${LOGS_EXPORT_MAX_ROWS}`,
      params
    );

    const exportGeneratedAt = new Date();

    const pdfBuffer = await createLogsPdfBuffer({
      rows: result.rows,
      filters,
      generatedAt: exportGeneratedAt,
    });

    const fileName = getLogsPdfFileName(exportGeneratedAt);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Length", pdfBuffer.length);
    res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);

    return res.status(200).send(pdfBuffer);
  } catch (error) {
    console.error("LOGS EXPORT PDF ERROR:", error);

    return res.status(500).json({
      message: "Unable to generate the PDF file right now.",
    });
  }
});

app.post("/logs", authenticateToken, async (req, res) => {
  try {
    const actionType =
      typeof req.body.actionType === "string" ? req.body.actionType.trim().toLowerCase() : "";
    const deviceId =
      typeof req.body.deviceId === "string" ? req.body.deviceId.trim() : "";
    const deviceDescription =
      typeof req.body.deviceDescription === "string" ? req.body.deviceDescription.trim() : "";

    if (!LOG_ACTION_TYPE_VALUES.includes(actionType)) {
      return res.status(400).json({
        message: "Invalid log action type.",
      });
    }

    if (
      (actionType === LOG_ACTION_TYPES.DEVICE_ADDED ||
        actionType === LOG_ACTION_TYPES.DEVICE_UPDATED ||
        actionType === LOG_ACTION_TYPES.DEVICE_REMOVED) &&
      !deviceId
    ) {
      return res.status(400).json({
        message: "Device ID is required for this log action.",
      });
    }

    if (deviceId.length > 64) {
      return res.status(400).json({
        message: "Device ID must not exceed 64 characters.",
      });
    }

    if (deviceDescription.length > 200) {
      return res.status(400).json({
        message: "Device description must not exceed 200 characters.",
      });
    }

    const userResult = await pool.query(
      `SELECT id, first_name, last_name, email, role_label
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        message: "User account not found.",
      });
    }

    const user = userResult.rows[0];

    const insertedLog = await insertActivityLog({
      actionType,
      actorUserId: user.id,
      actorName: getSafeLogActorName(user),
      actorEmail: user.email,
      actorRole: user.role_label || "User",
      details: buildLogDetails({ actionType, deviceId }),
      deviceId,
      deviceDescription,
    });

    return res.status(201).json({
      message: "Activity log saved successfully.",
      log: mapLogRowToClientLog(insertedLog),
    });
  } catch (error) {
    console.error("LOG CREATE ERROR:", error);

    return res.status(500).json({
      message: "Unable to save the activity log right now.",
    });
  }
});

app.delete("/logs", authenticateToken, async (req, res) => {
  try {
    const requestingUserResult = await pool.query(
      `SELECT id, role_label
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
        message: "You are not authorized to clear logs.",
      });
    }

    await pool.query(`TRUNCATE TABLE logs RESTART IDENTITY`);

    return res.status(200).json({
      message: "All logs cleared successfully.",
    });
  } catch (error) {
    console.error("LOGS CLEAR ERROR:", error);

    return res.status(500).json({
      message: "Unable to clear logs right now.",
    });
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

    try {
      await insertActivityLog({
        actionType: LOG_ACTION_TYPES.LOGIN,
        actorUserId: user.id,
        actorName: getSafeLogActorName(user),
        actorEmail: user.email,
        actorRole: user.role_label || "User",
        details: buildLogDetails({ actionType: LOG_ACTION_TYPES.LOGIN }),
      });
    } catch (logError) {
      console.error("LOGIN ACTIVITY LOG ERROR:", logError);
    }

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
    await ensureDevicesTableExists();
    await ensureDevicesTableSchema();
    await ensureLogsTableExists();
    await ensureLogsTableSchema();

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("STARTUP ERROR:", error);
    process.exit(1);
  }
};

startServer();