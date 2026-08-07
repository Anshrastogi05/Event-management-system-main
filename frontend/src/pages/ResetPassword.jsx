import { useEffect, useState } from 'react';
import axios from 'axios';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [checking, setChecking] = useState(Boolean(token));
  const [validToken, setValidToken] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    axios.get(`/api/auth/reset-password/verify/${encodeURIComponent(token)}`)
      .then((res) => {
        if (cancelled) return;
        setValidToken(true);
        setMessage(res.data?.message || 'Reset link verified.');
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.message || 'This reset link is invalid or has expired.');
      })
      .finally(() => { if (!cancelled) setChecking(false); });
    return () => { cancelled = true; };
  }, [token]);

  async function submitRequest(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    if (!email.trim()) return setError('Please enter your email address.');
    setSubmitting(true);
    try {
      const res = await axios.post('/api/auth/forgot-password', { email });
      setMessage(res.data?.message || 'If an account exists for that email, a reset link has been sent.');
      // Development responses may expose a local reset URL for testing.
      if (res.data?.resetUrl) window.history.replaceState({}, '', res.data.resetUrl);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to send reset email.');
    } finally { setSubmitting(false); }
  }

  async function submitPassword(e) {
    e.preventDefault();
    setError('');
    if (password.length < 6) return setError('Password must be at least 6 characters.');
    if (password !== confirmPassword) return setError('Passwords do not match.');
    setSubmitting(true);
    try {
      const res = await axios.post('/api/auth/reset-password', { token, password });
      navigate('/login', { replace: true, state: { message: res.data?.message || 'Password reset successful. Please log in.' } });
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to reset password.');
    } finally { setSubmitting(false); }
  }

  if (checking) {
    return <div className="max-w-md mx-auto space-y-4"><h1 className="font-bold text-xl">Reset password</h1><div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">Verifying your reset link...</div></div>;
  }

  return (
    <div className="max-w-md mx-auto space-y-4">
      <div className="space-y-2">
        <h1 className="font-bold text-xl">{validToken ? 'Set a new password' : 'Reset password'}</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {validToken ? 'Choose a new password for your account.' : 'Enter your email and we will send you a secure reset link.'}
        </p>
      </div>
      {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {validToken ? (
        <form onSubmit={submitPassword} className="space-y-3">
          <input className="input w-full" placeholder="New password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <input className="input w-full" placeholder="Confirm new password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          <button className="btn w-full" disabled={submitting} type="submit">{submitting ? 'Resetting password...' : 'Set new password'}</button>
        </form>
      ) : (
        <form onSubmit={submitRequest} className="space-y-3">
          <input className="input w-full" placeholder="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className="btn w-full" disabled={submitting} type="submit">{submitting ? 'Sending link...' : 'Send reset link'}</button>
        </form>
      )}
      <div className="text-sm text-slate-600 dark:text-slate-300">Back to <Link to="/login" className="underline">login</Link></div>
    </div>
  );
}
