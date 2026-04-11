import TicketShow from '../models/TicketShow.js';
import { expandSeatLayout } from '../utils/ticketSeats.js';

function buildTicketSeedData() {
  const now = Date.now();

  return [
    {
      type: 'movie',
      title: 'Midnight Multiverse',
      subtitle: 'Sci-fi premiere screening',
      description: 'A multiverse action film with immersive surround sound and recliner seating.',
      venue: 'Galaxy Cinemas',
      city: 'Delhi',
      date: new Date(now + 2 * 24 * 60 * 60 * 1000 + 19 * 60 * 60 * 1000),
      durationMinutes: 148,
      language: 'English',
      featured: true,
      tags: ['3D', 'Premiere'],
      seats: expandSeatLayout([
        { name: 'Luxe', rows: ['A', 'B'], seatsPerRow: 8, price: 420 },
        { name: 'Prime', rows: ['C', 'D'], seatsPerRow: 10, price: 280 },
        { name: 'Classic', rows: ['E', 'F'], seatsPerRow: 10, price: 180 },
      ]),
    },
    {
      type: 'movie',
      title: 'Crimson Casefiles',
      subtitle: 'Mystery thriller night show',
      description: 'A detective thriller with immersive Dolby sound and a late-night city vibe.',
      venue: 'Metro Screens',
      city: 'Mumbai',
      date: new Date(now + 4 * 24 * 60 * 60 * 1000 + 21 * 60 * 60 * 1000),
      durationMinutes: 132,
      language: 'Hindi',
      tags: ['Thriller'],
      seats: expandSeatLayout([
        { name: 'Royal', rows: ['A', 'B'], seatsPerRow: 7, price: 360 },
        { name: 'Premier', rows: ['C', 'D', 'E'], seatsPerRow: 9, price: 230 },
        { name: 'Standard', rows: ['F', 'G'], seatsPerRow: 10, price: 160 },
      ]),
    },
    {
      type: 'concert',
      title: 'Neon Verse Live',
      subtitle: 'Electronic-pop arena show',
      description: 'An arena-sized concert with LED visuals, floor energy, and singalong sections.',
      venue: 'Indira Arena',
      city: 'Bengaluru',
      date: new Date(now + 6 * 24 * 60 * 60 * 1000 + 18 * 60 * 60 * 1000),
      durationMinutes: 180,
      featured: true,
      tags: ['Live', 'Arena'],
      seats: expandSeatLayout([
        { name: 'Pit VIP', rows: ['A', 'B'], seatsPerRow: 6, price: 2999 },
        { name: 'Premium Bowl', rows: ['C', 'D', 'E'], seatsPerRow: 8, price: 1899 },
        { name: 'Main Bowl', rows: ['F', 'G', 'H'], seatsPerRow: 10, price: 999 },
      ]),
    },
    {
      type: 'concert',
      title: 'Strings Under Stars',
      subtitle: 'Acoustic sunset performance',
      description: 'A candlelit acoustic concert with intimate seating and curated artist sets.',
      venue: 'Riverfront Stage',
      city: 'Jaipur',
      date: new Date(now + 9 * 24 * 60 * 60 * 1000 + 17 * 60 * 60 * 1000),
      durationMinutes: 140,
      tags: ['Acoustic', 'Outdoor'],
      seats: expandSeatLayout([
        { name: 'Front Circle', rows: ['A', 'B'], seatsPerRow: 8, price: 1999 },
        { name: 'Garden Seats', rows: ['C', 'D', 'E'], seatsPerRow: 10, price: 1199 },
        { name: 'Open Lawn', rows: ['F', 'G'], seatsPerRow: 12, price: 699 },
      ]),
    },
    {
      type: 'match',
      title: 'City Derby Clash',
      subtitle: 'Premier football showdown',
      description: 'Two rivals meet under floodlights for a high-energy stadium football night.',
      venue: 'National Sports Dome',
      city: 'Kolkata',
      date: new Date(now + 3 * 24 * 60 * 60 * 1000 + 20 * 60 * 60 * 1000),
      durationMinutes: 150,
      featured: true,
      tags: ['Football', 'Derby'],
      seats: expandSeatLayout([
        { name: 'Pavilion', rows: ['A', 'B', 'C'], seatsPerRow: 8, price: 2200 },
        { name: 'East Stand', rows: ['D', 'E', 'F'], seatsPerRow: 10, price: 1300 },
        { name: 'Fan Zone', rows: ['G', 'H'], seatsPerRow: 12, price: 750 },
      ]),
    },
    {
      type: 'match',
      title: 'Championship Cricket Night',
      subtitle: 'Weekend T20 special',
      description: 'A fast-paced night match with premium hospitality seats and fan stand sections.',
      venue: 'Emerald Cricket Park',
      city: 'Hyderabad',
      date: new Date(now + 11 * 24 * 60 * 60 * 1000 + 19 * 60 * 60 * 1000),
      durationMinutes: 220,
      tags: ['Cricket', 'Weekend'],
      seats: expandSeatLayout([
        { name: 'Club House', rows: ['A', 'B'], seatsPerRow: 8, price: 2600 },
        { name: 'North Stand', rows: ['C', 'D', 'E'], seatsPerRow: 10, price: 1450 },
        { name: 'Boundary Stand', rows: ['F', 'G', 'H'], seatsPerRow: 10, price: 850 },
      ]),
    },
  ];
}

