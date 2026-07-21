import { BrevoClient } from "@getbrevo/brevo";
import { env } from "../config/env.js";

let brevoClient = null;

function getMissingEmailEnvVars() {
  const missing = [];

  if (!String(env.brevoApiKey || process.env.BREVO_API_KEY || "").trim()) {
    missing.push("BREVO_API_KEY");
  }

  if (!String(env.emailFrom || process.env.EMAIL_FROM || "").trim()) {
    missing.push("EMAIL_FROM");
  }

  return missing;
}

export function hasBrevoConfiguration() {
  return getMissingEmailEnvVars().length === 0;
}

function assertBrevoConfiguration() {
  const missing = getMissingEmailEnvVars();
  if (missing.length) {
    throw new Error(
      `Missing required Brevo environment variable${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}`,
    );
  }
}

function parseSenderFromEmailFrom(value = "") {
  const trimmedValue = String(value || "").trim();
  if (!trimmedValue) {
    throw new Error("Missing required Brevo environment variable: EMAIL_FROM");
  }

  const angleMatch = trimmedValue.match(/^(.*)<([^<>]+)>$/);
  if (angleMatch) {
    const name = String(angleMatch[1] || "")
      .trim()
      .replace(/^"|"$/g, "");
    const email = String(angleMatch[2] || "").trim();

    if (!email) {
      throw new Error("EMAIL_FROM must contain a valid sender email address");
    }

    return name ? { email, name } : { email };
  }

  return { email: trimmedValue };
}

function normalizeRecipient(to) {
  if (typeof to === "string") {
    const email = String(to || "").trim();
    if (!email) {
      throw new Error("Recipient email is required");
    }

    return { email };
  }

  if (to && typeof to === "object") {
    const email = String(to.email || "").trim();
    if (!email) {
      throw new Error("Recipient email is required");
    }

    const name = String(to.name || "").trim();
    return name ? { email, name } : { email };
  }

  throw new Error("Recipient email is required");
}

function getBrevoClient() {
  if (brevoClient) {
    return brevoClient;
  }

  assertBrevoConfiguration();

  brevoClient = new BrevoClient({
    apiKey: String(env.brevoApiKey || process.env.BREVO_API_KEY || "").trim(),
  });

  return brevoClient;
}

function getBrevoErrorDetails(error) {
  const rawHeaders = error?.rawResponse?.headers;
  const requestId =
    error?.requestId ||
    rawHeaders?.get?.("x-request-id") ||
    rawHeaders?.get?.("X-Request-Id") ||
    undefined;

  return {
    statusCode: error?.statusCode,
    message: error?.message,
    body: error?.body,
    code: error?.code,
    requestId,
  };
}

function logBrevoError(context, error) {
  console.error(context, getBrevoErrorDetails(error));

  if (error?.stack) {
    console.error(error.stack);
  }
}

function createSendEmailError(error) {
  const statusCode = error?.statusCode;
  const message = statusCode
    ? `Brevo email request failed with status ${statusCode}`
    : error?.message || "Brevo email request failed";

  const wrappedError = new Error(message);
  wrappedError.name = "BrevoEmailError";
  wrappedError.statusCode = statusCode;
  wrappedError.code = error?.code;
  wrappedError.body = error?.body;
  wrappedError.requestId = error?.requestId;
  wrappedError.cause = error;

  return wrappedError;
}

export async function sendEmail({ to, subject, html, text }) {
  const trimmedSubject = String(subject || "").trim();
  if (!trimmedSubject) {
    throw new Error("Email subject is required");
  }

  const sender = parseSenderFromEmailFrom(
    env.emailFrom || process.env.EMAIL_FROM,
  );
  const recipient = normalizeRecipient(to);
  const payload = {
    sender,
    subject: trimmedSubject,
    to: [recipient],
  };

  if (html) {
    payload.htmlContent = html;
  }

  if (text) {
    payload.textContent = text;
  }

  try {
    const response =
      await getBrevoClient().transactionalEmails.sendTransacEmail(payload);

    console.log("========== BREVO SUCCESS ==========");
    console.log(response);
    console.log("==================================");

    return response;
  } catch (error) {
    logBrevoError(`Failed to send email to ${recipient.email}:`, error);
    throw createSendEmailError(error);
  }
}
