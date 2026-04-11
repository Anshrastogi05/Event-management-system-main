import crypto from 'crypto';
import TicketShow from '../models/TicketShow.js';
import TicketBooking from '../models/TicketBooking.js';
import TicketSeatReservation from '../models/TicketSeatReservation.js';
import { env } from '../config/env.js';
import { emitTicketSeatMap } from './socket.js';
import { getPriceRange } from '../utils/ticketSeats.js';

const ACTIVE_UNPAID_STATUSES = ['held', 'pending_payment'];

export function getTicketHoldDurationMs() {
  return env.ticketHoldMinutes * 60 * 1000;
}

export function generateTicketBookingReference() {
  return `TKT-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

export function mapTicketShowSummary(show, counters) {
  const pricing = getPriceRange(show.seats);

  return {
    _id: show._id,
    type: show.type,
    title: show.title,
    subtitle: show.subtitle,
    description: show.description,
    venue: show.venue,
    city: show.city,
    date: show.date,
    durationMinutes: show.durationMinutes,
    currency: show.currency,
    posterUrl: show.posterUrl,
    featured: show.featured,
    language: show.language,
    tags: show.tags,
    pricing,
    counters,
    totalSeats: show.seats.length,
  };
}

export function buildSeatSnapshot(show, reservations) {
  const reservationMap = new Map(reservations.map((reservation) => [reservation.seatId, reservation]));
  const counters = { total: show.seats.length, available: 0, held: 0, booked: 0 };

  const seats = show.seats.map((seat) => {
    const reservation = reservationMap.get(seat.seatId);
    let status = 'available';

    if (reservation) {
      status = reservation.status === 'booked' ? 'booked' : 'held';
    }

    counters[status] += 1;

    return {
      ...(seat.toObject ? seat.toObject() : seat),
      status,
      holdExpiresAt: status === 'held' ? reservation.holdExpiresAt : null,
      bookingId: reservation?.booking ? String(reservation.booking) : null,
    };
  });

  return { counters, seats };
}

export async function cleanupExpiredTicketHolds(showId = null) {
  const now = new Date();
  const filter = {
    status: { $in: ACTIVE_UNPAID_STATUSES },
    holdExpiresAt: { $lte: now },
  };

  if (showId) filter.show = showId;

  const expiredBookings = await TicketBooking.find(filter).select('_id show');
  if (!expiredBookings.length) return [];

  const bookingIds = expiredBookings.map((booking) => booking._id);
  const affectedShowIds = [...new Set(expiredBookings.map((booking) => String(booking.show)))];

  await TicketBooking.updateMany({ _id: { $in: bookingIds } }, { status: 'expired' });
  await TicketSeatReservation.deleteMany({ booking: { $in: bookingIds }, status: 'held' });

  return affectedShowIds;
}

export async function cancelActiveBookingsForUser(showId, userId) {
  const existingBookings = await TicketBooking.find({
    show: showId,
    user: userId,
    status: { $in: ACTIVE_UNPAID_STATUSES },
  }).select('_id show');

  if (!existingBookings.length) return [];

  const bookingIds = existingBookings.map((booking) => booking._id);
  const affectedShowIds = [...new Set(existingBookings.map((booking) => String(booking.show)))];

  await TicketBooking.updateMany({ _id: { $in: bookingIds } }, { status: 'cancelled' });
  await TicketSeatReservation.deleteMany({ booking: { $in: bookingIds }, status: 'held' });

  return affectedShowIds;
}

export async function getTicketShowSeatState(showId) {
  const show = await TicketShow.findById(showId);
  if (!show) return null;

  await cleanupExpiredTicketHolds(showId);
  const reservations = await TicketSeatReservation.find({ show: showId });
  const seatSnapshot = buildSeatSnapshot(show, reservations);

  return {
    show: mapTicketShowSummary(show, seatSnapshot.counters),
    seatSnapshot,
  };
}

export async function broadcastTicketSeatState(showId) {
  const state = await getTicketShowSeatState(showId);
  if (!state) return;

  emitTicketSeatMap(showId, {
    showId,
    counters: state.seatSnapshot.counters,
    seats: state.seatSnapshot.seats,
    emittedAt: Date.now(),
  });
}

let cleanupIntervalId = null;

export function startTicketHoldCleanupLoop() {
  if (cleanupIntervalId) return;

  cleanupIntervalId = setInterval(async () => {
    try {
      const affectedShowIds = await cleanupExpiredTicketHolds();
      for (const showId of affectedShowIds) {
        await broadcastTicketSeatState(showId);
      }
    } catch (error) {
      console.error('Ticket hold cleanup failed:', error.message);
    }
  }, 15000);

  if (typeof cleanupIntervalId.unref === 'function') {
    cleanupIntervalId.unref();
  }
}
