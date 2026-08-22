import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button, ErrorNotice, Field, LoadingState, PageHeader, SelectField } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { ApiError, api } from '../lib/api';
import type { Paginated, Trip, User } from '../types/api';

export function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [form, setForm] = useState({ name: user?.name ?? '', city: user?.city ?? '', language: user?.language ?? 'en', avatarUrl: user?.avatarUrl ?? '' });
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { api.get<Paginated<Trip>>('/trips?limit=6').then((data) => setTrips(data.items)).catch(() => undefined); }, []);
  const submit = async (event: FormEvent) => { event.preventDefault(); setSaving(true); setError(''); try { await api.patch<User>('/users/me', form); await refreshUser(); setEditing(false); } catch (caught) { setError(caught instanceof ApiError ? caught.message : 'Profile update failed.'); } finally { setSaving(false); } };
  if (!user) return <LoadingState />;
  const countries = new Set(trips.flatMap((trip) => trip.stops.map((stop) => stop.city.country))).size;

  return <div className="page profile-page"><PageHeader eyebrow="Traveler profile" title="Your corner of the world" description="The person behind the plans, and the places that shaped the story." />{error ? <ErrorNotice message={error} /> : null}<section className="profile-hero"><div className="profile-portrait">{user.avatarUrl ? <img src={user.avatarUrl} alt={user.name} /> : <span>{user.name.slice(0, 1)}</span>}<i /></div><div><p className="eyebrow">Member since {new Date(user.createdAt).getFullYear()}</p><h2>{user.name}</h2><p>{user.city || user.country ? `${user.city ?? ''}${user.city && user.country ? ', ' : ''}${user.country ?? ''}` : 'Based wherever the next idea begins'}</p><span>{user.email}</span></div><Button variant="secondary" onClick={() => setEditing((value) => !value)}>{editing ? 'Cancel editing' : 'Edit profile'}</Button></section>{editing ? <form className="profile-form" onSubmit={submit}><Field label="Display name" value={form.name} onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))} required /><Field label="Home city" value={form.city} onChange={(e) => setForm((c) => ({ ...c, city: e.target.value }))} /><SelectField label="Language" value={form.language} onChange={(e) => setForm((c) => ({ ...c, language: e.target.value }))}><option value="en">English</option><option value="hi">Hindi</option><option value="fr">French</option><option value="es">Spanish</option></SelectField><Field label="Avatar URL" type="url" value={form.avatarUrl} onChange={(e) => setForm((c) => ({ ...c, avatarUrl: e.target.value }))} /><Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save profile'}</Button></form> : null}<div className="profile-stats"><div><strong>{trips.length}</strong><span>Journeys</span></div><div><strong>{countries}</strong><span>Countries</span></div><div><strong>{trips.reduce((sum, trip) => sum + trip.stops.length, 0)}</strong><span>Cities explored</span></div></div><section className="content-section"><div className="section-heading"><div><p className="eyebrow">Travel journal</p><h2>Your journeys</h2></div><Link to="/trips">View archive →</Link></div><div className="profile-trip-grid">{trips.slice(0, 3).map((trip, index) => <Link to={`/trips/${trip.id}`} key={trip.id} style={{ backgroundImage: `linear-gradient(180deg, transparent, rgba(12,28,27,.8)), url(${trip.coverPhotoUrl ?? `https://images.unsplash.com/photo-${['1503220317375-aaad61436b1b','1488646953014-85cb44e25828','1526772662000-3f88f10405ff'][index]}?auto=format&fit=crop&w=900&q=80`})` }}><span>{trip.stops.map((stop) => stop.city.country).join(' · ')}</span><h3>{trip.name}</h3></Link>)}</div></section></div>;
}
