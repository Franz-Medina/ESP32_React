const crypto = require("crypto");
const nodemailer = require("nodemailer");

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
      <h2>AVINYA OTP Verification</h2>
      <p>Hello ${displayName},</p>
      <p>Your code is:</p>
      <h1>${otpCode}</h1>
      <p>Expires in ${OTP_EXPIRY_SECONDS} seconds</p>
    `,
  });
};

module.exports = {
  normalizeEmail,
  generateOtpCode,
  getOtpExpiryDate,
  sendOtpEmail,
};