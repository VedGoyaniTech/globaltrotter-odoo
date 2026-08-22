import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { EmptyState, ErrorNotice, LoadingState, PageHeader, SearchBox } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';
import { travelFallback, travelVisuals } from '../lib/assets';
import type { City, Paginated, TripListItem } from '../types/api';

function formatDateRange(trip: TripListItem) {
  const start = new Date(`${trip.startDate}T00:00:00`);
  const end = new Date(`${trip.endDate}T00:00:00`);
  return `${start.toLocaleDateString('en', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [trips, setTrips] = useState<TripListItem[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([
      api.get<Paginated<TripListItem>>('/trips?limit=4'),
      api.get<Paginated<City>>('/cities?sort=popularity&limit=4'),
    ])
      .then(([tripData, cityData]) => {
        if (active) {
          setTrips(tripData.items);
          setCities(cityData.items);
        }
      })
      .catch(
        () =>
          active &&
          setError('We could not refresh your travel board. Make sure the API is running.'),
      )
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const submitSearch = () => {
    if (search.trim()) navigate(`/cities?q=${encodeURIComponent(search.trim())}`);
  };

  if (loading)
    return (
      <div className="page">
        <LoadingState />
      </div>
    );

  return (
    <div className="page dashboard-page">
      <PageHeader
        eyebrow="Travel dashboard"
        title={`Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, ${user?.name.split(' ')[0] ?? 'traveler'} 👋`}
        description="Where will your curiosity take you next?"
        actions={
          <Link to="/trips/new" className="button button--primary">
            <Icon name="plus" /> Plan a trip
          </Link>
        }
      />
      {error ? <ErrorNotice message={error} /> : null}
      <section
        className="hero-card"
        style={{
          backgroundImage: `linear-gradient(90deg, rgba(15,40,38,.88), rgba(15,40,38,.18)), url(${travelVisuals.coast})`,
        }}
      >
        <div className="hero-card__content">
          <p className="eyebrow">The world is waiting</p>
          <h2>
            Turn someday into
            <br />
            <em>your next story.</em>
          </h2>
          <p>Discover remarkable places and shape an itinerary that feels entirely yours.</p>
          <div className="hero-search">
            <SearchBox value={search} onChange={setSearch} placeholder="Where do you want to go?" />
            <button type="button" onClick={submitSearch} aria-label="Search destinations">
              <Icon name="arrow" />
            </button>
          </div>
        </div>
        <div className="hero-card__stamp">
          <span>EST.</span>
          <strong>2026</strong>
          <span>WANDER OFTEN</span>
        </div>
      </section>
      <section className="content-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Curated for you</p>
            <h2>Places worth the detour</h2>
          </div>
          <Link to="/cities">
            Explore all <Icon name="arrow" />
          </Link>
        </div>
        <div className="destination-grid">
          {cities.map((city, index) => (
            <Link to={`/cities?city=${city.id}`} className="destination-card" key={city.id}>
              <img src={city.imageUrl ?? travelFallback(index)} alt="" />
              <span className="destination-card__save">
                <Icon name="heart" />
              </span>
              <div>
                <span>{city.country}</span>
                <h3>{city.name}</h3>
                <p>
                  <Icon name="star" /> {Math.max(4.4, Math.min(5, city.popularity / 20)).toFixed(1)}{' '}
                  ·{' '}
                  {city.costIndex < 40
                    ? 'Easy on budget'
                    : city.costIndex < 70
                      ? 'Mid-range'
                      : 'Premium'}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>
      <section className="content-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Back to the adventure</p>
            <h2>Your recent journeys</h2>
          </div>
          <Link to="/trips">
            View all trips <Icon name="arrow" />
          </Link>
        </div>
        {trips.length ? (
          <div className="trip-row">
            {trips.map((trip, index) => (
              <Link className="journey-card" to={`/trips/${trip.id}`} key={trip.id}>
                <div className="journey-card__image">
                  <img src={trip.coverPhotoUrl ?? travelFallback(index + 1)} alt="" />
                  <span>{new Date(trip.endDate) < new Date() ? 'Travelled' : 'Upcoming'}</span>
                </div>
                <div>
                  <p>
                    <Icon name="pin" />{' '}
                    {trip.stops.map((stop) => stop.city.name).join(' · ') || 'A new journey'}
                  </p>
                  <h3>{trip.name}</h3>
                  <span>{formatDateRange(trip)}</span>
                  <div className="journey-card__meta">
                    <span>{trip.stops.length} stops</span>
                    <span>
                      {trip.stops.reduce((sum, stop) => sum + (stop.activities?.length ?? 0), 0)}{' '}
                      experiences
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Your first story starts here"
            description="Build a thoughtful multi-city itinerary in just a few minutes."
            action={
              <Link className="button button--primary" to="/trips/new">
                Plan your first trip
              </Link>
            }
          />
        )}
      </section>
    </div>
  );
}
