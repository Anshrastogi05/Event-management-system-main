import nodemailer from "nodemailer";
import { env } from "../config/env.js";

const emailDeliveryTimeoutMs = Number(
  process.env.EMAIL_DELIVERY_TIMEOUT_MS || 15000,
);

const transporter = env.smtpHost
  ? nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpPort === 465,
      auth:
        env.smtpUser && env.smtpPass
          ? { user: env.smtpUser, pass: env.smtpPass }
          : undefined,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
    })
  : null;

export async function sendEmail({ to, subject, html, text }) {
  const from = env.emailFrom;
  const mail = { from, to, subject, html, text };

  if (!from) {
    throw new Error("EMAIL_FROM is not configured");
  }

  if (!transporter) {
    throw new Error("SMTP is not configured");
  }

  return Promise.race([
    transporter.sendMail(mail),
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
