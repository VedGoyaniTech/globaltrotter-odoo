import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import {
  Button,
  EmptyState,
  ErrorNotice,
  Field,
  LoadingState,
  PageHeader,
  SearchBox,
  SelectField,
  TextareaField,
} from '../components/ui';
import { ApiError, api } from '../lib/api';
import { travelFallback, travelVisuals } from '../lib/assets';
import type {
  BudgetBreakdown,
  City,
  ExpenseCategory,
  Paginated,
  TimelineDay,
  Trip,
  TripListItem,
} from '../types/api';

const money = (value: string | number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number(value));
const dayCount = (start: string, end: string) =>
  Math.max(1, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86_400_000) + 1);
const readableDate = (date: string) =>
  new Date(`${date.slice(0, 10)}T00:00:00`).toLocaleDateString('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

function TripStatus({ trip }: { trip: Pick<Trip, 'startDate' | 'endDate'> }) {
  const now = new Date();
  const start = new Date(`${trip.startDate}T00:00:00`);
  const end = new Date(`${trip.endDate}T23:59:59`);
  const status = now < start ? 'Upcoming' : now > end ? 'Memories' : 'On the road';
  return (
    <span className={`status status--${status.toLowerCase().replaceAll(' ', '-')}`}>{status}</span>
  );
}

export function TripsPage() {
  const [trips, setTrips] = useState<TripListItem[]>([]);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError('');
      const search = new URLSearchParams({ limit: '40', filter });
      if (query.trim()) search.set('q', query.trim());
      api
        .get<Paginated<TripListItem>>(`/trips?${search}`)
        .then((data) => setTrips(data.items))
        .catch(() => setError('We could not load your trips.'))
        .finally(() => setLoading(false));
    }, 220);
    return () => window.clearTimeout(timer);
  }, [filter, query]);

  return (
    <div className="page">
      <PageHeader
        eyebrow="Your travel archive"
        title="Journeys, past and future"
        description="Every plan in one place, from the first spark to the stories you bring home."
        actions={
          <Link className="button button--primary" to="/trips/new">
            <Icon name="plus" /> New journey
          </Link>
        }
      />
      <div className="filter-bar">
        <SearchBox value={query} onChange={setQuery} placeholder="Search your trips..." />
        <div className="segmented" role="group" aria-label="Filter trips">
          {['all', 'upcoming', 'past'].map((value) => (
            <button
              type="button"
              key={value}
              className={filter === value ? 'active' : ''}
              onClick={() => setFilter(value)}
            >
              {value === 'past' ? 'Memories' : value[0].toUpperCase() + value.slice(1)}
            </button>
          ))}
        </div>
      </div>
      {error ? <ErrorNotice message={error} /> : null}
      {loading ? (
        <LoadingState label="Opening your travel journal..." />
      ) : trips.length ? (
        <div className="trips-grid">
          {trips.map((trip, index) => (
            <article className="trip-card" key={trip.id}>
              <Link to={`/trips/${trip.id}`} className="trip-card__image">
                <img src={trip.coverPhotoUrl ?? travelFallback(index)} alt="" />
                <TripStatus trip={trip} />
                <span className="trip-card__days">
                  {dayCount(trip.startDate, trip.endDate)} days
                </span>
              </Link>
              <div className="trip-card__body">
                <p>
                  <Icon name="pin" />{' '}
                  {trip.stops.map((stop) => stop.city.name).join(' → ') || 'Itinerary in progress'}
                </p>
                <h2>
                  <Link to={`/trips/${trip.id}`}>{trip.name}</Link>
                </h2>
                <span>
                  {readableDate(trip.startDate)} – {readableDate(trip.endDate)}
                </span>
                <div className="trip-card__footer">
                  <span>{trip.stops.length} cities</span>
                  <span>
                    {trip.stops.reduce((sum, stop) => sum + (stop.activities?.length ?? 0), 0)}{' '}
                    plans
                  </span>
                  <Link to={`/trips/${trip.id}/build`}>
                    Edit <Icon name="arrow" />
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title="A blank passport page"
          description="Your journeys will live here. Start with a place you cannot stop thinking about."
          action={
            <Link className="button button--primary" to="/trips/new">
              Plan a journey
            </Link>
          }
        />
      )}
    </div>
  );
}

export function CreateTripPage() {
  const navigate = useNavigate();
  const [cities, setCities] = useState<City[]>([]);
  const [form, setForm] = useState({
    name: '',
    description: '',
    startDate: '',
    endDate: '',
    budgetLimit: '',
    cityId: '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api
      .get<Paginated<City>>('/cities?sort=popularity&limit=50')
      .then((data) => setCities(data.items))
      .catch(() => setError('City suggestions could not be loaded.'));
  }, []);
  const update = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const trip = await api.post<Trip>('/trips', {
        name: form.name,
        description: form.description || undefined,
        startDate: form.startDate,
        endDate: form.endDate,
        budgetLimit: form.budgetLimit ? Number(form.budgetLimit) : undefined,
      });
      if (form.cityId)
        await api.post(`/trips/${trip.id}/stops`, {
          cityId: form.cityId,
          startDate: form.startDate,
          endDate: form.endDate,
        });
      navigate(`/trips/${trip.id}/build`);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not create this trip.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page create-trip-page">
      <Link className="back-link" to="/trips">
        ← Back to journeys
      </Link>
      <div className="create-trip-grid">
        <section>
          <p className="eyebrow">A new chapter</p>
          <h1>Where will your story begin?</h1>
          <p className="lead">
            Give us the essentials. You can shape every detail and add experiences in the next step.
          </p>
          <form className="planner-form" onSubmit={submit}>
            {error ? <ErrorNotice message={error} /> : null}
            <Field
              label="Name your journey"
              placeholder="e.g. A slow summer in Italy"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              required
            />
            <TextareaField
              label="What is the feeling?"
              placeholder="A little context makes every plan more personal..."
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              rows={4}
            />
            <div className="field-grid">
              <Field
                label="Start date"
                type="date"
                value={form.startDate}
                onChange={(e) => update('startDate', e.target.value)}
                required
              />
              <Field
                label="End date"
                type="date"
                min={form.startDate}
                value={form.endDate}
                onChange={(e) => update('endDate', e.target.value)}
                required
              />
            </div>
            <div className="field-grid">
              <SelectField
                label="First destination"
                value={form.cityId}
                onChange={(e) => update('cityId', e.target.value)}
              >
                <option value="">Choose later</option>
                {cities.map((city) => (
                  <option key={city.id} value={city.id}>
                    {city.name}, {city.country}
                  </option>
                ))}
              </SelectField>
              <Field
                label="Travel budget (USD)"
                type="number"
                min="0"
                placeholder="2500"
                value={form.budgetLimit}
                onChange={(e) => update('budgetLimit', e.target.value)}
              />
            </div>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Creating your journey…' : 'Create & build itinerary'}{' '}
              <Icon name="arrow" />
            </Button>
          </form>
        </section>
        <aside className="planner-inspiration">
          <img src={travelVisuals.city} alt="Illustrated sunlit city street" />
          <div>
            <span>01</span>
            <p>“Not all those who wander are lost.”</p>
            <small>J.R.R. Tolkien</small>
          </div>
        </aside>
      </div>
    </div>
  );
}

function useTrip() {
  const { tripId } = useParams();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const refresh = () => {
    if (!tripId) return;
    setLoading(true);
    api
      .get<Trip>(`/trips/${tripId}`)
      .then(setTrip)
      .catch(() => setError('This journey could not be loaded.'))
      .finally(() => setLoading(false));
  };
  useEffect(refresh, [tripId]);
  return { tripId, trip, loading, error, refresh };
}

export function TripDetailPage() {
  const { tripId, trip, loading, error, refresh } = useTrip();
  const [sharing, setSharing] = useState(false);
  if (loading)
    return (
      <div className="page">
        <LoadingState />
      </div>
    );
  if (!trip)
    return (
      <div className="page">
        <ErrorNotice message={error} />
      </div>
    );
  const toggleShare = async () => {
    if (!tripId) return;
    setSharing(true);
    try {
      await api.post(`/trips/${tripId}/share`, { isPublic: !trip.isPublic });
      refresh();
    } finally {
      setSharing(false);
    }
  };
  const spent =
    trip.expenses.reduce((sum, expense) => sum + Number(expense.amount), 0) +
    trip.stops
      .flatMap((stop) => stop.activities)
      .reduce((sum, activity) => sum + Number(activity.cost), 0);

  return (
    <div className="page itinerary-page">
      <Link className="back-link" to="/trips">
        ← All journeys
      </Link>
      <section
        className="itinerary-hero"
        style={{
          backgroundImage: `linear-gradient(180deg, rgba(10,25,24,.1), rgba(10,25,24,.88)), url(${trip.coverPhotoUrl ?? travelVisuals.coast})`,
        }}
      >
        <div>
          <TripStatus trip={trip} />
          <p className="eyebrow">
            {trip.stops
              .map((stop) => stop.city.country)
              .filter((value, index, values) => values.indexOf(value) === index)
              .join(' · ') || 'Your next adventure'}
          </p>
          <h1>{trip.name}</h1>
          <p>{trip.description ?? 'A journey designed one remarkable day at a time.'}</p>
          <div className="itinerary-hero__meta">
            <span>
              <Icon name="calendar" /> {readableDate(trip.startDate)} – {readableDate(trip.endDate)}
            </span>
            <span>
              <Icon name="map" /> {trip.stops.length} stops
            </span>
          </div>
        </div>
        <div className="itinerary-hero__actions">
          <Link className="button button--secondary" to={`/trips/${trip.id}/build`}>
            Edit itinerary
          </Link>
          <Button onClick={toggleShare} disabled={sharing}>
            <Icon name="share" /> {trip.isPublic ? 'Shared' : 'Share trip'}
          </Button>
        </div>
      </section>
      <nav className="trip-tabs">
        <span className="active">Itinerary</span>
        <Link to={`/trips/${trip.id}/budget`}>Budget</Link>
        <Link to={`/trips/${trip.id}/calendar`}>Calendar</Link>
        {trip.publicSlug ? <Link to={`/share/${trip.publicSlug}`}>Public view</Link> : null}
      </nav>
      <div className="itinerary-layout">
        <section>
          <div className="section-heading">
            <div>
              <p className="eyebrow">Day by day</p>
              <h2>Your itinerary</h2>
            </div>
            <Link to={`/trips/${trip.id}/build`} className="text-link">
              <Icon name="plus" /> Add a stop
            </Link>
          </div>
          {trip.stops.length ? (
            <div className="stop-timeline">
              {trip.stops.map((stop, index) => (
                <article className="stop-block" key={stop.id}>
                  <div className="stop-block__rail">
                    <span>{String(index + 1).padStart(2, '0')}</span>
                  </div>
                  <div className="stop-block__content">
                    <div className="stop-block__header">
                      <div>
                        <p>
                          {readableDate(stop.startDate)} – {readableDate(stop.endDate)}
                        </p>
                        <h3>
                          {stop.city.name}, {stop.city.country}
                        </h3>
                      </div>
                      <span>{dayCount(stop.startDate, stop.endDate)} days</span>
                    </div>
                    {stop.notes ? <p>{stop.notes}</p> : null}
                    <div className="experience-stack">
                      {stop.activities.map((activity) => (
                        <div className="experience-row" key={activity.id}>
                          <span className="experience-row__time">
                            {activity.startTime ?? 'Anytime'}
                          </span>
                          <span className="experience-row__dot" />
                          <div>
                            <strong>{activity.name}</strong>
                            <p>
                              {activity.notes ?? `${activity.durationMinutes} minutes reserved`}
                            </p>
                          </div>
                          <b>{money(activity.cost)}</b>
                        </div>
                      ))}
                      {!stop.activities.length ? (
                        <div className="soft-empty">
                          No experiences added yet. Leave space for serendipity, or add a plan.
                        </div>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Shape your itinerary"
              description="Add your first destination, then fill each day with things you love."
              action={
                <Link to={`/trips/${trip.id}/build`} className="button button--primary">
                  Open builder
                </Link>
              }
            />
          )}
        </section>
        <aside className="trip-summary-card">
          <p className="eyebrow">Journey at a glance</p>
          <h3>{dayCount(trip.startDate, trip.endDate)} days of discovery</h3>
          <div className="route-preview">
            {trip.stops.map((stop, index) => (
              <div key={stop.id}>
                <span>{index + 1}</span>
                <p>
                  <strong>{stop.city.name}</strong>
                  <small>{readableDate(stop.startDate)}</small>
                </p>
              </div>
            ))}
          </div>
          <hr />
          <div className="budget-mini">
            <span>Current spend</span>
            <strong>{money(spent)}</strong>
            {trip.budgetLimit ? (
              <>
                <div>
                  <i
                    style={{
                      width: `${Math.min(100, (spent / Number(trip.budgetLimit)) * 100)}%`,
                    }}
                  />
                </div>
                <small>{money(Math.max(0, Number(trip.budgetLimit) - spent))} remaining</small>
              </>
            ) : (
              <small>No budget limit set</small>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

export function TripBuilderPage() {
  const { tripId, trip, loading, error, refresh } = useTrip();
  const [cities, setCities] = useState<City[]>([]);
  const [form, setForm] = useState({
    cityId: '',
    startDate: '',
    endDate: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    api
      .get<Paginated<City>>('/cities?sort=popularity&limit=50')
      .then((data) => setCities(data.items))
      .catch(() => undefined);
  }, []);
  if (loading)
    return (
      <div className="page">
        <LoadingState />
      </div>
    );
  if (!trip || !tripId)
    return (
      <div className="page">
        <ErrorNotice message={error} />
      </div>
    );
  const addStop = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api.post(`/trips/${tripId}/stops`, form);
      setForm({ cityId: '', startDate: '', endDate: '', notes: '' });
      refresh();
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="page builder-page">
      <PageHeader
        eyebrow="Itinerary studio"
        title={`Build ${trip.name}`}
        description="Add destinations in travel order. Each stop becomes a chapter you can fill with experiences."
        actions={
          <Link to={`/trips/${trip.id}`} className="button button--secondary">
            Done editing
          </Link>
        }
      />
      <div className="builder-layout">
        <section className="builder-canvas">
          <div className="builder-canvas__intro">
            <span>{trip.stops.length || 'No'} stops</span>
            <span>{dayCount(trip.startDate, trip.endDate)} travel days</span>
          </div>
          {trip.stops.map((stop, index) => (
            <article className="builder-stop" key={stop.id}>
              <span className="builder-stop__number">{index + 1}</span>
              <div>
                <p className="eyebrow">
                  Stop {index + 1} · {readableDate(stop.startDate)}
                </p>
                <h2>{stop.city.name}</h2>
                <p>
                  {stop.city.country} · {dayCount(stop.startDate, stop.endDate)} days
                </p>
                <div className="builder-stop__activities">
                  {stop.activities.map((activity) => (
                    <span key={activity.id}>{activity.name}</span>
                  ))}
                  <Link to={`/activities?cityId=${stop.cityId}`}>
                    <Icon name="plus" /> Find activities
                  </Link>
                </div>
              </div>
            </article>
          ))}
          {!trip.stops.length ? (
            <EmptyState
              title="Start with one destination"
              description="Add a city using the trip panel. You can add more stops as the route takes shape."
            />
          ) : null}
        </section>
        <aside className="builder-panel">
          <p className="eyebrow">Add a destination</p>
          <h2>Next stop</h2>
          <form onSubmit={addStop}>
            <SelectField
              label="City"
              value={form.cityId}
              onChange={(e) => setForm((current) => ({ ...current, cityId: e.target.value }))}
              required
            >
              <option value="">Select a city</option>
              {cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name}, {city.country}
                </option>
              ))}
            </SelectField>
            <div className="field-grid">
              <Field
                label="Arrive"
                type="date"
                min={trip.startDate}
                max={trip.endDate}
                value={form.startDate}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    startDate: e.target.value,
                  }))
                }
                required
              />
              <Field
                label="Depart"
                type="date"
                min={form.startDate || trip.startDate}
                max={trip.endDate}
                value={form.endDate}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    endDate: e.target.value,
                  }))
                }
                required
              />
            </div>
            <TextareaField
              label="Notes"
              rows={3}
              value={form.notes}
              onChange={(e) => setForm((current) => ({ ...current, notes: e.target.value }))}
              placeholder="Train times, hotel ideas, must-sees..."
            />
            <Button type="submit" disabled={saving}>
              {saving ? 'Adding…' : 'Add to itinerary'} <Icon name="plus" />
            </Button>
          </form>
          <div className="builder-tip">
            <span>✦</span>
            <p>
              <strong>A thoughtful pace</strong>Three to four days per city usually leaves room for
              both landmarks and spontaneous discoveries.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

