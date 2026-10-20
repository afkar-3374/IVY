import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { PublicRoute } from './PublicRoute';
import { Loader } from '../components/ui/Loader';

const LoginPage = lazy(() => import('../pages/LoginPage'));
const ChatPage = lazy(() => import('../pages/ChatPage'));
const ChatInfoPage = lazy(() => import('../pages/ChatInfoPage'));
const SearchPage = lazy(() => import('../pages/SearchPage'));
const ProfilePage = lazy(() => import('../pages/ProfilePage'));
const SettingsPage = lazy(() => import('../pages/SettingsPage'));
const UsPage = lazy(() => import('../pages/UsPage'));
const LovePage = lazy(() => import('../pages/LovePage'));
const PlayPage = lazy(() => import('../pages/PlayPage'));
const GardenPage = lazy(() => import('../pages/GardenPage'));

export const AppRouter: React.FC = () => {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center">
          <Loader text="Loading Ivy..." size="lg" />
        </div>
      }
    >
      <Routes>
        {/* Public Routes */}
        <Route element={<PublicRoute />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>

        {/* Protected Routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/us" element={<UsPage />} />
          <Route path="/love" element={<LovePage />} />
          <Route path="/play" element={<PlayPage />} />
          <Route path="/garden" element={<GardenPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/chat/info" element={<ChatInfoPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>

        {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to="/us" replace />} />
      </Routes>
    </Suspense>
  );
};
