import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { TravelImage } from '../components/TravelImage';
import { EmptyState, ErrorNotice, LoadingState, PageHeader, SearchBox } from '../components/ui';
import { api } from '../lib/api';
import { travelVisuals } from '../lib/assets';
import type { Activity, City, CountryOption, Paginated } from '../types/api';

export function CitiesPage() {
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get('q') ?? '');
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sort, setSort] = useState('popularity');
  const [country, setCountry] = useState('');
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    Promise.all([
      api.get<CountryOption[]>('/cities/countries'),
      api.get<City[]>('/users/me/saved-destinations'),
    ])
      .then(([countryData, savedData]) => {
        setCountries(countryData);
        setSavedIds(new Set(savedData.map((city) => city.id)));
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError('');
      const search = new URLSearchParams({ limit: '24', sort });
      if (query.trim()) search.set('q', query.trim());
      if (country) search.set('country', country);
      api
        .get<Paginated<City>>(`/cities?${search}`)
        .then((data) => setCities(data.items))
        .catch(() => setError('Destinations are unavailable right now.'))
        .finally(() => setLoading(false));
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          query.trim() ? next.set('q', query.trim()) : next.delete('q');
          return next;
        },
        { replace: true },
      );
    }, 250);
    return () => window.clearTimeout(timer);
  }, [country, query, sort, setParams]);

  const toggleSaved = async (cityId: string) => {
    const isSaved = savedIds.has(cityId);
    setError('');
    try {
      if (isSaved) await api.delete(`/users/me/saved-destinations/${cityId}`);
      else await api.post(`/users/me/saved-destinations/${cityId}`);
      setSavedIds((current) => {
        const next = new Set(current);
        isSaved ? next.delete(cityId) : next.add(cityId);
        return next;
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not update saved places.');
    }
  };

  return (
    <div className="page">
      <PageHeader
        eyebrow="Destination catalogue"
        title="Find a place that moves you"
        description="From iconic cities to quiet corners, discover what belongs in your next story."
        actions={
          <Link className="button button--primary" to="/trips/new">
            <Icon name="plus" /> Plan a trip
          </Link>
        }
      />
      <div className="filter-bar">
        <SearchBox value={query} onChange={setQuery} />
        <div className="filter-bar__controls">
          <label>
            <span className="sr-only">Filter by country</span>
            <select value={country} onChange={(event) => setCountry(event.target.value)}>
              <option value="">All countries</option>
              {countries.map((option) => (
                <option key={option.country} value={option.country}>
                  {option.country} ({option.cities})
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Sort destinations</span>
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="popularity">Most loved</option>
              <option value="name">A–Z</option>
              <option value="costIndex">Best value</option>
            </select>
          </label>
          <Link to="/activities" className="button button--secondary">
            Browse activities
          </Link>
        </div>
      </div>
      {error ? <ErrorNotice message={error} /> : null}
      {loading ? (
        <LoadingState label="Finding remarkable places..." />
      ) : cities.length ? (
        <div className="catalogue-grid">
          {cities.map((city) => (
            <article className="catalogue-card" key={city.id}>
              <div className="catalogue-card__image">
                <TravelImage
                  src={city.imageUrl ?? travelVisuals.city}
                  alt={`${city.name}, ${city.country}`}
                />
                <button
                  type="button"
                  className={`catalogue-card__heart ${savedIds.has(city.id) ? 'catalogue-card__heart--saved' : ''}`}
                  onClick={() => void toggleSaved(city.id)}
                  aria-label={
                    savedIds.has(city.id)
                      ? `Remove ${city.name} from saved places`
                      : `Save ${city.name}`
                  }
                >
                  <Icon name="heart" />
                </button>
                <span>{city.region ?? 'World favourite'}</span>
              </div>
              <div>
                <p className="eyebrow">{city.country}</p>
                <h2>{city.name}</h2>
                <div className="catalogue-card__stats">
                  <span>
                    <Icon name="star" /> {(city.popularity / 20).toFixed(1)}
                  </span>
                  <span>Cost index {city.costIndex}</span>
                </div>
                <Link to={`/activities?cityId=${city.id}`} className="text-link">
                  Explore experiences <Icon name="arrow" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          icon="compass"
          title="No places found"
          description="Try another destination or a broader search."
        />
      )}
    </div>
  );
}

const categoryLabels: Record<string, string> = {
  SIGHTSEEING: 'Sightseeing',
  FOOD: 'Food',
  ADVENTURE: 'Adventure',
  CULTURE: 'Culture',
  NIGHTLIFE: 'Nightlife',
  SHOPPING: 'Shopping',
  NATURE: 'Nature',
  RELAXATION: 'Relaxation',
  TRANSPORT: 'Transport',
  OTHER: 'Other',
};

export function ActivitiesPage() {
  const [params] = useSearchParams();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [maxCost, setMaxCost] = useState('');
  const [maxDuration, setMaxDuration] = useState('');
  const [sort, setSort] = useState('name');
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [addingId, setAddingId] = useState('');
  const categories = useMemo(() => Object.entries(categoryLabels), []);
  const stopId = params.get('stopId');

  const addActivity = async (activity: Activity) => {
    if (!stopId) return;
    setAddingId(activity.id);
    try {
      await api.post(`/trips/${params.get('tripId')}/stops/${stopId}/activities`, {
        activityId: activity.id,
      });
      setAddedIds((current) => new Set(current).add(activity.id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not add this experience.');
    } finally {
      setAddingId('');
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError('');
      const search = new URLSearchParams({ limit: '30' });
      if (query.trim()) search.set('q', query.trim());
      if (category) search.set('category', category);
      if (maxCost) search.set('maxCost', maxCost);
      if (maxDuration) search.set('maxDuration', maxDuration);
      if (sort) search.set('sort', sort);
      if (params.get('cityId')) search.set('cityId', params.get('cityId')!);
      api
        .get<Paginated<Activity>>(`/activities?${search}`)
        .then((data) => setActivities(data.items))
        .catch(() => setError('Experiences are unavailable right now.'))
        .finally(() => setLoading(false));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query, category, maxCost, maxDuration, sort, params]);

  return (
    <div className="page">
      <PageHeader
        eyebrow="Experience catalogue"
        title="Fill your days with wonder"
        description="The moments between destinations are what make a journey unforgettable."
      />
      <div className="filter-bar filter-bar--stack">
        <SearchBox value={query} onChange={setQuery} placeholder="Search experiences..." />
        <div className="experience-filters">
          <label>
            <span>Max cost</span>
            <select value={maxCost} onChange={(event) => setMaxCost(event.target.value)}>
              <option value="">Any budget</option>
              <option value="25">Under $25</option>
              <option value="75">Under $75</option>
              <option value="150">Under $150</option>
            </select>
          </label>
          <label>
            <span>Duration</span>
            <select value={maxDuration} onChange={(event) => setMaxDuration(event.target.value)}>
              <option value="">Any length</option>
              <option value="120">Up to 2 hours</option>
              <option value="240">Up to 4 hours</option>
              <option value="480">Full day</option>
            </select>
          </label>
          <label>
            <span>Sort</span>
            <select value={sort} onChange={(event) => setSort(event.target.value)}>
              <option value="name">Name</option>
              <option value="cost">Lowest cost</option>
              <option value="duration">Shortest first</option>
            </select>
          </label>
        </div>
        <div className="chip-row">
          <button
            type="button"
            className={!category ? 'chip chip--active' : 'chip'}
            onClick={() => setCategory('')}
          >
            All
          </button>
          {categories.map(([value, label]) => (
            <button
              type="button"
              key={value}
              className={category === value ? 'chip chip--active' : 'chip'}
              onClick={() => setCategory(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {error ? <ErrorNotice message={error} /> : null}
      {loading ? (
        <LoadingState label="Curating memorable experiences..." />
      ) : activities.length ? (
        <div className="activity-list">
          {activities.map((activity, index) => (
            <article className="activity-card" key={activity.id}>
              <TravelImage src={activity.imageUrl ?? travelVisuals.activity} alt="" />
              <div className="activity-card__body">
                <div>
                  <span className="category-pill">{categoryLabels[activity.category]}</span>
                  <span className="activity-card__city">
                    <Icon name="pin" /> {activity.city?.name ?? 'Local experience'}
                  </span>
                </div>
                <h2>{activity.name}</h2>
                <p>
                  {activity.description ??
                    'A locally loved experience worth adding to your itinerary.'}
                </p>
                <div className="activity-card__footer">
                  <span>
                    <Icon name="clock" /> {Math.round((activity.durationMinutes / 60) * 10) / 10}{' '}
                    hours
                  </span>
                  <strong>${Number(activity.cost).toFixed(0)}</strong>
                  {stopId ? (
                    <button
                      type="button"
                      className="button button--secondary"
                      disabled={addingId === activity.id || addedIds.has(activity.id)}
                      onClick={() => void addActivity(activity)}
                    >
                      <Icon name="plus" />{' '}
                      {addedIds.has(activity.id)
                        ? 'Added'
                        : addingId === activity.id
                          ? 'Adding…'
                          : 'Add to stop'}
                    </button>
                  ) : (
                    <Link to="/trips" className="button button--secondary">
                      <Icon name="plus" /> Choose trip
                    </Link>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          icon="compass"
          title="No experiences found"
          description="Try a different keyword or category."
        />
      )}
    </div>
  );
}
