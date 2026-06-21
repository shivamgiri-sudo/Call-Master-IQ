import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import LoadingSkeleton from '../components/states/LoadingSkeleton';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { token, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingSkeleton rows={4} />;

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
