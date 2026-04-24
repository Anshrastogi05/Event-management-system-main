import Event from '../models/Event.js';
import Registration from '../models/Registration.js';
import { storeUploadedImage } from '../utils/upload.js';

function isAdmin(user) {
  return user?.role === 'admin';
}

function isOrganizerViewingOwnEvents(user, organizerId) {
  return user?.role === 'organizer' && organizerId && organizerId === user.id;
}

function canViewUnapprovedEvent(user, event) {
  if (!user || !event) return false;
  if (isAdmin(user)) return true;

  const organizerId =
    typeof event.organizer === 'object' && event.organizer?._id
      ? event.organizer._id.toString()
      : String(event.organizer);

  return user.id === organizerId;
}

function buildEventFilter(query, user) {
  const { q, category, status, organizer } = query;
  const filter = {};

  if (q) filter.title = { $regex: q, $options: 'i' };
  if (category) filter.category = category;
  if (organizer) filter.organizer = organizer;

  const canSeeAllStatuses =
    isAdmin(user) || isOrganizerViewingOwnEvents(user, organizer);

  if (canSeeAllStatuses) {
    if (status) filter.status = status;
  } else {
    filter.status = 'approved';
  }

  return filter;
}

function buildEventPayload(body, user) {
  const payload = {
    title: body?.title,
    description: body?.description,
    category: body?.category,
    date: body?.date,
    location: body?.location,
    capacity: body?.capacity,
    permanentBookingPrice: body?.permanentBookingPrice,
    currency: body?.currency,
    tags: body?.tags,
  };

  if (isAdmin(user) && body?.status) {
    payload.status = body.status;
  }

  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined),
  );
}

export const createEvent = async (req, res) => {
  try {
    const uploadedPoster = req.file
      ? await storeUploadedImage(req.file, { folder: 'events' })
      : null;
    const posterUrl = uploadedPoster?.url;
    const payload = buildEventPayload(req.body, req.user);
    const event = await Event.create({
      ...payload,
      organizer: req.user.id,
      posterUrl,
      status: isAdmin(req.user) ? payload.status || 'approved' : 'pending',
    });

    res.status(201).json({
      event,
      message: isAdmin(req.user)
        ? 'Event created successfully.'
        : 'Event submitted for admin approval. It will stay hidden from customers until an admin approves it.',
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const updateEvent = async (req, res) => {
  try {
    const uploadedPoster = req.file
      ? await storeUploadedImage(req.file, { folder: 'events' })
      : null;
    const posterUrl = uploadedPoster?.url;
    const update = buildEventPayload(req.body, req.user);
    if (posterUrl) update.posterUrl = posterUrl;
    const filter =
      req.user.role === 'admin'
        ? { _id: req.params.id }
        : { _id: req.params.id, organizer: req.user.id };
    const existingEvent = await Event.findOne(filter);
    if (!existingEvent) return res.status(404).json({ message: 'Event not found' });

    if (!isAdmin(req.user)) {
      update.status = 'pending';
    }

    const event = await Event.findByIdAndUpdate(existingEvent._id, update, {
      new: true,
    });
    if (!event) return res.status(404).json({ message: 'Event not found' });
    res.json({
      event,
      message: isAdmin(req.user)
        ? 'Event updated successfully.'
        : existingEvent.status === 'approved'
          ? 'Event changes were sent for admin approval. The event is hidden from customers until it is approved again.'
          : 'Event updated successfully and kept in the admin approval queue.',
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const deleteEvent = async (req, res) => {
  try {
    const filter =
      req.user.role === 'admin'
        ? { _id: req.params.id }
        : { _id: req.params.id, organizer: req.user.id };
    const event = await Event.findOneAndDelete(filter);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const listEvents = async (req, res) => {
  try {
    const filter = buildEventFilter(req.query, req.user);
    const events = await Event.find(filter).populate('organizer', 'name').sort({ date: 1 });
    res.json({ events });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).populate('organizer', 'name');
    if (!event) return res.status(404).json({ message: 'Not found' });
    if (event.status !== 'approved' && !canViewUnapprovedEvent(req.user, event)) {
      return res.status(404).json({ message: 'Event not found' });
    }
    const count = await Registration.countDocuments({
      event: event._id,
      status: { $in: ['registered', 'attended'] },
    });
    res.json({ event, registrations: count });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
