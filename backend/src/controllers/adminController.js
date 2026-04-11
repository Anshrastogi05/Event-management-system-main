import Event from "../models/Event.js";
import Registration from "../models/Registration.js";
import TicketShow from "../models/TicketShow.js";
import User from "../models/User.js";
import { ensureTicketShowsSeeded } from "../services/ticketCatalog.js";

const ACTIVE_REGISTRATION_STATUSES = ["registered", "attended"];

const defaultDashboardSummary = {
  events: 0,
  approvedEvents: 0,
  registrations: 0,
  customers: 0,
  organizers: 0,
};

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

  const shows = await TicketShow.find({ type: "movie" }).sort({ date: 1 }).lean();
  const uniqueShows = [];
  const seenTitles = new Set();

  for (const show of shows) {
    const titleKey = (show.title || "").trim().toLowerCase();
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
