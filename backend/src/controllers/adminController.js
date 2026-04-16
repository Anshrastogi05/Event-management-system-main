import Event from "../models/Event.js";
import Movie from "../models/Movie.js";
import Registration from "../models/Registration.js";
import Screen from "../models/Screen.js";
import Seat from "../models/Seat.js";
import Show from "../models/Show.js";
import Theater from "../models/Theater.js";
import TicketSeatReservation from "../models/TicketSeatReservation.js";
import User from "../models/User.js";
import {
  createMovieShowCatalogEntry,
  ensureTicketShowsSeeded,
} from "../services/ticketCatalog.js";
import {
  findHydratedTicketShowById,
  listHydratedTicketShows,
} from "../services/ticketing.js";
import { buildSeatSectionsFromLayout, expandSeatLayout } from "../utils/ticketSeats.js";
import { storeUploadedImage } from "../utils/upload.js";
import { createCatalogId } from "../utils/catalogIds.js";

const ACTIVE_REGISTRATION_STATUSES = ["registered", "attended"];

const defaultDashboardSummary = {
  events: 0,
  approvedEvents: 0,
  registrations: 0,
  customers: 0,
  organizers: 0,
};

function createBadRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function parsePositiveInteger(value, fieldLabel, fallbackValue) {
  if (value === undefined || value === null || value === "") {
    return fallbackValue;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw createBadRequest(
      `${fieldLabel} must be a whole number greater than 0.`,
    );
  }

  return parsed;
}

function parseDecimal(value, fieldLabel, fallbackValue, { min = 0, max } = {}) {
  if (value === undefined || value === null || value === "") {
    return fallbackValue;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw createBadRequest(`${fieldLabel} must be a valid number.`);
  }
  if (parsed < min) {
    throw createBadRequest(`${fieldLabel} must be at least ${min}.`);
  }
  if (max !== undefined && parsed > max) {
    throw createBadRequest(`${fieldLabel} must be at most ${max}.`);
  }

  return parsed;
}

function parseBoolean(value) {
  if (typeof value === "boolean") return value;

  return ["true", "1", "on", "yes"].includes(
    String(value || "").trim().toLowerCase(),
  );
}

