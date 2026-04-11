import { useEffect, useState } from 'react';
import axios from 'axios';

function getBookingLabel(bookingType) {
  return bookingType === 'permanent' ? 'Permanent Booking' : 'Free Registration';
}

function formatCurrency(amount, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount || 0);
}

export default function Pass() {
  const [regs, setRegs] = useState([]);

  useEffect(() => {
    (async () => {
      const response = await axios.get('/api/registrations/me');
      setRegs(response.data.registrations || []);
    })();
  }, []);

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">My Passes (offline-ready)</h1>
      <p className="text-sm text-slate-600">Open this page once online; passes will remain available offline.</p>
      <div className="grid gap-3 md:grid-cols-2">
        {regs.map((registration) => (
          <div key={registration._id} className="card">
            <div className="font-semibold">{registration.event?.title}</div>
            <div className="text-sm text-slate-500">
              {new Date(registration.event?.date).toLocaleString()} | {registration.event?.location}
            </div>
            <div className="text-sm text-slate-500">{getBookingLabel(registration.bookingType || 'free')}</div>
            <div className="text-xs text-slate-500">Reference: {registration.bookingReference || 'Assigned automatically'}</div>
            {Number(registration.amount || 0) > 0 ? (
              <div className="text-xs text-slate-500">
                Paid: {formatCurrency(registration.amount, registration.currency || 'INR')}
              </div>
            ) : null}
            {registration.qrCodeDataUrl ? <img src={registration.qrCodeDataUrl} alt="QR" className="mt-2 h-40" /> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
