import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { EmptyState, ErrorNotice, LoadingState, PageHeader, SearchBox } from '../components/ui';
import { api } from '../lib/api';
import type { Activity, City, Paginated } from '../types/api';

const cityFallback = 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80';
const activityFallback = 'https://images.unsplash.com/photo-1530789253388-582c481c54b0?auto=format&fit=crop&w=900&q=80';

export function CitiesPage() {
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get('q') ?? '');
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sort, setSort] = useState('popularity');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLoading(true); setError('');
      const search = new URLSearchParams({ limit: '24', sort });
      if (query.trim()) search.set('q', query.trim());
      api.get<Paginated<City>>(`/cities?${search}`).then((data) => setCities(data.items)).catch(() => setError('Destinations are unavailable right now.')).finally(() => setLoading(false));
      setParams((current) => { const next = new URLSearchParams(current); query.trim() ? next.set('q', query.trim()) : next.delete('q'); return next; }, { replace: true });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query, sort, setParams]);

  return <div className="page">
    <PageHeader eyebrow="Destination catalogue" title="Find a place that moves you" description="From iconic cities to quiet corners, discover what belongs in your next story." actions={<Link className="button button--primary" to="/trips/new"><Icon name="plus" /> Plan a trip</Link>} />
    <div className="filter-bar"><SearchBox value={query} onChange={setQuery} /><div className="filter-bar__controls"><label><span className="sr-only">Sort destinations</span><select value={sort} onChange={(e) => setSort(e.target.value)}><option value="popularity">Most loved</option><option value="name">A–Z</option><option value="costIndex">Best value</option></select></label><Link to="/activities" className="button button--secondary">Browse activities</Link></div></div>
    {error ? <ErrorNotice message={error} /> : null}
    {loading ? <LoadingState label="Finding remarkable places..." /> : cities.length ? <div className="catalogue-grid">{cities.map((city) => <article className="catalogue-card" key={city.id}><div className="catalogue-card__image"><img src={city.imageUrl ?? cityFallback} alt={`${city.name}, ${city.country}`} /><span className="catalogue-card__heart" aria-hidden="true"><Icon name="heart" /></span><span>{city.region ?? 'World favourite'}</span></div><div><p className="eyebrow">{city.country}</p><h2>{city.name}</h2><div className="catalogue-card__stats"><span><Icon name="star" /> {(city.popularity / 20).toFixed(1)}</span><span>Cost index {city.costIndex}</span></div><Link to={`/activities?cityId=${city.id}`} className="text-link">Explore experiences <Icon name="arrow" /></Link></div></article>)}</div> : <EmptyState icon="compass" title="No places found" description="Try another destination or a broader search." />}
  </div>;
}

const categoryLabels: Record<string, string> = { SIGHTSEEING: 'Sightseeing', FOOD: 'Food', ADVENTURE: 'Adventure', CULTURE: 'Culture', NIGHTLIFE: 'Nightlife', SHOPPING: 'Shopping', NATURE: 'Nature', RELAXATION: 'Relaxation', TRANSPORT: 'Transport', OTHER: 'Other' };

export function ActivitiesPage() {
  const [params] = useSearchParams();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const categories = useMemo(() => Object.entries(categoryLabels), []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLoading(true); setError('');
      const search = new URLSearchParams({ limit: '30' });
      if (query.trim()) search.set('q', query.trim());
      if (category) search.set('category', category);
      if (params.get('cityId')) search.set('cityId', params.get('cityId')!);
      api.get<Paginated<Activity>>(`/activities?${search}`).then((data) => setActivities(data.items)).catch(() => setError('Experiences are unavailable right now.')).finally(() => setLoading(false));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query, category, params]);

  return <div className="page">
    <PageHeader eyebrow="Experience catalogue" title="Fill your days with wonder" description="The moments between destinations are what make a journey unforgettable." />
    <div className="filter-bar filter-bar--stack"><SearchBox value={query} onChange={setQuery} placeholder="Search experiences..." /><div className="chip-row"><button type="button" className={!category ? 'chip chip--active' : 'chip'} onClick={() => setCategory('')}>All</button>{categories.map(([value, label]) => <button type="button" key={value} className={category === value ? 'chip chip--active' : 'chip'} onClick={() => setCategory(value)}>{label}</button>)}</div></div>
    {error ? <ErrorNotice message={error} /> : null}
    {loading ? <LoadingState label="Curating memorable experiences..." /> : activities.length ? <div className="activity-list">{activities.map((activity, index) => <article className="activity-card" key={activity.id}><img src={activity.imageUrl ?? `${activityFallback}&sig=${index}`} alt="" /><div className="activity-card__body"><div><span className="category-pill">{categoryLabels[activity.category]}</span><span className="activity-card__city"><Icon name="pin" /> {activity.city?.name ?? 'Local experience'}</span></div><h2>{activity.name}</h2><p>{activity.description ?? 'A locally loved experience worth adding to your itinerary.'}</p><div className="activity-card__footer"><span><Icon name="clock" /> {Math.round(activity.durationMinutes / 60 * 10) / 10} hours</span><strong>${Number(activity.cost).toFixed(0)}</strong><Link to="/trips" className="button button--secondary"><Icon name="plus" /> Choose trip</Link></div></div></article>)}</div> : <EmptyState icon="compass" title="No experiences found" description="Try a different keyword or category." />}
  </div>;
}
