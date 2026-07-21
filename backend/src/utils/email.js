import nodemailer from "nodemailer";
import { env } from "../config/env.js";

const emailDeliveryTimeoutMs = Number(
  process.env.EMAIL_DELIVERY_TIMEOUT_MS || 15000,
);

const requiredSmtpEnvVars = [
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
  "EMAIL_FROM",
];

let transporter = null;

function getMissingSmtpEnvVars() {
  return requiredSmtpEnvVars.filter((name) => !String(process.env[name] || "").trim());
}

export function hasSmtpConfiguration() {
  return getMissingSmtpEnvVars().length === 0;
}

function assertSmtpConfiguration() {
  const missing = getMissingSmtpEnvVars();
  if (missing.length) {
    throw new Error(
      `Missing required SMTP environment variable${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}`,
    );
  }
}

function getSmtpTransporter() {
  if (!transporter) {
    assertSmtpConfiguration();

    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
    });
  }

  return transporter;
}

export async function verifySmtpConnection() {
  return getSmtpTransporter().verify();
}

export async function sendEmail({ to, subject, html, text }) {
  const from = String(env.emailFrom || process.env.EMAIL_FROM || "").trim();
  const mail = { from, to, subject, html, text };

  if (!from) {
    throw new Error("Missing required SMTP environment variable: EMAIL_FROM");
  }

  const smtpTransporter = getSmtpTransporter();

  return Promise.race([
    smtpTransporter.sendMail(mail),
    new Promise((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(
              `Email delivery timed out after ${emailDeliveryTimeoutMs}ms`,
            ),
          ),
        emailDeliveryTimeoutMs,
      ),
    ),
  ]);
}
