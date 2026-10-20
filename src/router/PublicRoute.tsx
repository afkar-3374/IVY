import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';

export const PublicRoute: React.FC = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated && state.isUnlocked);

  if (isAuthenticated) {
    return <Navigate to="/us" replace />;
  }

  return <Outlet />;
};
