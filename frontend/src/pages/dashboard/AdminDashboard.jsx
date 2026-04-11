import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext.jsx';
import DashboardHeader from '../../components/dashboard/DashboardHeader.jsx';
import DashboardStatCard from '../../components/dashboard/DashboardStatCard.jsx';
import DashboardToast from '../../components/dashboard/DashboardToast.jsx';
import DashboardUserModal from '../../components/dashboard/DashboardUserModal.jsx';

export default function AdminDashboard() {
  const { user, logout, token } = useAuth();
  const [pendingEvents, setPendingEvents] = useState([]);
  const [movieShows, setMovieShows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [selectedPosterFiles, setSelectedPosterFiles] = useState({});
  const [uploadingPosterId, setUploadingPosterId] = useState('');
  const [userModal, setUserModal] = useState({
    open: false,
    title: '',
    description: '',
    users: [],
    loading: false,
  });
  const [toast, setToast] = useState({ open: false, type: 'info', message: '' });

  const showToast = (type, message) => {
    setToast({ open: true, type, message });
    setTimeout(() => setToast({ open: false, type: 'info', message: '' }), 3000);
  };

  function getAdminRequestConfig() {
    return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
  }

  useEffect(() => {
    if (!user || !token) return;
    void loadDashboard();
  }, [token, user]);

  async function loadDashboard() {
    try {
      const response = await axios.get('/api/admin/dashboard', getAdminRequestConfig());
      const warnings = response.data?.warnings || [];

      setPendingEvents(response.data?.pendingEvents || []);
      setSummary(response.data?.summary || null);
      setMovieShows(response.data?.movieShows || []);

      if (warnings.length > 0) {
        showToast('warning', 'Some dashboard sections could not be loaded completely.');
      }
    } catch (error) {
      showToast('error', error.response?.data?.message || 'Unable to load the admin dashboard.');
    }
  }

  async function approveEvent(eventId) {
    try {
      await axios.post(`/api/admin/events/${eventId}/approve`, null, getAdminRequestConfig());
      await loadDashboard();
      showToast('success', 'Event approved successfully.');
    } catch (error) {
      showToast('error', error.response?.data?.message || 'Unable to approve this event.');
    }
  }

  async function rejectEvent(eventId) {
    try {
      await axios.post(`/api/admin/events/${eventId}/reject`, null, getAdminRequestConfig());
      await loadDashboard();
      showToast('success', 'Event rejected successfully.');
    } catch (error) {
      showToast('error', error.response?.data?.message || 'Unable to reject this event.');
    }
  }

  async function uploadMoviePoster(showId) {
    const posterFile = selectedPosterFiles[showId];
    if (!posterFile) {
      showToast('info', 'Choose an image before uploading.');
      return;
    }

    setUploadingPosterId(showId);

    try {
      const formData = new FormData();
      formData.append('poster', posterFile);

      const response = await axios.put(
        `/api/tickets/shows/${showId}/poster`,
        formData,
        getAdminRequestConfig()
      );
      setSelectedPosterFiles((current) => {
        const next = { ...current };
        delete next[showId];
        return next;
      });
      await loadDashboard();
      showToast('success', response.data?.message || 'Movie poster updated successfully.');
    } catch (error) {
      showToast('error', error.response?.data?.message || 'Unable to upload this movie poster.');
    } finally {
      setUploadingPosterId('');
    }
  }

  async function openUserModal(scope) {
    const modalMeta =
      scope === 'registrations'
        ? {
            title: 'Registration Participants',
            description: 'Participants and the events they are registered for.',
          }
        : {
            title: 'Active Users',
            description: 'Customers and organizers who currently have access.',
          };

    setUserModal({
      open: true,
      title: modalMeta.title,
      description: modalMeta.description,
      users: [],
      loading: true,
    });

    try {
      const response = await axios.get('/api/admin/users', {
        ...getAdminRequestConfig(),
        params: { scope },
      });

      setUserModal({
        open: true,
        title: response.data?.title || modalMeta.title,
        description: response.data?.description || modalMeta.description,
        users: response.data?.users || [],
        loading: false,
      });
    } catch (error) {
      setUserModal((current) => ({
        ...current,
        loading: false,
      }));
      showToast('error', error.response?.data?.message || 'Unable to load the user list.');
    }
  }

  function closeUserModal() {
    setUserModal((current) => ({
      ...current,
      open: false,
      loading: false,
    }));
  }

  const stats = useMemo(() => {
    const totals = summary || {};
    return {
      totalEvents: totals.events || 0,
      approvedEvents: totals.approvedEvents || 0,
      registrations: totals.registrations || 0,
      activeUsers: (totals.customers || 0) + (totals.organizers || 0),
      pendingApprovals: pendingEvents.length,
    };
  }, [pendingEvents, summary]);

  return (
    <div className="space-y-6">
      <DashboardToast toast={toast} />
      <DashboardUserModal
        open={userModal.open}
        title={userModal.title}
        description={userModal.description}
        users={userModal.users}
        loading={userModal.loading}
        onClose={closeUserModal}
      />

      <DashboardHeader
        title="Platform control center"
        subtitle="Review pending events, keep the catalog healthy, and monitor key activity across the platform."
        user={user}
        onLogout={logout}
        actions={
          <button className="btn-outline" onClick={loadDashboard}>
            Refresh Overview
          </button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <DashboardStatCard label="Total Events" value={stats.totalEvents} hint="All submitted events" />
        <DashboardStatCard label="Approved" value={stats.approvedEvents} hint="Visible to attendees" />
        <DashboardStatCard
          label="Registrations"
          value={stats.registrations}
          hint="Platform-wide bookings"
          actionLabel="View users"
          onClick={() => openUserModal('registrations')}
        />
        <DashboardStatCard
          label="Active Users"
          value={stats.activeUsers}
          hint="Customers and organizers"
          actionLabel="View users"
          onClick={() => openUserModal('active')}
        />
        <DashboardStatCard label="Pending Review" value={stats.pendingApprovals} hint="Awaiting approval" />
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4">
          <h2 className="text-xl font-bold">Movie Poster Library</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Upload or replace the poster for any movie. One upload updates that title across all of its showtimes.
          </p>
        </div>

        {movieShows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            No movie shows are available yet.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {movieShows.map((movie) => {
              const selectedFile = selectedPosterFiles[movie._id];
              const isUploading = uploadingPosterId === movie._id;

              return (
                <div
                  key={movie._id}
                  className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950"
                >
                  <img
                    src={movie.posterUrl || '/placeholder.svg'}
                    alt={movie.title}
                    className="h-56 w-full object-cover"
                  />

                  <div className="space-y-4 p-5">
                    <div>
                      <div className="text-xl font-bold">{movie.title}</div>
                      <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        {movie.subtitle}
                      </div>
                      <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                        {movie.venue}, {movie.city}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-900">
                      <div className="font-semibold">Current poster path</div>
                      <div className="mt-1 break-all text-slate-500 dark:text-slate-400">
                        {movie.posterUrl || 'No poster uploaded yet'}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                        Upload movie picture
                      </label>
                      <input
                        className="input w-full"
                        type="file"
                        accept="image/*"
                        onChange={(event) =>
                          setSelectedPosterFiles((current) => ({
                            ...current,
                            [movie._id]: event.target.files?.[0] || null,
                          }))
                        }
                      />
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {selectedFile ? `Selected: ${selectedFile.name}` : 'Choose a JPG, PNG, or WebP image.'}
                      </div>
                    </div>

                    <button
                      className="btn w-full"
                      onClick={() => uploadMoviePoster(movie._id)}
                      disabled={!selectedFile || isUploading}
                    >
                      {isUploading ? 'Uploading poster...' : 'Upload poster'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4">
          <h2 className="text-xl font-bold">Pending Events</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Approve or reject new submissions from organizers.</p>
        </div>

        {pendingEvents.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            No events are waiting for approval right now.
          </div>
        ) : (
          <ul className="space-y-3">
            {pendingEvents.map((event) => (
              <li key={event._id} className="grid gap-4 rounded-2xl border border-slate-200 p-4 dark:border-slate-800 lg:grid-cols-[1fr_auto] lg:items-center">
                <div className="space-y-1">
                  <div className="text-lg font-semibold">{event.title}</div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    Organizer: {event.organizer?.name || 'Unknown'}
                  </div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    {new Date(event.date).toLocaleDateString()} | {event.location}
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300">{event.description}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button className="btn" onClick={() => approveEvent(event._id)}>
                    Approve
                  </button>
                  <button className="btn-outline" onClick={() => rejectEvent(event._id)}>
                    Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
