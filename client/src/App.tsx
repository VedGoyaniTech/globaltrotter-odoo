import { BrowserRouter, Route, Routes } from 'react-router-dom';

/**
 * Route skeleton only - one route per screen in the brief.
 * Screens live in src/pages and are owned by the frontend/design track.
 */
export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Placeholder name="Login" />} />
        <Route path="/signup" element={<Placeholder name="Signup" />} />
        <Route path="/forgot-password" element={<Placeholder name="Forgot password" />} />

        <Route path="/" element={<Placeholder name="Dashboard" />} />
        <Route path="/trips" element={<Placeholder name="My trips" />} />
        <Route path="/trips/new" element={<Placeholder name="Create trip" />} />
        <Route path="/trips/:tripId" element={<Placeholder name="Itinerary view" />} />
        <Route path="/trips/:tripId/build" element={<Placeholder name="Itinerary builder" />} />
        <Route path="/trips/:tripId/budget" element={<Placeholder name="Budget breakdown" />} />
        <Route path="/trips/:tripId/calendar" element={<Placeholder name="Calendar / timeline" />} />

        <Route path="/cities" element={<Placeholder name="City search" />} />
        <Route path="/activities" element={<Placeholder name="Activity search" />} />
        <Route path="/profile" element={<Placeholder name="Profile / settings" />} />
        <Route path="/admin" element={<Placeholder name="Admin dashboard" />} />

        <Route path="/share/:slug" element={<Placeholder name="Public itinerary" />} />
        <Route path="*" element={<Placeholder name="Not found" />} />
      </Routes>
    </BrowserRouter>
  );
}

function Placeholder({ name }: { name: string }) {
  return <main style={{ padding: 24, fontFamily: 'system-ui' }}>{name} — not built yet</main>;
}