function parseTags(value) {
  return String(value || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function buildSeatSectionsFromRequest(body) {
  return buildSeatSectionsFromLayout([
    {
      name: normalizeText(body.royalName) || "Royal",
      rows: parsePositiveInteger(body.royalRows, "Royal rows", 2),
      seatsPerRow: parsePositiveInteger(
        body.royalSeatsPerRow,
        "Royal seats per row",
        7,
      ),
      price: parsePositiveInteger(body.royalPrice, "Royal price", 360),
    },
    {
      name: normalizeText(body.premierName) || "Premier",
      rows: parsePositiveInteger(body.premierRows, "Premier rows", 3),
      seatsPerRow: parsePositiveInteger(
        body.premierSeatsPerRow,
        "Premier seats per row",
        9,
      ),
      price: parsePositiveInteger(body.premierPrice, "Premier price", 230),
    },
    {
      name: normalizeText(body.standardName) || "Standard",
      rows: parsePositiveInteger(body.standardRows, "Standard rows", 2),
      seatsPerRow: parsePositiveInteger(
        body.standardSeatsPerRow,
        "Standard seats per row",
        10,
      ),
      price: parsePositiveInteger(body.standardPrice, "Standard price", 160),
    },
  ]);
}

function summarizeSeatSections(seats = []) {
  const sections = new Map();

  for (const seat of seats) {
    const current =
      sections.get(seat.section) ||
      {
        name: seat.section,
        price: seat.price,
        rows: new Map(),
      };

    const rowSeats = current.rows.get(seat.row) || [];
    rowSeats.push(seat);
    current.rows.set(seat.row, rowSeats);
    sections.set(seat.section, current);
  }

  return [...sections.values()].map((section) => ({
    name: section.name,
    price: section.price,
    rows: [...section.rows.keys()].sort(),
    seatsPerRow: Math.max(
      ...[...section.rows.values()].map((rowSeats) => rowSeats.length),
    ),
  }));
}

function normalizeSeatSectionsSignature(sections = []) {
  return JSON.stringify(
    [...sections]
      .map((section) => ({
        name: section.name,
        price: Number(section.price),
        seatsPerRow: Number(section.seatsPerRow),
        rows: [...section.rows].sort(),
      }))
      .sort((left, right) => left.name.localeCompare(right.name)),
  );
}

async function loadRegistrationUsers() {
  const registrations = await Registration.find({
    status: { $in: ACTIVE_REGISTRATION_STATUSES },
  })
    .populate("user", "name email")
    .populate("event", "title")
    .sort({ createdAt: -1 })
    .lean();

  const usersById = new Map();

  for (const registration of registrations) {
    const userId = registration.user?._id?.toString();
    if (!userId) continue;

    const existing =
      usersById.get(userId) ||
      {
        _id: userId,
        name: registration.user?.name,
        email: registration.user?.email,
        registrations: 0,
        events: [],
        eventIds: new Set(),
      };

    existing.registrations += 1;

    const eventId = registration.event?._id?.toString();
    if (
      eventId &&
      registration.event?.title &&
      !existing.eventIds.has(eventId)
    ) {
      existing.eventIds.add(eventId);
      existing.events.push({
        _id: eventId,
        title: registration.event.title,
      });
    }

    usersById.set(userId, existing);
  }

  return [...usersById.values()]
    .map(({ eventIds, ...entry }) => entry)
    .sort((left, right) => {
      if (right.registrations !== left.registrations) {
        return right.registrations - left.registrations;
      }

      return (left.name || "").localeCompare(right.name || "");
    });
}

async function loadActiveUsers() {
  return User.find({
    role: { $in: ["customer", "organizer"] },
    isBlocked: false,
  })
    .select("name email")
    .sort({ name: 1, email: 1 })
    .lean();
}

async function loadPendingEvents() {
  return Event.find({ status: "pending" })
    .populate("organizer", "name email")
    .sort({ createdAt: -1 })
    .lean();
}

async function loadDashboardSummary() {
  const [
    totalEvents,
    approvedEvents,
    totalRegistrations,
    totalCustomers,
    totalOrganizers,
  ] = await Promise.all([
    Event.countDocuments({}),
    Event.countDocuments({ status: "approved" }),
    Registration.countDocuments({
      status: { $in: ACTIVE_REGISTRATION_STATUSES },
    }),
    User.countDocuments({ role: "customer", isBlocked: false }),
    User.countDocuments({ role: "organizer", isBlocked: false }),
  ]);

  return {
    events: totalEvents,
    approvedEvents,
    registrations: totalRegistrations,
    customers: totalCustomers,
    organizers: totalOrganizers,
  };
}

async function loadMovieShows() {
  await ensureTicketShowsSeeded();

  const shows = await listHydratedTicketShows();
  const uniqueShows = [];
  const seenTitles = new Set();

  for (const show of shows) {
    const titleKey = (show.movie_id || show.title || "").trim().toLowerCase();
    if (!titleKey || seenTitles.has(titleKey)) continue;

    seenTitles.add(titleKey);
    uniqueShows.push(show);
  }

  return uniqueShows;
}

export const getAdminDashboard = async (_req, res) => {
  try {
    const [pendingEventsResult, summaryResult, movieShowsResult] =
      await Promise.allSettled([
        loadPendingEvents(),
        loadDashboardSummary(),
        loadMovieShows(),
      ]);

    const warnings = [];

    const pendingEvents =
      pendingEventsResult.status === "fulfilled" ? pendingEventsResult.value : [];
    if (pendingEventsResult.status === "rejected") {
      warnings.push("Pending events could not be loaded.");
    }

    const summary =
      summaryResult.status === "fulfilled"
        ? summaryResult.value
        : defaultDashboardSummary;
    if (summaryResult.status === "rejected") {
      warnings.push("Platform summary could not be loaded.");
    }

    const movieShows =
      movieShowsResult.status === "fulfilled" ? movieShowsResult.value : [];
    if (movieShowsResult.status === "rejected") {
      warnings.push("Movie poster library could not be loaded.");
    }

    if (warnings.length === 3) {
      return res
        .status(500)
        .json({ message: "Unable to load the admin dashboard." });
    }

    res.json({ pendingEvents, summary, movieShows, warnings });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const listAdminUsers = async (req, res) => {
  try {
    const scope = req.query.scope;

    if (scope === "registrations") {
      const users = await loadRegistrationUsers();
      return res.json({
        users,
        scope,
        title: "Registration Participants",
        description: "Participants and the events they are registered for.",
      });
    }

    if (scope === "active") {
      const users = await loadActiveUsers();
      return res.json({
        users,
        scope,
        title: "Active Users",
        description: "Customers and organizers who currently have access.",
      });
    }

    return res.status(400).json({ message: "Invalid user list scope." });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const createAdminMovieShow = async (req, res) => {
  try {
    const title = normalizeText(req.body.title);
    const genre = normalizeText(req.body.genre) || "General";
    const subtitle = normalizeText(req.body.subtitle);
    const description = normalizeText(req.body.description);
    const venue = normalizeText(req.body.venue);
    const city = normalizeText(req.body.city);
    const screenName = normalizeText(req.body.screenName) || `${title} Screen`;
    const language = normalizeText(req.body.language);
    const rating = parseDecimal(req.body.rating, "Rating", 0, {
      min: 0,
      max: 10,
    });
    const currency =
      normalizeText(req.body.currency || "INR").toUpperCase() || "INR";
    const showDate = req.body.date ? new Date(req.body.date) : null;

    if (!title) throw createBadRequest("Movie title is required.");
    if (!description) throw createBadRequest("Movie description is required.");
    if (!venue) throw createBadRequest("Venue is required.");
    if (!city) throw createBadRequest("City is required.");
    if (!showDate || Number.isNaN(showDate.getTime())) {
      throw createBadRequest("A valid show date and time is required.");
    }
    if (showDate.getTime() <= Date.now()) {
      throw createBadRequest("Show date and time must be in the future.");
    }

    const durationMinutes = parsePositiveInteger(
      req.body.durationMinutes,
      "Duration",
      150,
    );
    const seatSections = buildSeatSectionsFromRequest(req.body);

    const uploadedPoster = req.file
      ? await storeUploadedImage(req.file, { folder: "ticket-shows" })
      : null;
    const featured = parseBoolean(req.body.featured);

    const show = await createMovieShowCatalogEntry({
      title,
      genre,
      rating,
      subtitle,
      description,
      venue,
      city,
      date: showDate,
      duration: durationMinutes,
      currency,
      posterUrl: uploadedPoster?.url,
      language,
      featured,
      tags: parseTags(req.body.tags),
      screenName,
      seatSections,
    });
    const hydratedShow = await findHydratedTicketShowById(show._id);

    res.status(201).json({
      message: `${title} was added to the movies page.`,
      show: hydratedShow,
    });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

export const updateAdminMovieShow = async (req, res) => {
  try {
    await ensureTicketShowsSeeded();

    const sourceShow = await findHydratedTicketShowById(req.params.id);
    if (!sourceShow) {
      return res.status(404).json({ message: "Movie show not found." });
    }

    const title = normalizeText(req.body.title);
    const genre = normalizeText(req.body.genre) || "General";
    const subtitle = normalizeText(req.body.subtitle);
    const description = normalizeText(req.body.description);
    const venue = normalizeText(req.body.venue);
    const city = normalizeText(req.body.city);
    const screenName =
      normalizeText(req.body.screenName) || sourceShow.screen?.name || `${title} Screen`;
    const language = normalizeText(req.body.language);
    const rating = parseDecimal(req.body.rating, "Rating", sourceShow.rating || 0, {
      min: 0,
      max: 10,
    });
    const currency =
      normalizeText(req.body.currency || sourceShow.currency || "INR").toUpperCase() ||
      "INR";
    const showDate = req.body.date ? new Date(req.body.date) : new Date(sourceShow.date);

    if (!title) throw createBadRequest("Movie title is required.");
    if (!description) throw createBadRequest("Movie description is required.");
    if (!venue) throw createBadRequest("Venue is required.");
    if (!city) throw createBadRequest("City is required.");
    if (!showDate || Number.isNaN(showDate.getTime())) {
      throw createBadRequest("A valid show date and time is required.");
    }

    const durationMinutes = parsePositiveInteger(
      req.body.durationMinutes,
      "Duration",
      sourceShow.durationMinutes || 150,
    );
    const seatSections = buildSeatSectionsFromRequest(req.body);
    const nextSeatSignature = normalizeSeatSectionsSignature(seatSections);
    const currentSeatSignature = normalizeSeatSectionsSignature(
      summarizeSeatSections(sourceShow.seats || []),
    );

    const uploadedPoster = req.file
      ? await storeUploadedImage(req.file, { folder: "ticket-shows" })
      : null;
    const featured = parseBoolean(req.body.featured);
    const tags = parseTags(req.body.tags);

    await Movie.updateOne(
      { movie_id: sourceShow.movie_id },
      {
        title,
        genre,
        subtitle,
        description,
        duration: durationMinutes,
        rating,
        language,
        tags,
        ...(uploadedPoster?.url ? { posterUrl: uploadedPoster.url } : {}),
      },
    );

    await Theater.updateOne(
      { theater_id: sourceShow.theater?.theater_id },
      { name: venue, city },
    );

    await Screen.updateOne(
      { screen_id: sourceShow.screen_id },
      { name: screenName },
    );

    if (nextSeatSignature !== currentSeatSignature) {
      const siblingShows = await Show.find({ screen_id: sourceShow.screen_id })
        .select("_id")
        .lean();
      const siblingShowIds = siblingShows.map((show) => show._id);
      const reservationCount = await TicketSeatReservation.countDocuments({
        show: { $in: siblingShowIds },
      });

      if (reservationCount > 0) {
        throw createBadRequest(
          "Seat layout cannot be changed because this screen already has active or confirmed bookings.",
        );
      }

      await Seat.deleteMany({ screen_id: sourceShow.screen_id });
      await Seat.insertMany(
        expandSeatLayout(seatSections).map((seat) => ({
          seat_id: createCatalogId("SET"),
          screen_id: sourceShow.screen_id,
          label: seat.seatId,
          row: seat.row,
          number: seat.number,
          section: seat.section,
          price: seat.price,
        })),
      );
    }

    if (featured) {
      await Show.updateMany({ featured: true, _id: { $ne: sourceShow._id } }, { featured: false });
    }

    await Show.updateOne(
      { _id: sourceShow._id },
      {
        date: showDate,
        currency,
        featured,
      },
    );

    const hydratedShow = await findHydratedTicketShowById(sourceShow._id);

    res.json({
      message: `${title} was updated successfully.`,
      show: hydratedShow,
    });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

export const approveEvent = async (req, res) => {
  try {
    const event = await Event.findByIdAndUpdate(
      req.params.id,
      { status: "approved" },
      { new: true },
    );
    if (!event) return res.status(404).json({ message: "Not found" });
    res.json({ event });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const rejectEvent = async (req, res) => {
  try {
    const event = await Event.findByIdAndUpdate(
      req.params.id,
      { status: "rejected" },
      { new: true },
    );
    if (!event) return res.status(404).json({ message: "Not found" });
    res.json({ event });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const listPendingEvents = async (req, res) => {
  try {
    const events = await loadPendingEvents();
    res.json({ events });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const blockUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isBlocked: true },
      { new: true },
    );
    if (!user) return res.status(404).json({ message: "Not found" });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const unblockUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isBlocked: false },
      { new: true },
    );
    if (!user) return res.status(404).json({ message: "Not found" });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
