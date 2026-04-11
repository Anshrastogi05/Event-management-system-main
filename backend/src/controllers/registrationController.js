import { randomBytes } from 'crypto';
import { createObjectCsvWriter } from 'csv-writer';
import path from 'path';
import Event from '../models/Event.js';
import Registration from '../models/Registration.js';
import { env } from '../config/env.js';
import { sendEmail } from '../utils/email.js';
import { generateQRCodeDataUrl } from '../utils/qrcode.js';
import {
  captureRazorpayPayment,
  createRazorpayOrder,
  fetchRazorpayPayment,
  verifyRazorpaySignature,
} from '../services/razorpay.js';

const ACTIVE_REGISTRATION_STATUSES = ['registered', 'attended'];

function formatEventDate(dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return 'To be announced';

  return date.toLocaleString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getBookingLabel(bookingType) {
  return bookingType === 'permanent' ? 'Permanent Booking' : 'Free Registration';
}

function normalizeCurrency(currency) {
  return (currency || 'INR').toUpperCase();
}

function getPermanentBookingPrice(event) {
  const value = Number(event?.permanentBookingPrice || 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function formatCurrency(amount, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: normalizeCurrency(currency),
    maximumFractionDigits: 2,
  }).format(amount || 0);
}

function generateBookingReference(bookingType) {
  const prefix = bookingType === 'permanent' ? 'BOOK' : 'FREE';
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`;
}

async function findManageableEvent(eventId, user) {
  const filter =
    user?.role === 'admin'
      ? { _id: eventId }
      : { _id: eventId, organizer: user?.id };

  return Event.findOne(filter);
}

function buildRegistrationEmail(user, event, registration) {
  const bookingLabel = getBookingLabel(registration?.bookingType || 'free');
  const bookingReference = registration?.bookingReference || 'Will be assigned at confirmation';
  const eventDate = formatEventDate(event.date);
  const eventLocation = event.location || 'To be announced';
  const eventUrl = `${env.clientUrl.replace(/\/$/, '')}/events/${event._id}`;
  const greetingName = user?.name || 'there';
  const paymentLine =
    registration?.bookingType === 'permanent'
      ? `Amount paid: ${formatCurrency(registration.amount, registration.currency)}`
      : 'Amount paid: No payment required';
  const paymentHtml =
    registration?.bookingType === 'permanent'
      ? `<div style="margin-bottom: 8px;"><strong>Amount paid:</strong> ${formatCurrency(registration.amount, registration.currency)}</div>`
      : `<div style="margin-bottom: 8px;"><strong>Amount paid:</strong> No payment required</div>`;

  return {
    subject: `Registration confirmed: ${event.title}`,
    text: [
      `Hi ${greetingName},`,
      '',
      `Your registration for "${event.title}" is confirmed.`,
      `Booking type: ${bookingLabel}`,
      `Reference: ${bookingReference}`,
      paymentLine,
      `Date: ${eventDate}`,
      `Location: ${eventLocation}`,
      `View event details: ${eventUrl}`,
      '',
      'We look forward to seeing you there.',
      '',
      'EventManager Team',
    ].join('\n'),
    html: `
      <div style="font-family: Arial, sans-serif; background: #f8fafc; padding: 24px; color: #0f172a;">
        <div style="max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 18px; padding: 32px; border: 1px solid #e2e8f0;">
          <div style="font-size: 12px; letter-spacing: 0.2em; text-transform: uppercase; color: #64748b; margin-bottom: 12px;">Registration Confirmed</div>
          <h1 style="margin: 0 0 12px; font-size: 28px; line-height: 1.2;">${event.title}</h1>
          <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6;">Hi ${greetingName}, your seat is confirmed. Your event registration has been completed successfully.</p>

          <div style="border-radius: 16px; background: #eff6ff; padding: 20px; margin-bottom: 20px;">
            <div style="margin-bottom: 8px;"><strong>Booking type:</strong> ${bookingLabel}</div>
            <div style="margin-bottom: 8px;"><strong>Reference:</strong> ${bookingReference}</div>
            ${paymentHtml}
            <div style="margin-bottom: 8px;"><strong>Date:</strong> ${eventDate}</div>
            <div style="margin-bottom: 8px;"><strong>Location:</strong> ${eventLocation}</div>
            <div><strong>Status:</strong> Registered</div>
          </div>

          <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6;">You can revisit the event page anytime for updates, directions, and your ticket details.</p>

          <a href="${eventUrl}" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 20px; border-radius: 999px; font-weight: 600;">
            Open Event Page
          </a>

          <p style="margin: 24px 0 0; font-size: 14px; color: #475569;">Thanks,<br />EventManager Team</p>
        </div>
      </div>
    `,
  };
}

async function finalizeRegistration({ registration, event, user }) {
  const payload = JSON.stringify({
    userId: registration.user,
    eventId: event._id,
    bookingType: registration.bookingType,
    bookingReference: registration.bookingReference,
    paidAt: registration.paidAt || null,
    at: Date.now(),
  });

  registration.status = 'registered';
  registration.qrCodeDataUrl = await generateQRCodeDataUrl(payload);
  await registration.save();

  try {
    if (user?.email) {
      const emailContent = buildRegistrationEmail(user, event, registration);
      await sendEmail({ to: user.email, ...emailContent });
    }
  } catch (emailErr) {
    console.error(`Failed to send registration email to ${user?.email}: ${emailErr.message}`);
  }
}

function serializeRegistration(registrationDoc) {
  const registration = registrationDoc.toObject ? registrationDoc.toObject() : registrationDoc;

  return {
    _id: registration._id,
    user: registration.user,
    event: registration.event,
    bookingType: registration.bookingType,
    bookingReference: registration.bookingReference,
    amount: registration.amount,
    currency: registration.currency,
    status: registration.status,
    paymentProvider: registration.paymentProvider,
    razorpayOrderId: registration.razorpayOrderId,
    razorpayPaymentId: registration.razorpayPaymentId,
    paidAt: registration.paidAt,
    qrCodeDataUrl: registration.qrCodeDataUrl,
    checkedInAt: registration.checkedInAt,
    createdAt: registration.createdAt,
  };
}

async function findEventForBooking(eventId) {
  const event = await Event.findById(eventId);
  if (!event || event.status !== 'approved') return null;
  return event;
}

export const registerForEvent = async (req, res) => {
  try {
    const event = await findEventForBooking(req.params.id);
    if (!event) return res.status(400).json({ message: 'Event not available' });

    const bookingType = req.body?.bookingType || 'free';
    if (!['free', 'permanent'].includes(bookingType)) {
      return res.status(400).json({ message: 'Invalid booking type' });
    }

    if (bookingType === 'permanent') {
      return res.status(400).json({ message: 'Permanent booking requires payment. Start the Razorpay flow first.' });
    }

    const existingRegistration = await Registration.findOne({ user: req.user.id, event: event._id });
    if (existingRegistration && ACTIVE_REGISTRATION_STATUSES.includes(existingRegistration.status)) {
      return res.status(409).json({ message: 'You are already registered for this event' });
    }

    const registration =
      existingRegistration ||
      new Registration({
        user: req.user.id,
        event: event._id,
      });

    const previousBookingType = registration.bookingType;
    registration.bookingType = 'free';
    registration.bookingReference =
      !registration.bookingReference || previousBookingType !== 'free'
        ? generateBookingReference('free')
        : registration.bookingReference;
    registration.amount = 0;
    registration.currency = normalizeCurrency(event.currency);
    registration.paymentProvider = 'razorpay';
    registration.razorpayOrderId = undefined;
    registration.razorpayPaymentId = undefined;
    registration.razorpaySignature = undefined;
    registration.paidAt = undefined;

    await finalizeRegistration({
      registration,
      event,
      user: req.user,
    });

    res.status(201).json({ registration: serializeRegistration(registration) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const createRegistrationPaymentOrder = async (req, res) => {
  try {
    const event = await findEventForBooking(req.params.id);
    if (!event) return res.status(400).json({ message: 'Event not available' });

    const amount = getPermanentBookingPrice(event);
    if (!amount) {
      return res.status(400).json({ message: 'Permanent booking is not configured for this event.' });
    }

    const currency = normalizeCurrency(event.currency);
    const existingRegistration = await Registration.findOne({ user: req.user.id, event: event._id });
    if (existingRegistration && ACTIVE_REGISTRATION_STATUSES.includes(existingRegistration.status)) {
      return res.status(409).json({ message: 'You are already registered for this event' });
    }

    const registration =
      existingRegistration ||
      new Registration({
        user: req.user.id,
        event: event._id,
      });

    const previousBookingType = registration.bookingType;
    registration.bookingType = 'permanent';
    registration.bookingReference =
      !registration.bookingReference || previousBookingType !== 'permanent'
        ? generateBookingReference('permanent')
        : registration.bookingReference;
    registration.amount = amount;
    registration.currency = currency;
    registration.status = 'pending_payment';
    registration.paymentProvider = 'razorpay';
    registration.qrCodeDataUrl = undefined;
    registration.paidAt = undefined;
    registration.razorpayPaymentId = undefined;
    registration.razorpaySignature = undefined;

    const order = await createRazorpayOrder({
      amount: Math.round(amount * 100),
      currency,
      receipt: registration.bookingReference,
      notes: {
        registrationId: String(registration._id),
        bookingReference: registration.bookingReference,
        eventId: String(event._id),
        userId: String(req.user.id),
      },
    });

    registration.razorpayOrderId = order.id;
    await registration.save();

    res.json({
      keyId: env.razorpayKeyId,
      order,
      registration: serializeRegistration(registration),
    });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

export const verifyRegistrationPayment = async (req, res) => {
  try {
    const registration = await Registration.findOne({
      _id: req.params.registrationId,
      user: req.user.id,
    }).populate('event');

    if (!registration) return res.status(404).json({ message: 'Registration booking not found' });
    if (!registration.event || registration.event.status !== 'approved') {
      return res.status(400).json({ message: 'Event not available' });
    }
    if (ACTIVE_REGISTRATION_STATUSES.includes(registration.status)) {
      return res.status(400).json({ message: 'This booking has already been completed.' });
    }
    if (registration.bookingType !== 'permanent') {
      return res.status(400).json({ message: 'This registration does not require payment.' });
    }

    const orderId = req.body?.razorpay_order_id;
    const paymentId = req.body?.razorpay_payment_id;
    const signature = req.body?.razorpay_signature;

    if (!orderId || !paymentId || !signature) {
      return res.status(400).json({ message: 'Incomplete payment response' });
    }

    if (registration.razorpayOrderId !== orderId) {
      return res.status(400).json({ message: 'Payment order mismatch' });
    }

    if (!verifyRazorpaySignature({ orderId, paymentId, signature })) {
      return res.status(400).json({ message: 'Payment signature verification failed' });
    }

    let payment = await fetchRazorpayPayment(paymentId);
    if (payment.status === 'authorized' && !payment.captured) {
      payment = await captureRazorpayPayment(paymentId, payment.amount, payment.currency);
    }

    if (!['authorized', 'captured'].includes(payment.status)) {
      return res.status(400).json({ message: `Payment not completed. Current status: ${payment.status}` });
    }

    const expectedAmount = Math.round((registration.amount || 0) * 100);
    if (payment.amount !== expectedAmount || normalizeCurrency(payment.currency) !== normalizeCurrency(registration.currency)) {
      return res.status(400).json({ message: 'Payment amount verification failed' });
    }

    registration.razorpayPaymentId = paymentId;
    registration.razorpaySignature = signature;
    registration.paidAt = new Date();

    await finalizeRegistration({
      registration,
      event: registration.event,
      user: req.user,
    });

    res.json({
      registration: serializeRegistration(registration),
      payment,
    });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

export const myRegistrations = async (req, res) => {
  try {
    const regs = await Registration.find({
      user: req.user.id,
      status: { $ne: 'pending_payment' },
    }).populate('event');

    res.json({ registrations: regs.map((registration) => serializeRegistration(registration)) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const organizerEventAnalytics = async (req, res) => {
  try {
    const eventFilter =
      req.user.role === 'admin'
        ? {}
        : { organizer: req.user.id };

    const events = await Event.find(eventFilter)
      .sort({ date: 1 })
      .lean();

    if (!events.length) {
      return res.json({
        analytics: [],
        summary: {
          events: 0,
          participants: 0,
          attended: 0,
          registered: 0,
          free: 0,
          permanent: 0,
          revenue: 0,
        },
      });
    }

    const eventIds = events.map((event) => event._id);
    const registrations = await Registration.find({
      event: { $in: eventIds },
      status: { $in: ACTIVE_REGISTRATION_STATUSES },
    })
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    const registrationsByEvent = new Map();
    for (const registration of registrations) {
      const key = String(registration.event);
      const list = registrationsByEvent.get(key) || [];
      list.push(registration);
      registrationsByEvent.set(key, list);
    }

    const analytics = events.map((event) => {
      const eventRegistrations = registrationsByEvent.get(String(event._id)) || [];
      const attended = eventRegistrations.filter((registration) => registration.status === 'attended').length;
      const registered = eventRegistrations.filter((registration) => registration.status === 'registered').length;
      const permanent = eventRegistrations.filter((registration) => registration.bookingType === 'permanent');
      const free = eventRegistrations.filter((registration) => registration.bookingType !== 'permanent');
      const revenue = permanent.reduce((sum, registration) => sum + Number(registration.amount || 0), 0);
      const participants = eventRegistrations.map((registration) => ({
        _id: registration._id,
        user: registration.user,
        bookingType: registration.bookingType,
        bookingReference: registration.bookingReference,
        amount: registration.amount,
        currency: registration.currency,
        status: registration.status,
        createdAt: registration.createdAt,
        checkedInAt: registration.checkedInAt,
      }));
      const occupancyPercent = event.capacity
        ? Math.min(100, Math.round((participants.length / event.capacity) * 100))
        : 0;

      return {
        event,
        totals: {
          participants: participants.length,
          attended,
          registered,
          free: free.length,
          permanent: permanent.length,
          revenue,
          occupancyPercent,
          remainingCapacity: Math.max(0, Number(event.capacity || 0) - participants.length),
        },
        participants,
      };
    });

    const summary = analytics.reduce(
      (accumulator, item) => ({
        events: accumulator.events + 1,
        participants: accumulator.participants + item.totals.participants,
        attended: accumulator.attended + item.totals.attended,
        registered: accumulator.registered + item.totals.registered,
        free: accumulator.free + item.totals.free,
        permanent: accumulator.permanent + item.totals.permanent,
        revenue: accumulator.revenue + item.totals.revenue,
      }),
      {
        events: 0,
        participants: 0,
        attended: 0,
        registered: 0,
        free: 0,
        permanent: 0,
        revenue: 0,
      }
    );

    res.json({ analytics, summary });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const participantsForEvent = async (req, res) => {
  try {
    const event = await findManageableEvent(req.params.id, req.user);
    if (!event) return res.status(404).json({ message: 'Event not found' });

    const regs = await Registration.find({
      event: event._id,
      status: { $in: ACTIVE_REGISTRATION_STATUSES },
    }).populate('user', 'name email');

    res.json({ participants: regs.map((registration) => serializeRegistration(registration)) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const checkInParticipant = async (req, res) => {
  try {
    const event = await findManageableEvent(req.params.id, req.user);
    if (!event) return res.status(404).json({ message: 'Event not found' });

    const reg = await Registration.findOneAndUpdate(
      { user: req.body.userId, event: event._id, status: 'registered' },
      { status: 'attended', checkedInAt: new Date() },
      { new: true }
    );

    if (!reg) return res.status(404).json({ message: 'Registration not found' });
    res.json({ registration: serializeRegistration(reg) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const exportParticipantsCsv = async (req, res) => {
  try {
    const event = await findManageableEvent(req.params.id, req.user);
    if (!event) return res.status(404).json({ message: 'Event not found' });

    const regs = await Registration.find({
      event: event._id,
      status: { $in: ACTIVE_REGISTRATION_STATUSES },
    }).populate('user', 'name email');

    const rows = regs.map((registration) => ({
      name: registration.user?.name || '',
      email: registration.user?.email || '',
      bookingType: getBookingLabel(registration.bookingType || 'free'),
      bookingReference: registration.bookingReference || '',
      amount: registration.amount ? formatCurrency(registration.amount, registration.currency) : 'Free',
      status: registration.status,
      registeredAt: registration.createdAt,
    }));

    const filePath = path.join(process.cwd(), `participants-${req.params.id}.csv`);
    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: [
        { id: 'name', title: 'Name' },
        { id: 'email', title: 'Email' },
        { id: 'bookingType', title: 'Booking Type' },
        { id: 'bookingReference', title: 'Booking Reference' },
        { id: 'amount', title: 'Amount' },
        { id: 'status', title: 'Status' },
        { id: 'registeredAt', title: 'Registered At' },
      ],
    });

    await csvWriter.writeRecords(rows);
    res.download(filePath);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
