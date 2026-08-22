import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom';
import { LoadingState } from './components/ui';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { AppShell } from './layouts/AppShell';
import { AdminPage } from './pages/AdminPage';
import { ForgotPasswordPage, LoginPage, SignupPage } from './pages/AuthPages';
import { CommunityPage, PublicTripPage } from './pages/CommunityPages';
import { DashboardPage } from './pages/DashboardPage';
import { ActivitiesPage, CitiesPage } from './pages/ExplorePages';
import { ProfilePage } from './pages/ProfilePage';
import {
  BudgetPage,
  CalendarHubPage,
  CalendarPage,
  CreateTripPage,
  TripBuilderPage,
  TripDetailPage,
  TripsPage,
} from './pages/TripsPages';

function ProtectedApp() {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <main className="boot-screen">
        <LoadingState label="Opening your travel journal..." />
      </main>
    );
  return user ? <AppShell /> : <Navigate to="/login" replace />;
}

function AdminRoute() {
  const { user } = useAuth();
  return user?.role === 'ADMIN' ? <AdminPage /> : <Navigate to="/" replace />;
}

function NotFoundPage() {
  return (
    <main className="not-found">
      <span>404</span>
      <p className="eyebrow">A delightful detour</p>
      <h1>This road is not on the map.</h1>
      <p>Let’s get you back to a journey we know.</p>
      <Link className="button button--primary" to="/">
        Return home
      </Link>
    </main>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/share/:slug" element={<PublicTripPage />} />
          <Route element={<ProtectedApp />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/trips" element={<TripsPage />} />
            <Route path="/trips/new" element={<CreateTripPage />} />
            <Route path="/trips/:tripId" element={<TripDetailPage />} />
            <Route path="/trips/:tripId/build" element={<TripBuilderPage />} />
            <Route path="/trips/:tripId/budget" element={<BudgetPage />} />
            <Route path="/trips/:tripId/calendar" element={<CalendarPage />} />
            <Route path="/cities" element={<CitiesPage />} />
            <Route path="/activities" element={<ActivitiesPage />} />
            <Route path="/calendar" element={<CalendarHubPage />} />
            <Route path="/community" element={<CommunityPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/admin" element={<AdminRoute />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