export function BudgetPage() {
  const { tripId, trip, loading: tripLoading, error } = useTrip();
  const [budget, setBudget] = useState<BudgetBreakdown | null>(null);
  const [form, setForm] = useState({
    category: 'MEALS' as ExpenseCategory,
    label: '',
    amount: '',
    date: '',
  });
  const [saving, setSaving] = useState(false);
  const loadBudget = () => {
    if (tripId)
      api
        .get<BudgetBreakdown>(`/trips/${tripId}/budget`)
        .then(setBudget)
        .catch(() => undefined);
  };
  useEffect(loadBudget, [tripId]);
  if (tripLoading)
    return (
      <div className="page">
        <LoadingState />
      </div>
    );
  if (!trip || !tripId)
    return (
      <div className="page">
        <ErrorNotice message={error} />
      </div>
    );
  const addExpense = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api.post(`/trips/${tripId}/budget/expenses`, {
        ...form,
        amount: Number(form.amount),
        date: form.date || undefined,
      });
      setForm({ category: 'MEALS', label: '', amount: '', date: '' });
      loadBudget();
    } finally {
      setSaving(false);
    }
  };
  const colors: Record<ExpenseCategory, string> = {
    TRANSPORT: '#e9785d',
    STAY: '#246c67',
    ACTIVITIES: '#e5ae45',
    MEALS: '#7c6da5',
    OTHER: '#9aa6a0',
  };
  return (
    <div className="page">
      <PageHeader
        eyebrow="Travel budget"
        title={`Spend well in ${trip.name}`}
        description="A clear view of the numbers, so you can focus on the experience."
        actions={
          <Link className="button button--secondary" to={`/trips/${trip.id}`}>
            Back to itinerary
          </Link>
        }
      />
      {!budget ? (
        <LoadingState label="Balancing the travel ledger..." />
      ) : (
        <>
          <section className="budget-overview">
            <div>
              <p>Planned budget</p>
              <strong>{trip.budgetLimit ? money(trip.budgetLimit) : 'Not set'}</strong>
              <small>
                {budget.days} days · {money(budget.averagePerDay)} average per day
              </small>
            </div>
            <div>
              <p>Current spend</p>
              <strong>{money(budget.total)}</strong>
              <small className={budget.overBudget ? 'text-danger' : ''}>
                {trip.budgetLimit
                  ? `${money(Math.abs(Number(trip.budgetLimit) - budget.total))} ${budget.overBudget ? 'over' : 'remaining'}`
                  : 'Set a limit from trip settings'}
              </small>
            </div>
            <div
              className="budget-donut"
              style={{
                background: `conic-gradient(${
                  Object.entries(budget.totals)
                    .map(([category, value], index, entries) => {
                      const before =
                        (entries.slice(0, index).reduce((sum, [, amount]) => sum + amount, 0) /
                          Math.max(budget.total, 1)) *
                        100;
                      const after = before + (value / Math.max(budget.total, 1)) * 100;
                      return `${colors[category as ExpenseCategory]} ${before}% ${after}%`;
                    })
                    .join(', ') || '#eee 0 100%'
                })`,
              }}
            >
              <span>
                {Math.round(
                  (budget.total / Math.max(Number(trip.budgetLimit) || budget.total, 1)) * 100,
                )}
                %
              </span>
            </div>
          </section>
          <div className="budget-layout">
            <section className="budget-card">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Where it goes</p>
                  <h2>Category breakdown</h2>
                </div>
              </div>
              {Object.entries(budget.totals).map(([category, value]) => (
                <div className="budget-row" key={category}>
                  <span style={{ background: colors[category as ExpenseCategory] }} />
                  <div>
                    <strong>{category[0] + category.slice(1).toLowerCase()}</strong>
                    <div>
                      <i
                        style={{
                          width: `${budget.total ? (value / budget.total) * 100 : 0}%`,
                          background: colors[category as ExpenseCategory],
                        }}
                      />
                    </div>
                  </div>
                  <b>{money(value)}</b>
                </div>
              ))}
            </section>
            <aside className="budget-card">
              <p className="eyebrow">Quick add</p>
              <h2>Log an expense</h2>
              <form onSubmit={addExpense}>
                <SelectField
                  label="Category"
                  value={form.category}
                  onChange={(e) =>
                    setForm((c) => ({
                      ...c,
                      category: e.target.value as ExpenseCategory,
                    }))
                  }
                >
                  {Object.keys(colors).map((category) => (
                    <option key={category}>{category}</option>
                  ))}
                </SelectField>
                <Field
                  label="What was it?"
                  value={form.label}
                  onChange={(e) => setForm((c) => ({ ...c, label: e.target.value }))}
                  required
                />
                <div className="field-grid">
                  <Field
                    label="Amount (USD)"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.amount}
                    onChange={(e) => setForm((c) => ({ ...c, amount: e.target.value }))}
                    required
                  />
                  <Field
                    label="Date"
                    type="date"
                    min={trip.startDate}
                    max={trip.endDate}
                    value={form.date}
                    onChange={(e) => setForm((c) => ({ ...c, date: e.target.value }))}
                  />
                </div>
                <Button type="submit" disabled={saving}>
                  {saving ? 'Saving…' : 'Add expense'}
                </Button>
              </form>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}

export function CalendarPage() {
  const { tripId, trip, loading, error } = useTrip();
  const [days, setDays] = useState<TimelineDay[]>([]);
  useEffect(() => {
    if (tripId)
      api
        .get<{ days: TimelineDay[] }>(`/trips/${tripId}/timeline`)
        .then((data) => setDays(data.days))
        .catch(() => undefined);
  }, [tripId]);
  if (loading)
    return (
      <div className="page">
        <LoadingState />
      </div>
    );
  if (!trip || !tripId)
    return (
      <div className="page">
        <ErrorNotice message={error} />
      </div>
    );
  return (
    <div className="page">
      <PageHeader
        eyebrow="Calendar view"
        title={`${trip.name}, day by day`}
        description="A calm, scannable view of the pace of your journey."
        actions={
          <Link className="button button--secondary" to={`/trips/${trip.id}`}>
            Itinerary view
          </Link>
        }
      />
      <div className="calendar-grid">
        {days.map((day, index) => (
          <article
            className={`calendar-day ${day.activities.length ? 'calendar-day--planned' : ''}`}
            key={day.date}
          >
            <p>Day {index + 1}</p>
            <strong>
              {new Date(`${day.date}T00:00:00`).toLocaleDateString('en', {
                weekday: 'short',
                day: 'numeric',
              })}
            </strong>
            <span>{day.cityName ?? 'Travel day'}</span>
            <div>
              {day.activities.slice(0, 3).map((activity) => (
                <small key={activity.id}>
                  {activity.startTime?.slice(0, 5) ?? '—'} {activity.name}
                </small>
              ))}
            </div>
          </article>
        ))}
      </div>
      {!days.length ? (
        <EmptyState
          icon="calendar"
          title="No timeline yet"
          description="Add destinations and activities to see your journey unfold here."
          action={
            <Link className="button button--primary" to={`/trips/${trip.id}/build`}>
              Build itinerary
            </Link>
          }
        />
      ) : null}
    </div>
  );
}

export function CalendarHubPage() {
  const [trips, setTrips] = useState<TripListItem[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api
      .get<Paginated<TripListItem>>('/trips?filter=upcoming&limit=40')
      .then((data) => setTrips(data.items))
      .finally(() => setLoading(false));
  }, []);
  const months = useMemo(
    () =>
      Array.from({ length: 12 }, (_, month) =>
        new Date(new Date().getFullYear(), month, 1).toLocaleDateString('en', {
          month: 'long',
        }),
      ),
    [],
  );
  return (
    <div className="page">
      <PageHeader
        eyebrow="Year at a glance"
        title="Your travel calendar"
        description="See how the adventures ahead fit into the rhythm of your year."
      />
      {loading ? (
        <LoadingState />
      ) : (
        <div className="year-grid">
          {months.map((month, monthIndex) => {
            const monthTrips = trips.filter(
              (trip) => new Date(`${trip.startDate}T00:00:00`).getMonth() === monthIndex,
            );
            return (
              <section className="month-card" key={month}>
                <h2>{month}</h2>
                {monthTrips.map((trip) => (
                  <Link key={trip.id} to={`/trips/${trip.id}/calendar`}>
                    <span
                      style={{
                        background: monthIndex % 2 ? '#246c67' : '#e9785d',
                      }}
                    />
                    <div>
                      <strong>{trip.name}</strong>
                      <small>{readableDate(trip.startDate)}</small>
                    </div>
                  </Link>
                ))}
                {!monthTrips.length ? <p>Open skies</p> : null}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
