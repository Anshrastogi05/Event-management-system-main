import Movie from "../models/Movie.js";
import Show from "../models/Show.js";
import TicketBooking from '../models/TicketBooking.js';
import TicketSeatReservation from '../models/TicketSeatReservation.js';
import { env } from '../config/env.js';
import { ensureTicketShowsSeeded } from '../services/ticketCatalog.js';
import { captureRazorpayPayment, createRazorpayOrder, fetchRazorpayPayment, verifyRazorpaySignature } from '../services/razorpay.js';
import {
  broadcastTicketSeatState,
  buildSeatSnapshot,
  cancelActiveBookingsForUser,
  cleanupExpiredTicketHolds,
  findHydratedTicketShowById,
  generateTicketBookingReference,
  getTicketHoldDurationMs,
  hydrateTicketShows,
  listHydratedTicketShows,
  mapTicketShowSummary,
} from '../services/ticketing.js';
import { sendEmail } from '../utils/email.js';
import { storeUploadedImage } from '../utils/upload.js';

function formatBooking(bookingDoc, showDoc = null) {
  const booking = bookingDoc.toObject ? bookingDoc.toObject() : bookingDoc;
  const show = showDoc ? (showDoc.toObject ? showDoc.toObject() : showDoc) : booking.show;

  return {
    _id: booking._id,
    show,
    seats: booking.seats,
    amount: booking.amount,
    currency: booking.currency,
    status: booking.status,
    holdExpiresAt: booking.holdExpiresAt,
    bookingReference: booking.bookingReference,
    razorpayOrderId: booking.razorpayOrderId,
    razorpayPaymentId: booking.razorpayPaymentId,
    paidAt: booking.paidAt,
    createdAt: booking.createdAt,
  };
}

function buildTicketEmail(user, booking, show) {
  const seatList = booking.seats.map((seat) => `${seat.seatId} (${seat.section})`).join(', ');
  const formattedDate = new Date(show.date).toLocaleString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  const showUrl = `${env.clientUrl.replace(/\/$/, '')}/tickets/${show._id}`;

  return {
    subject: `Ticket confirmed: ${show.title}`,
    text: [
      `Hi ${user.name || 'there'},`,
      '',
      `Your ticket booking for ${show.title} is confirmed.`,
      `Booking reference: ${booking.bookingReference}`,
      `Seats: ${seatList}`,
      `Venue: ${show.venue}, ${show.city}`,
      `Date: ${formattedDate}`,
      `Amount paid: ${booking.currency} ${booking.amount}`,
      `View booking: ${showUrl}`,
      '',
      'Enjoy the show.',
      '',
      'EventManager Tickets',
    ].join('\n'),
    html: `
      <div style="font-family: Arial, sans-serif; background: #f8fafc; padding: 24px; color: #0f172a;">
        <div style="max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 18px; padding: 32px; border: 1px solid #e2e8f0;">
          <div style="font-size: 12px; letter-spacing: 0.2em; text-transform: uppercase; color: #64748b; margin-bottom: 12px;">Ticket Confirmed</div>
          <h1 style="margin: 0 0 12px; font-size: 28px; line-height: 1.2;">${show.title}</h1>
          <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6;">Hi ${user.name || 'there'}, your seats are confirmed and payment has been received.</p>

          <div style="border-radius: 16px; background: #eff6ff; padding: 20px; margin-bottom: 20px;">
            <div style="margin-bottom: 8px;"><strong>Reference:</strong> ${booking.bookingReference}</div>
            <div style="margin-bottom: 8px;"><strong>Seats:</strong> ${seatList}</div>
            <div style="margin-bottom: 8px;"><strong>Venue:</strong> ${show.venue}, ${show.city}</div>
            <div style="margin-bottom: 8px;"><strong>Date:</strong> ${formattedDate}</div>
            <div><strong>Amount:</strong> ${booking.currency} ${booking.amount}</div>
          </div>

          <a href="${showUrl}" style="display: inline-block; background: #0f172a; color: #ffffff; text-decoration: none; padding: 12px 20px; border-radius: 999px; font-weight: 600;">
            View Ticket Booking
          </a>
        </div>
      </div>
    `,
  };
}

function normalizeCurrency(currency) {
  return (currency || 'INR').toUpperCase();
}

async function getShowWithReservations(showId) {
  const show = await findHydratedTicketShowById(showId);
  if (!show) return null;

  await cleanupExpiredTicketHolds(showId);
  const reservations = await TicketSeatReservation.find({ show: showId });
  return { show, reservations };
}

