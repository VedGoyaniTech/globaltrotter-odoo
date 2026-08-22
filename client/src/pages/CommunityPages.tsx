import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import {
  Button,
  EmptyState,
  ErrorNotice,
  LoadingState,
  PageHeader,
  SearchBox,
} from '../components/ui';
import { ApiError, api } from '../lib/api';
import { travelFallback, travelVisuals } from '../lib/assets';
import type { PublicTripCard, TimelineDay, Trip } from '../types/api';

type PublicTrip = Trip & { days?: TimelineDay[]; user?: { name: string } };

export function CommunityPage() {
  const [query, setQuery] = useState('');
  const [trips, setTrips] = useState<PublicTripCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const search = new URLSearchParams({ limit: '12', sort: 'recent' });
      if (query.trim()) search.set('q', query.trim());
      setLoading(true);
      setError('');

      try {
        const data = await api.get<{ items: PublicTripCard[] }>(`/public/trips?${search}`, {
          signal: controller.signal,
        });
        setTrips(data.items);
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === 'AbortError') return;
        setError('Community stories could not be refreshed.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 220);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  return (
    <div className="page community-page">
      <PageHeader
        eyebrow="Shared by travelers"
        title="Stories from the road"
        description="Borrow a route, discover a hidden corner, or simply see the world through someone else’s eyes."
      />
      <div className="community-feature">
        <div>
          <p className="eyebrow">Editor’s route of the week</p>
          <h2>
            Portugal,
            <br />
            <em>at the pace of light</em>
          </h2>
          <p>Ten days from tiled lanes in Lisbon to golden evenings in the Douro Valley.</p>
          <a className="button button--primary" href="#shared-journeys">
            Explore the stories <Icon name="arrow" />
          </a>
        </div>
      </div>
      <div className="filter-bar">
        <SearchBox value={query} onChange={setQuery} placeholder="Search stories or places..." />
        <div className="chip-row">
          <span className="chip chip--active">For you</span>
          <span className="chip">Slow travel</span>
          <span className="chip">Food trails</span>
        </div>
      </div>
      {error ? <ErrorNotice message={error} /> : null}
      {loading ? (
        <LoadingState label="Gathering stories from the road..." />
      ) : (
        <div className="story-grid" id="shared-journeys">
          {trips.map((trip, index) => (
            <article className="story-card" key={trip.id}>
              <Link to={`/share/${trip.publicSlug}`}>
                <img src={trip.coverPhotoUrl ?? travelFallback(index)} alt="" />
              </Link>
              <div>
                <p>
                  <Icon name="pin" />{' '}
                  {trip.cities.map((city) => city.name).join(' · ') || 'A shared journey'}
                </p>
                <h2>
                  <Link to={`/share/${trip.publicSlug}`}>{trip.name}</Link>
                </h2>
                <span>
                  {trip.description ??
                    `${trip.stopCount} carefully planned stops, shared to inspire your next journey.`}
                </span>
                <footer>
                  {trip.user.avatarUrl ? (
                    <img className="avatar" src={trip.user.avatarUrl} alt="" />
                  ) : (
                    <div className="avatar">{trip.user.name[0]}</div>
                  )}
                  <strong>{trip.user.name}</strong>
                  <span aria-hidden="true">
                    <Icon name="heart" />
                  </span>
                </footer>
              </div>
            </article>
          ))}
        </div>
      )}
      {!loading && !trips.length ? (
        <EmptyState
          icon="compass"
          title="No stories found"
          description="Try another place or theme."
        />
      ) : null}
    </div>
  );
}

export function PublicTripPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [trip, setTrip] = useState<PublicTrip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copying, setCopying] = useState(false);

  useEffect(() => {
    if (!slug) {
      setError('This shared journey is private or no longer available.');
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    api
      .get<PublicTrip>(`/public/trips/${slug}`, { signal: controller.signal })
      .then(setTrip)
      .catch((caught) => {
        if (!(caught instanceof DOMException && caught.name === 'AbortError'))
          setError('This shared journey is private or no longer available.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [slug]);

  const copyTrip = async () => {
    if (!slug) return;
    setCopying(true);
    try {
      const copied = await api.post<Trip>(`/public/trips/${slug}/copy`);
      navigate(`/trips/${copied.id}`);
    } catch (caught) {
      setError(
        caught instanceof ApiError && caught.status === 401
          ? 'Sign in first to copy this itinerary.'
          : 'Could not copy this trip.',
      );
    } finally {
      setCopying(false);
    }
  };

  if (loading)
    return (
      <main className="public-page">
        <LoadingState />
      </main>
    );
  if (!trip)
    return (
      <main className="public-page">
        <ErrorNotice message={error} />
      </main>
    );

  return (
    <main className="public-page">
      <nav className="public-nav">
        <Link className="brand" to="/">
          <span className="brand__mark">G</span>GlobeTrotter
        </Link>
        <div>
          <Link to="/login">Sign in</Link>
          <Link className="button button--primary" to="/signup">
            Plan your own
          </Link>
        </div>
      </nav>
      <header
        className="public-hero"
        style={{
          backgroundImage: `linear-gradient(180deg, rgba(12,28,27,.05), rgba(12,28,27,.85)), url(${trip.coverPhotoUrl ?? travelVisuals.coast})`,
        }}
      >
        <div>
          <p className="eyebrow">A shared GlobeTrotter journey</p>
          <h1>{trip.name}</h1>
          <p>{trip.description}</p>
          <span>
            <Icon name="calendar" /> {trip.startDate} – {trip.endDate} · {trip.stops.length} stops
          </span>
        </div>
      </header>
      <section className="public-content">
        {error ? <ErrorNotice message={error} /> : null}
        <div className="public-content__heading">
          <div>
            <p className="eyebrow">The route</p>
            <h2>A journey worth borrowing</h2>
          </div>
          <Button onClick={copyTrip} disabled={copying}>
            {copying ? 'Copying…' : 'Copy this itinerary'} <Icon name="plus" />
          </Button>
        </div>
        <div className="public-route">
          {trip.stops.map((stop, index) => (
            <article key={stop.id}>
              <span>{index + 1}</span>
              <div>
                <p>
                  {stop.startDate} – {stop.endDate}
                </p>
                <h3>
                  {stop.city.name}, {stop.city.country}
                </h3>
                <p>{stop.notes}</p>
                <div>
                  {stop.activities.map((activity) => (
                    <span key={activity.id}>
                      {activity.startTime ?? 'Anytime'} · {activity.name}
                    </span>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
