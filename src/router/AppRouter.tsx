import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { PublicRoute } from './PublicRoute';
import { Loader } from '../components/ui/Loader';
import { useAuthStore } from '../store/useAuthStore';

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
const WorldPage = lazy(() => import('../pages/WorldPage'));

export const AppRouter: React.FC = () => {
  const isUnlocked = useAuthStore((state) => state.isAuthenticated && state.isUnlocked);
  return (
    <Suspense
      fallback={
        isUnlocked ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader text="Loading Ivy..." size="lg" />
          </div>
        ) : (
          // Locked: nothing that gives Ivy away while the timer loads
          <div className="fixed inset-0 z-50 bg-[#FFF4E8]" />
        )
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
          <Route path="/world" element={<WorldPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/chat/info" element={<ChatInfoPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>

        {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to="/chat" replace />} />
      </Routes>
    </Suspense>
  );
};