function cloneSeats(seats = []) {
  return seats.map((seat) => ({
    seatId: seat.seatId,
    row: seat.row,
    number: seat.number,
    section: seat.section,
    price: seat.price,
  }));
}

function buildShiftedDate(baseDate, days, hours) {
  const nextDate = new Date(baseDate);
  nextDate.setDate(nextDate.getDate() + days);
  nextDate.setTime(nextDate.getTime() + hours * 60 * 60 * 1000);
  return nextDate;
}

function hasNearbySession(existingShows, candidateDate) {
  return existingShows.some(
    (show) => Math.abs(new Date(show.date).getTime() - candidateDate.getTime()) < 20 * 60 * 1000
  );
}

function buildMovieSessionVariants(show) {
  const plainShow = show.toObject ? show.toObject() : show;
  const offsets = [
    { days: 0, hours: -3, tag: 'Early Show' },
    { days: 0, hours: 3, tag: 'Late Show' },
    { days: 1, hours: -2, tag: 'Afternoon' },
    { days: 1, hours: 2, tag: 'Prime Time' },
    { days: 2, hours: -1, tag: 'Weekend' },
    { days: 3, hours: 1, tag: 'Fan Night' },
    { days: 4, hours: 0, tag: 'Encore' },
  ];

  return offsets.map((offset) => ({
    type: plainShow.type,
    title: plainShow.title,
    subtitle: plainShow.subtitle,
    description: plainShow.description,
    venue: plainShow.venue,
    city: plainShow.city,
    date: buildShiftedDate(plainShow.date, offset.days, offset.hours),
    durationMinutes: plainShow.durationMinutes,
    currency: plainShow.currency,
    posterUrl: plainShow.posterUrl,
    language: plainShow.language,
    featured: false,
    tags: [...new Set([...(plainShow.tags || []), offset.tag])],
    seats: cloneSeats(plainShow.seats || []),
  }));
}

async function ensureMovieShowtimeVariants(existingShows) {
  const movieGroups = new Map();

  for (const show of existingShows) {
    const plainShow = show.toObject ? show.toObject() : show;
    if (plainShow.type !== 'movie') continue;

    const groupKey = `${plainShow.title}::${plainShow.venue}::${plainShow.city}`;
    const list = movieGroups.get(groupKey) || [];
    list.push(plainShow);
    movieGroups.set(groupKey, list);
  }

  const inserts = [];

  for (const group of movieGroups.values()) {
    if (group.length >= 8) continue;

    group.sort((left, right) => new Date(left.date) - new Date(right.date));
    const anchorShow = group[0];
    const variants = buildMovieSessionVariants(anchorShow);

    for (const variant of variants) {
      if (group.length >= 8) break;
      if (variant.date.getTime() <= Date.now()) continue;
      if (hasNearbySession(group, variant.date)) continue;

      inserts.push(variant);
      group.push({ ...anchorShow, date: variant.date });
    }
  }

  if (inserts.length > 0) {
    await TicketShow.insertMany(inserts);
  }
}

export async function ensureTicketShowsSeeded() {
  let existingShows = await TicketShow.find().sort({ date: 1 });

  if (!existingShows.length) {
    await TicketShow.insertMany(buildTicketSeedData());
    existingShows = await TicketShow.find().sort({ date: 1 });
  }

  await ensureMovieShowtimeVariants(existingShows);
}
