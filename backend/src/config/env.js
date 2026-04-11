import dotenv from "dotenv";

dotenv.config();

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

  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",

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

  ticketHoldMinutes: Number(process.env.TICKET_HOLD_MINUTES || 8),
};

export default env;
