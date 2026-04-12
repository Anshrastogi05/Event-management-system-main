import dotenv from "dotenv";

dotenv.config();

function normalizeUrl(value = "") {
  return value.trim().replace(/\/+$/, "");
}

function parseClientUrls(...values) {
  const uniqueUrls = new Set();

  for (const value of values) {
    if (!value) continue;

    for (const entry of value.split(",")) {
      const normalizedEntry = normalizeUrl(entry);
      if (normalizedEntry) uniqueUrls.add(normalizedEntry);
    }
  }

  return [...uniqueUrls];
}

const defaultClientUrls = ["http://localhost:5173"];
const clientUrls = parseClientUrls(process.env.CLIENT_URLS, process.env.CLIENT_URL);
const allowedClientUrls = clientUrls.length ? clientUrls : defaultClientUrls;
const primaryClientUrl =
  normalizeUrl(process.env.CLIENT_URL) ||
  allowedClientUrls.find(
    (url) => !["localhost", "127.0.0.1"].some((host) => url.includes(host)),
  ) ||
  allowedClientUrls[0];

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is required");
}

if (!process.env.MONGO_URI) {
  throw new Error("MONGO_URI is required");
}

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 5050),

  mongoUri: process.env.MONGO_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",

  authOtpExpiresInMinutes: Number(
    process.env.AUTH_OTP_EXPIRES_IN_MINUTES || 10,
  ),
  authOtpSessionExpiresIn: process.env.AUTH_OTP_SESSION_EXPIRES_IN || "15m",

  clientUrl: primaryClientUrl,
  clientUrls: allowedClientUrls,

  passwordResetTokenTtlMinutes: Number(
    process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES || 30,
  ),

  smtpHost: process.env.SMTP_HOST,
  smtpPort: Number(process.env.SMTP_PORT || 587),
  smtpUser: process.env.SMTP_USER,
  smtpPass: process.env.SMTP_PASS,
  emailFrom: process.env.EMAIL_FROM,

  razorpayKeyId: process.env.RAZORPAY_KEY_ID,
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET,

  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME,
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY,
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET,
  cloudinaryFolder: process.env.CLOUDINARY_FOLDER || "event-manager",

  ticketHoldMinutes: Number(process.env.TICKET_HOLD_MINUTES || 8),
};

export function isAllowedClientOrigin(origin) {
  const normalizedOrigin = normalizeUrl(origin || "");
  return !normalizedOrigin || env.clientUrls.includes(normalizedOrigin);
}

export default env;
