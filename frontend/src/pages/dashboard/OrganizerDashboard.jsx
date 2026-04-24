import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { useAuth } from "../../context/AuthContext.jsx";
import DashboardHeader from "../../components/dashboard/DashboardHeader.jsx";
import DashboardStatCard from "../../components/dashboard/DashboardStatCard.jsx";
import DashboardToast from "../../components/dashboard/DashboardToast.jsx";
import DashboardUserModal from "../../components/dashboard/DashboardUserModal.jsx";

function getBookingLabel(bookingType) {
  return bookingType === "permanent"
    ? "Permanent Booking"
    : "Free Registration";
}

function formatCurrency(amount, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount || 0);
}

function formatEventMeta(event) {
  return `${new Date(event.date).toLocaleDateString()} | ${event.location}`;
}

function getEventStatusConfig(status) {
  if (status === "approved") {
    return {
      label: "Live",
      classes:
        "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
      description: "Visible on the customer home page and open for booking.",
    };
  }

  if (status === "rejected") {
    return {
      label: "Declined",
      classes:
        "border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300",
      description:
        "Hidden from customers. Update it and submit again when it is ready.",
    };
  }

  return {
    label: "Waiting Review",
    classes:
      "border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
    description: "Sent to admin and hidden from customers until approval.",
  };
}

function OrganizerAnalyticsStat({ label, value, hint }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
        {label}
      </div>
      <div className="mt-2 text-2xl font-black tracking-tight">{value}</div>
      {hint ? (
        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {hint}
        </div>
      ) : null}
    </div>
  );
}

