import { Navigate } from 'react-router-dom';

// Keep the old URL working while the complete flow lives on the dedicated page.
export default function ForgotPassword() {
  return <Navigate to="/reset-password" replace />;
}
