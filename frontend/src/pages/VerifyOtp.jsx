import { useState } from 'react';
import axios from 'axios';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function VerifyOtp() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialPendingToken = searchParams.get('token') || '';
  const email = searchParams.get('email') || '';
  const purpose = searchParams.get('purpose') || 'login';

  const [otp, setOtp] = useState('');
  const [pendingAuthToken, setPendingAuthToken] = useState(initialPendingToken);
  const [error, setError] = useState('');
  const [message, setMessage] = useState(
    location.state?.message ||
    purpose === 'signup'
      ? 'Enter the OTP sent to your email to verify your account.'
      : 'Enter the OTP sent to your email to complete login.'
  );
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const res = await axios.post('/api/auth/otp/verify', {
        pendingAuthToken,
        otp,
      });
      login(res.data);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'OTP verification failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function resendOtp() {
    setError('');
    setResending(true);

    try {
      const res = await axios.post('/api/auth/otp/resend', { pendingAuthToken });
      const nextToken = res.data?.pendingAuthToken || pendingAuthToken;

      setPendingAuthToken(nextToken);
      setMessage(res.data?.message || 'A new OTP has been sent to your email address.');

      setSearchParams({
        token: nextToken,
        email: res.data?.email || email,
        purpose: res.data?.purpose || purpose,
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to resend OTP');
    } finally {
      setResending(false);
    }
  }

  if (!pendingAuthToken) {
    return (
      <div className="max-w-md mx-auto space-y-4">
        <h1 className="font-bold text-xl">Verify OTP</h1>
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
          OTP session is missing or expired. Please start the auth flow again.
        </div>
        <div className="text-sm text-slate-600 dark:text-slate-300">
          Go to <Link to="/login" className="underline">login</Link> or{' '}
          <Link to="/signup" className="underline">signup</Link>.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto space-y-4">
      <div className="space-y-2">
        <h1 className="font-bold text-xl">
          {purpose === 'signup' ? 'Verify your email' : 'Login OTP'}
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {email ? `We sent a 6-digit OTP to ${email}.` : 'Enter the OTP sent to your email.'}
        </p>
      </div>

      {message && (
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-200">
          {message}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      )}

      <form onSubmit={submit} className="space-y-3">
        <input
          className="input w-full text-center tracking-[0.45em] font-semibold"
          inputMode="numeric"
          maxLength={6}
          placeholder="000000"
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
        />
        <button className="btn w-full" disabled={submitting} type="submit">
          {submitting ? 'Verifying OTP...' : 'Verify OTP'}
        </button>
      </form>

      <button
        className="btn-outline w-full"
        disabled={resending}
        onClick={resendOtp}
        type="button"
      >
        {resending ? 'Sending new OTP...' : 'Resend OTP'}
      </button>

      <div className="text-sm text-slate-600 dark:text-slate-300">
        Back to <Link to="/login" className="underline">login</Link>
      </div>
    </div>
  );
}
