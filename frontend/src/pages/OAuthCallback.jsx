import { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function OAuthCallback() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function complete() {
      const token = params.get('token');
      if (!token) {
        setError('Google sign-in did not return a valid session.');
        return;
      }
      try {
        const response = await axios.get('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled) return;
        login({ token, user: response.data.user });
        navigate('/dashboard', { replace: true });
      } catch (requestError) {
        if (!cancelled) setError(requestError.response?.data?.message || 'Unable to complete Google sign-in.');
      }
    }
    void complete();
    return () => { cancelled = true; };
  }, [login, navigate, params]);

  return (
    <div className="max-w-md mx-auto space-y-4">
      <h1 className="font-bold text-xl">Signing you in...</h1>
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
    </div>
  );
}