export default function OrganizerDashboard() {
  const { user, logout, token } = useAuth();
  const analyticsSectionRef = useRef(null);
  const [events, setEvents] = useState([]);
  const [analytics, setAnalytics] = useState([]);
  const [analyticsSummary, setAnalyticsSummary] = useState({
    events: 0,
    participants: 0,
    attended: 0,
    registered: 0,
    free: 0,
    permanent: 0,
    revenue: 0,
  });
  const [selectedAnalyticsEventId, setSelectedAnalyticsEventId] =
    useState("all");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [location, setLocation] = useState("");
  const [category, setCategory] = useState("Tech");
  const [description, setDescription] = useState("");
  const [permanentBookingPrice, setPermanentBookingPrice] = useState("0");
  const [poster, setPoster] = useState(null);
  const [participantModalOpen, setParticipantModalOpen] = useState(false);
  const [toast, setToast] = useState({
    open: false,
    type: "info",
    message: "",
  });

  const showToast = (type, message) => {
    setToast({ open: true, type, message });
    setTimeout(
      () => setToast({ open: false, type: "info", message: "" }),
      3000,
    );
  };

  function getRequestConfig() {
    return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
  }

  async function loadDashboardData() {
    try {
      const [eventsRes, analyticsRes] = await Promise.all([
        axios.get("/api/events", {
          ...getRequestConfig(),
          params: { organizer: user.id },
        }),
        axios.get("/api/registrations/organizer/analytics", getRequestConfig()),
      ]);

      setEvents(eventsRes.data.events || []);
      setAnalytics(analyticsRes.data.analytics || []);
      setAnalyticsSummary(
        analyticsRes.data.summary || {
          events: 0,
          participants: 0,
          attended: 0,
          registered: 0,
          free: 0,
          permanent: 0,
          revenue: 0,
        },
      );
    } catch {
      showToast("error", "Unable to load your organizer dashboard.");
    }
  }

  useEffect(() => {
    if (!user || !token) return;
    void loadDashboardData();
  }, [token, user]);

  useEffect(() => {
    if (
      selectedAnalyticsEventId !== "all" &&
      !analytics.some((item) => item.event?._id === selectedAnalyticsEventId)
    ) {
      setSelectedAnalyticsEventId("all");
    }
  }, [analytics, selectedAnalyticsEventId]);

  async function createEvent(event) {
    event.preventDefault();

    try {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("date", date);
      formData.append("location", location);
      formData.append("category", category);
      formData.append("description", description);
      formData.append("permanentBookingPrice", permanentBookingPrice || "0");
      formData.append("currency", "INR");
      if (poster) formData.append("poster", poster);

      const response = await axios.post("/api/events", formData, getRequestConfig());
      setTitle("");
      setDate("");
      setLocation("");
      setCategory("Tech");
      setDescription("");
      setPermanentBookingPrice("0");
      setPoster(null);
      await loadDashboardData();
      showToast(
        "success",
        response.data?.message ||
          "Event submitted for admin approval successfully.",
      );
    } catch (error) {
      showToast(
        "error",
        error.response?.data?.message || "Unable to create the event.",
      );
    }
  }

  async function exportCsv(eventId) {
    try {
      const check = await axios.get(
        `/api/registrations/${eventId}/participants`,
        getRequestConfig(),
      );
      const list = check.data.participants || [];
      if (!Array.isArray(list) || list.length === 0) {
        showToast("warning", "No participants available for this event.");
        return;
      }

      const res = await axios.get(
        `/api/registrations/${eventId}/participants.csv`,
        {
          ...getRequestConfig(),
          responseType: "blob",
        },
      );
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `participants-${eventId}.csv`;
      anchor.click();
      window.URL.revokeObjectURL(url);
      showToast("success", "Participant CSV exported successfully.");
    } catch {
      showToast("error", "Unable to export participants right now.");
    }
  }

  function focusAnalytics(eventId = "all") {
    setSelectedAnalyticsEventId(eventId);
    analyticsSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  const stats = useMemo(() => {
    const approved = events.filter(
      (event) => event.status === "approved",
    ).length;
    const pending = events.filter((event) => event.status === "pending").length;
    const rejected = events.filter(
      (event) => event.status === "rejected",
    ).length;
    const categories = new Set(
      events.map((event) => event.category).filter(Boolean),
    );

    return {
      total: events.length,
      approved,
      pending,
      rejected,
      categories: categories.size,
      participants: analyticsSummary.participants || 0,
      byCategory: events.reduce((accumulator, event) => {
        const key = event.category || "Other";
        accumulator[key] = (accumulator[key] || 0) + 1;
        return accumulator;
      }, {}),
    };
  }, [analyticsSummary.participants, events]);

  const analyticsByEventId = useMemo(
    () => new Map(analytics.map((item) => [item.event?._id, item])),
    [analytics],
  );

  const filteredAnalytics = useMemo(() => {
    if (selectedAnalyticsEventId === "all") return analytics;
    return analytics.filter(
      (item) => item.event?._id === selectedAnalyticsEventId,
    );
  }, [analytics, selectedAnalyticsEventId]);

  const activeAnalyticsItem = useMemo(() => {
    if (selectedAnalyticsEventId === "all") return null;
    return (
      analytics.find((item) => item.event?._id === selectedAnalyticsEventId) ||
      null
    );
  }, [analytics, selectedAnalyticsEventId]);

  const participantEntries = useMemo(() => {
    const usersById = new Map();

    for (const item of analytics) {
      const eventId = item.event?._id?.toString();
      const eventTitle = item.event?.title;
      if (!eventId || !eventTitle) continue;

      for (const participant of item.participants || []) {
        const userId = participant.user?._id?.toString();
        if (!userId) continue;

        const entry = usersById.get(userId) || {
          _id: userId,
          name: participant.user?.name,
          email: participant.user?.email,
          registrations: 0,
          events: [],
          eventIds: new Set(),
        };

        entry.registrations += 1;

        if (!entry.eventIds.has(eventId)) {
          entry.eventIds.add(eventId);
          entry.events.push({
            _id: eventId,
            title: eventTitle,
          });
        }

        usersById.set(userId, entry);
      }
    }

    return [...usersById.values()]
      .map(({ eventIds, ...entry }) => entry)
      .sort((left, right) => {
        if (right.registrations !== left.registrations) {
          return right.registrations - left.registrations;
        }

        return (left.name || "").localeCompare(right.name || "");
      });
  }, [analytics]);

  const profileAnalytics = activeAnalyticsItem
    ? {
        label: activeAnalyticsItem.event?.title || "Selected event",
        participants: activeAnalyticsItem.totals?.participants || 0,
        attended: activeAnalyticsItem.totals?.attended || 0,
        permanent: activeAnalyticsItem.totals?.permanent || 0,
        revenue: activeAnalyticsItem.totals?.revenue || 0,
      }
    : {
        label: "All events",
        participants: analyticsSummary.participants || 0,
        attended: analyticsSummary.attended || 0,
        permanent: analyticsSummary.permanent || 0,
        revenue: analyticsSummary.revenue || 0,
      };

  const profilePanel = (
    <div className="w-full max-w-2xl rounded-3xl border border-red-200 bg-slate-50 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.26em] text-slate-500 dark:text-slate-400">
            Under Your Profile
          </div>
          <div className="mt-1 text-lg font-bold">Organizer analytics</div>
          <div className="text-sm text-slate-500 dark:text-slate-400">
            {profileAnalytics.label}
          </div>
        </div>

        <button
          className="btn-outline"
          onClick={() => focusAnalytics(selectedAnalyticsEventId)}
        >
          Open analytics
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <OrganizerAnalyticsStat
          label="Participants"
          value={profileAnalytics.participants}
        />
        <OrganizerAnalyticsStat
          label="Attended"
          value={profileAnalytics.attended}
        />
        <OrganizerAnalyticsStat
          label="Paid"
          value={profileAnalytics.permanent}
        />
        <OrganizerAnalyticsStat
          label="Revenue"
          value={formatCurrency(profileAnalytics.revenue, "INR")}
        />
      </div>

      <div className="mt-4">
        <label className="mb-2 block text-sm font-medium text-slate-600 dark:text-slate-300">
          Choose event analytics
        </label>
        <select
          className="input w-full"
          value={selectedAnalyticsEventId}
          onChange={(event) => setSelectedAnalyticsEventId(event.target.value)}
        >
          <option value="all">All events</option>
          {analytics.map((item) => (
            <option key={item.event?._id} value={item.event?._id}>
              {item.event?.title}
            </option>
          ))}
        </select>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <DashboardToast toast={toast} />
      <DashboardUserModal
        open={participantModalOpen}
        title="Registered Participants"
        description="Participants across your events and the events they joined."
        users={participantEntries}
        loading={false}
        emptyMessage="No participants have registered for your events yet."
        onClose={() => setParticipantModalOpen(false)}
      />

      <DashboardHeader
        title="Manage your events"
        subtitle="Submit new events for admin approval, track review status, and watch participant analytics once events go live."
        user={user}
        onLogout={logout}
        profilePanel={profilePanel}
        menuItems={[
          {
            label: "Event Analytics",
            onClick: () => focusAnalytics(selectedAnalyticsEventId),
          },
        ]}
        actions={
          <button className="btn-outline" onClick={loadDashboardData}>
            Refresh Events
          </button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <DashboardStatCard
          label="Total Events"
          value={stats.total}
          hint="Everything you have created"
        />
        <DashboardStatCard
          label="Approved"
          value={stats.approved}
          hint="Ready for attendees"
        />
        <DashboardStatCard
          label="Pending Review"
          value={stats.pending}
          hint="Waiting for admin review"
        />
        <DashboardStatCard
          label="Declined"
          value={stats.rejected}
          hint="Still hidden from customers"
        />
        <DashboardStatCard
          label="Categories"
          value={stats.categories}
          hint="Different event themes"
        />
        <DashboardStatCard
          label="Participants"
          value={stats.participants}
          hint="Across all your events"
          actionLabel="View registrations"
          onClick={() => setParticipantModalOpen(true)}
        />
      </div>

      <section
        ref={analyticsSectionRef}
        className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">Event analytics</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Every event shows its participant totals, booking mix, attendance,
              and participant list.
            </p>
          </div>

          <div className="flex min-w-[220px] flex-col gap-2">
            <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
              Filter analytics
            </label>
            <select
              className="input"
              value={selectedAnalyticsEventId}
              onChange={(event) =>
                setSelectedAnalyticsEventId(event.target.value)
              }
            >
              <option value="all">All events</option>
              {analytics.map((item) => (
                <option key={item.event?._id} value={item.event?._id}>
                  {item.event?.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        {filteredAnalytics.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            Participant analytics will appear here after registrations begin.
          </div>
        ) : (
          <div className="space-y-5">
            {filteredAnalytics.map((item) => (
              <article
                key={item.event?._id}
                className="rounded-3xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="text-2xl font-bold">
                      {item.event?.title}
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      {formatEventMeta(item.event)}
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      Category: {item.event?.category} | Status:{" "}
                      {getEventStatusConfig(item.event?.status).label}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      className="btn-outline"
                      onClick={() => exportCsv(item.event?._id)}
                    >
                      Export CSV
                    </button>
                    <button
                      className="btn"
                      onClick={() =>
                        setSelectedAnalyticsEventId(item.event?._id)
                      }
                    >
                      Focus Event
                    </button>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                  <OrganizerAnalyticsStat
                    label="Participants"
                    value={item.totals?.participants || 0}
                    hint="Active registrations"
                  />
                  <OrganizerAnalyticsStat
                    label="Registered"
                    value={item.totals?.registered || 0}
                    hint="Not checked in yet"
                  />
                  <OrganizerAnalyticsStat
                    label="Attended"
                    value={item.totals?.attended || 0}
                    hint="Checked in"
                  />
                  <OrganizerAnalyticsStat
                    label="Free"
                    value={item.totals?.free || 0}
                    hint="Free registrations"
                  />
                  <OrganizerAnalyticsStat
                    label="Paid"
                    value={item.totals?.permanent || 0}
                    hint="Permanent bookings"
                  />
                  <OrganizerAnalyticsStat
                    label="Revenue"
                    value={formatCurrency(
                      item.totals?.revenue || 0,
                      item.event?.currency || "INR",
                    )}
                    hint={`${item.totals?.occupancyPercent || 0}% filled`}
                  />
                </div>

                <div className="mt-5">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold">Participants</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Remaining capacity:{" "}
                        {item.totals?.remainingCapacity || 0}
                      </p>
                    </div>
                    <div className="h-3 w-full max-w-xs overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all"
                        style={{
                          width: `${item.totals?.occupancyPercent || 0}%`,
                        }}
                      />
                    </div>
                  </div>

                  {item.participants?.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                      No participants found for this event yet.
                    </div>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2">
                      {item.participants.map((participant) => (
                        <div
                          key={participant._id}
                          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900"
                        >
                          <div className="font-semibold">
                            {participant.user?.name || "Participant"} (
                            {participant.user?.email || "No email"})
                          </div>
                          <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                            {getBookingLabel(participant.bookingType || "free")}{" "}
                            | {participant.bookingReference || "No reference"}
                          </div>
                          <div className="text-sm text-slate-500 dark:text-slate-400">
                            Status: {participant.status}
                          </div>
                          {Number(participant.amount || 0) > 0 ? (
                            <div className="text-sm text-slate-500 dark:text-slate-400">
                              Paid:{" "}
                              {formatCurrency(
                                participant.amount,
                                participant.currency ||
                                  item.event?.currency ||
                                  "INR",
                              )}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_1fr]">
        <form
          onSubmit={createEvent}
          className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <div>
            <h2 className="text-xl font-bold">Submit Event for Approval</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Clicking submit sends your event to the admin review queue. It
              stays hidden from customers until approval.
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-sm text-slate-600 dark:text-slate-300">
              Title
            </label>
            <input
              className="input w-full"
              placeholder="Event title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm text-slate-600 dark:text-slate-300">
              Date and time
            </label>
            <input
              className="input w-full"
              type="datetime-local"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm text-slate-600 dark:text-slate-300">
              Location
            </label>
            <input
              className="input w-full"
              placeholder="Event venue"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm text-slate-600 dark:text-slate-300">
              Category
            </label>
            <select
              className="input w-full"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              <option>Tech</option>
              <option>Sports</option>
              <option>Cultural</option>
              <option>Workshop</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm text-slate-600 dark:text-slate-300">
              Description
            </label>
            <textarea
              className="input min-h-[140px] w-full"
              rows="6"
              placeholder="Describe the event in detail"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm text-slate-600 dark:text-slate-300">
              Permanent booking price (INR)
            </label>
            <input
              className="input w-full"
              min="0"
              placeholder="0"
              step="1"
              type="number"
              value={permanentBookingPrice}
              onChange={(event) => setPermanentBookingPrice(event.target.value)}
            />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Set this to `0` if the event should only allow free registration.
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-sm text-slate-600 dark:text-slate-300">
              Poster
            </label>
            <input
              className="input w-full"
              type="file"
              onChange={(event) => setPoster(event.target.files?.[0] || null)}
            />
          </div>

          <div className="flex justify-end">
            <button className="btn">Send for Approval</button>
          </div>
        </form>

        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4">
              <h2 className="text-xl font-bold">Event Mix</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                A quick view of the categories you are producing.
              </p>
            </div>

            {Object.keys(stats.byCategory).length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-5 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                Category insights will appear after you create events.
              </div>
            ) : (
              <ul className="space-y-2 text-sm">
                {Object.entries(stats.byCategory).map(
                  ([categoryName, count]) => (
                    <li
                      key={categoryName}
                      className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-800"
                    >
                      <span>{categoryName}</span>
                      <span className="font-semibold">{count}</span>
                    </li>
                  ),
                )}
              </ul>
            )}
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4">
              <h2 className="text-xl font-bold">My Events</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Review approval status, customer visibility, and participant
                analytics in one place.
              </p>
            </div>

            {events.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                You have not created any events yet.
              </div>
            ) : (
              <ul className="space-y-3">
                {events.map((event) => {
                  const eventAnalytics = analyticsByEventId.get(event._id);
                  const statusConfig = getEventStatusConfig(event.status);

                  return (
                    <li
                      key={event._id}
                      className="grid gap-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-800 lg:grid-cols-[1fr_auto] lg:items-center"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-lg font-semibold">
                            {event.title}
                          </div>
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${statusConfig.classes}`}
                          >
                            {statusConfig.label}
                          </span>
                        </div>
                        <div className="text-sm text-slate-500 dark:text-slate-400">
                          {statusConfig.description}
                        </div>
                        <div className="text-sm text-slate-500 dark:text-slate-400">
                          {formatEventMeta(event)}
                        </div>
                        <div className="text-sm text-slate-500 dark:text-slate-400">
                          Participants:{" "}
                          {eventAnalytics?.totals?.participants || 0} |
                          Attended: {eventAnalytics?.totals?.attended || 0}
                        </div>
                        <div className="text-sm text-slate-500 dark:text-slate-400">
                          Permanent booking:{" "}
                          {Number(event.permanentBookingPrice || 0) > 0
                            ? formatCurrency(
                                event.permanentBookingPrice,
                                event.currency || "INR",
                              )
                            : "Disabled"}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          className="btn-outline"
                          type="button"
                          onClick={() => focusAnalytics(event._id)}
                        >
                          View Analytics
                        </button>
                        <button
                          className="btn"
                          type="button"
                          onClick={() => exportCsv(event._id)}
                        >
                          Export CSV
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