export const listTicketShows = async (req, res) => {
  try {
    await ensureTicketShowsSeeded();
    await cleanupExpiredTicketHolds();

    const start = req.query.day ? new Date(req.query.day) : null;
    const end =
      start && !Number.isNaN(start.getTime())
        ? new Date(start.getTime() + 24 * 60 * 60 * 1000)
        : null;
    const queryText = String(req.query.q || "").trim().toLowerCase();
    const titleFilter = String(req.query.title || "").trim().toLowerCase();
    const cityFilter = String(req.query.city || "").trim().toLowerCase();
    const venueFilter = String(req.query.venue || "").trim().toLowerCase();

    const allShows = await listHydratedTicketShows();
    const shows = allShows.filter((show) => {
      if (req.query.type && req.query.type !== "movie") return false;
      if (titleFilter && show.title?.toLowerCase() !== titleFilter) return false;
      if (cityFilter && show.city?.toLowerCase() !== cityFilter) return false;
      if (venueFilter && show.venue?.toLowerCase() !== venueFilter) return false;

      if (start && end && !Number.isNaN(start.getTime())) {
        const showTime = new Date(show.date).getTime();
        if (showTime < start.getTime() || showTime >= end.getTime()) {
          return false;
        }
      }

      if (queryText) {
        const haystack = [show.title, show.venue, show.city]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(queryText)) return false;
      }

      return true;
    });

    const showIds = shows.map((show) => show._id);
    const reservations = await TicketSeatReservation.find({ show: { $in: showIds } }).lean();
    const reservationMap = new Map();

    for (const reservation of reservations) {
      const key = String(reservation.show);
      const list = reservationMap.get(key) || [];
      list.push(reservation);
      reservationMap.set(key, list);
    }

    const payload = shows.map((show) => {
      const seatSnapshot = buildSeatSnapshot(show, reservationMap.get(String(show._id)) || []);
      return mapTicketShowSummary(show, seatSnapshot.counters);
    });

    res.json({ shows: payload });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getTicketShow = async (req, res) => {
  try {
    await ensureTicketShowsSeeded();
    const result = await getShowWithReservations(req.params.id);
    if (!result) return res.status(404).json({ message: 'Ticket show not found' });

    const seatSnapshot = buildSeatSnapshot(result.show, result.reservations);
    res.json({
      show: mapTicketShowSummary(result.show, seatSnapshot.counters),
      seatSnapshot,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const updateTicketShowPoster = async (req, res) => {
  try {
    await ensureTicketShowsSeeded();

    if (!req.file) {
      return res.status(400).json({ message: 'Please upload an image file.' });
    }

    const sourceShow = await findHydratedTicketShowById(req.params.id);
    if (!sourceShow) {
      return res.status(404).json({ message: 'Ticket show not found' });
    }

    const uploadedPoster = await storeUploadedImage(req.file, {
      folder: 'ticket-shows',
    });
    const posterUrl = uploadedPoster?.url;
    await Movie.updateOne({ movie_id: sourceShow.movie_id }, { posterUrl });
    const updatedShow = await findHydratedTicketShowById(req.params.id);

    res.json({
      message: `Poster updated for ${sourceShow.title}.`,
      show: updatedShow,
      posterUrl,
    });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

export const myTicketBookings = async (req, res) => {
  try {
    await cleanupExpiredTicketHolds(req.query.showId || null);

    const filter = { user: req.user.id };
    if (req.query.showId) filter.show = req.query.showId;
    if (req.query.status) {
      const statuses = req.query.status.split(',').map((status) => status.trim()).filter(Boolean);
      if (statuses.length) filter.status = { $in: statuses };
    }

    const bookings = await TicketBooking.find(filter).sort({ createdAt: -1 });
    const showIds = [...new Set(bookings.map((booking) => String(booking.show)).filter(Boolean))];
    const shows = await Show.find({ _id: { $in: showIds } });
    const hydratedShows = await hydrateTicketShows(shows);
    const showsById = new Map(
      hydratedShows.map((show) => [
        String(show._id),
        mapTicketShowSummary(show, show.counters || { total: show.seats.length, available: 0, held: 0, booked: 0 }),
      ]),
    );

    res.json({
      bookings: bookings.map((booking) =>
        formatBooking(booking, showsById.get(String(booking.show))),
      ),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const holdTicketSeats = async (req, res) => {
  try {
    await ensureTicketShowsSeeded();
    const seatIds = [...new Set(Array.isArray(req.body?.seatIds) ? req.body.seatIds : [])];
    if (!seatIds.length) return res.status(400).json({ message: 'Select at least one seat' });

    const result = await getShowWithReservations(req.params.id);
    if (!result) return res.status(404).json({ message: 'Ticket show not found' });

    const selectedSeats = result.show.seats.filter((seat) => seatIds.includes(seat.seatId));
    if (selectedSeats.length !== seatIds.length) {
      return res.status(400).json({ message: 'One or more selected seats are invalid' });
    }

    const takenSeats = result.reservations.filter((reservation) => seatIds.includes(reservation.seatId));
    if (takenSeats.length) {
      return res.status(409).json({
        message: 'Some seats are no longer available',
        unavailableSeats: takenSeats.map((seat) => seat.seatId),
      });
    }

    await cancelActiveBookingsForUser(result.show._id, req.user.id);

    const holdExpiresAt = new Date(Date.now() + getTicketHoldDurationMs());
    const amount = selectedSeats.reduce((sum, seat) => sum + seat.price, 0);
    const bookingReference = generateTicketBookingReference();

    const booking = await TicketBooking.create({
      user: req.user.id,
      show: result.show._id,
      seats: selectedSeats,
      amount,
      currency: result.show.currency,
      status: 'held',
      holdExpiresAt,
      bookingReference,
    });

    try {
      await TicketSeatReservation.insertMany(
        selectedSeats.map((seat) => ({
          show: result.show._id,
          booking: booking._id,
          user: req.user.id,
          seatId: seat.seatId,
          row: seat.row,
          number: seat.number,
          section: seat.section,
          price: seat.price,
          status: 'held',
          holdExpiresAt,
        }))
      );
    } catch (error) {
      await TicketSeatReservation.deleteMany({ booking: booking._id });
      await TicketBooking.findByIdAndDelete(booking._id);

      if (error.code === 11000) {
        return res.status(409).json({ message: 'Some seats were just taken. Please choose again.' });
      }

      throw error;
    }

    await broadcastTicketSeatState(result.show._id);

    res.status(201).json({
      booking: formatBooking(booking, result.show),
      holdDurationMinutes: env.ticketHoldMinutes,
    });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

export const releaseTicketHold = async (req, res) => {
  try {
    const booking = await TicketBooking.findOne({ _id: req.params.id, user: req.user.id });
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.status === 'paid') return res.status(400).json({ message: 'Paid bookings cannot be released' });

    booking.status = 'cancelled';
    await booking.save();
    await TicketSeatReservation.deleteMany({ booking: booking._id, status: 'held' });
    await broadcastTicketSeatState(booking.show);

    res.json({ message: 'Seat hold released' });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

export const createTicketPaymentOrder = async (req, res) => {
  try {
    const booking = await TicketBooking.findOne({ _id: req.params.id, user: req.user.id });
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.status === 'paid') return res.status(400).json({ message: 'Booking is already paid' });
    if (!['held', 'pending_payment'].includes(booking.status)) {
      return res.status(400).json({ message: 'This booking is no longer active. Please select your seats again.' });
    }

    const show = await findHydratedTicketShowById(booking.show);
    if (!show) return res.status(404).json({ message: 'Ticket show not found' });

    if (booking.holdExpiresAt && booking.holdExpiresAt <= new Date()) {
      booking.status = 'expired';
      await booking.save();
      await TicketSeatReservation.deleteMany({ booking: booking._id, status: 'held' });
      await broadcastTicketSeatState(booking.show);
      return res.status(400).json({ message: 'Seat hold expired. Please choose seats again.' });
    }

    const order = await createRazorpayOrder({
      amount: Math.round(booking.amount * 100),
      currency: booking.currency,
      receipt: booking.bookingReference,
      notes: {
        bookingReference: booking.bookingReference,
        showId: String(booking.show),
        userId: String(req.user.id),
      },
    });

    booking.razorpayOrderId = order.id;
    booking.status = 'pending_payment';
    await booking.save();
    await broadcastTicketSeatState(booking.show);

    res.json({
      keyId: env.razorpayKeyId,
      order,
      booking: formatBooking(booking, mapTicketShowSummary(show, { total: show.seats.length, available: 0, held: 0, booked: 0 })),
    });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

export const verifyTicketPayment = async (req, res) => {
  try {
    const booking = await TicketBooking.findOne({ _id: req.params.id, user: req.user.id });
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    const show = await findHydratedTicketShowById(booking.show);
    if (!show) return res.status(404).json({ message: 'Ticket show not found' });

    const orderId = req.body?.razorpay_order_id;
    const paymentId = req.body?.razorpay_payment_id;
    const signature = req.body?.razorpay_signature;

    if (!orderId || !paymentId || !signature) {
      return res.status(400).json({ message: 'Incomplete payment response' });
    }

    if (booking.razorpayOrderId !== orderId) {
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

    const expectedAmount = Math.round((booking.amount || 0) * 100);
    if (payment.amount !== expectedAmount || normalizeCurrency(payment.currency) !== normalizeCurrency(booking.currency)) {
      return res.status(400).json({ message: 'Payment amount verification failed' });
    }

    booking.status = 'paid';
    booking.razorpayPaymentId = paymentId;
    booking.razorpaySignature = signature;
    booking.paidAt = new Date();
    booking.holdExpiresAt = undefined;
    await booking.save();

    await TicketSeatReservation.updateMany(
      { booking: booking._id },
      { status: 'booked', holdExpiresAt: null }
    );

    try {
      if (req.user.email) {
        const emailContent = buildTicketEmail(req.user, booking, show);
        await sendEmail({ to: req.user.email, ...emailContent });
      }
    } catch (emailErr) {
      console.error(`Failed to send ticket email to ${req.user.email}: ${emailErr.message}`);
    }

    await broadcastTicketSeatState(booking.show);

    res.json({
      booking: formatBooking(
        booking,
        mapTicketShowSummary(show, {
          total: show.seats.length,
          available: 0,
          held: 0,
          booked: 0,
        }),
      ),
      payment,
    });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};
