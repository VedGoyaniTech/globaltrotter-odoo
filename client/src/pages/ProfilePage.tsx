import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { TravelImage } from '../components/TravelImage';
import {
  Button,
  ErrorNotice,
  Field,
  LoadingState,
  PageHeader,
  SelectField,
  TextareaField,
} from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { ApiError, api } from '../lib/api';
import { localFallback, travelFallback } from '../lib/assets';
import type { City, Paginated, TripListItem, User } from '../types/api';

export function ProfilePage() {
  const { user, refreshUser, logout } = useAuth();
  const navigate = useNavigate();
  const [trips, setTrips] = useState<TripListItem[]>([]);
  const [saved, setSaved] = useState<City[]>([]);
  const [form, setForm] = useState({
    firstName: user?.firstName ?? '',
    lastName: user?.lastName ?? '',
    phone: user?.phone ?? '',
    bio: user?.bio ?? '',
    city: user?.city ?? '',
    country: user?.country ?? '',
    language: user?.language ?? 'en',
  });
  const [emailForm, setEmailForm] = useState({ email: user?.email ?? '', currentPassword: '' });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '' });
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    Promise.all([
      api.get<Paginated<TripListItem>>('/trips?limit=6'),
      api.get<City[]>('/users/me/saved-destinations'),
    ])
      .then(([tripData, savedData]) => {
        setTrips(tripData.items);
        setSaved(savedData);
      })
      .catch(() => setError('Some profile details could not be refreshed.'));
  }, []);

  const showSuccess = (message: string) => {
    setError('');
    setNotice(message);
  };

  const submitProfile = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.patch<User>('/users/me', {
        ...form,
        phone: form.phone || null,
        bio: form.bio || null,
        city: form.city || null,
        country: form.country || null,
      });
      await refreshUser();
      setEditing(false);
      showSuccess('Profile details saved.');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Profile update failed.');
    } finally {
      setSaving(false);
    }
  };

  const uploadAvatar = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      await api.upload<User>('/users/me/avatar', file);
      await refreshUser();
      showSuccess('Profile photo updated.');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Profile photo upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const changeEmail = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api.patch<User>('/users/me/email', emailForm);
      await refreshUser();
      setEmailForm((current) => ({ ...current, currentPassword: '' }));
      showSuccess('Email address updated.');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Email update failed.');
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api.patch('/users/me/password', passwordForm);
      setPasswordForm({ currentPassword: '', newPassword: '' });
      showSuccess('Password updated securely.');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Password update failed.');
    } finally {
      setSaving(false);
    }
  };

  const removeSaved = async (cityId: string) => {
    setError('');
    try {
      await api.delete(`/users/me/saved-destinations/${cityId}`);
      setSaved((current) => current.filter((city) => city.id !== cityId));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not remove this saved place.');
    }
  };

  const deleteAccount = async () => {
    if (!window.confirm('Delete your GlobeTrotter account and every trip? This cannot be undone.'))
      return;
    setError('');
    try {
      await api.delete('/users/me');
      logout();
      navigate('/signup');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Account deletion failed.');
    }
  };

  if (!user) return <LoadingState />;
  const countries = new Set(trips.flatMap((trip) => trip.stops.map((stop) => stop.city.country)))
    .size;

  return (
    <div className="page profile-page">
      <PageHeader
        eyebrow="Traveler profile"
        title="Your corner of the world"
        description="Personal details, travel preferences, saved places, and account controls in one calm space."
      />
      {error ? <ErrorNotice message={error} /> : null}
      {notice ? (
        <p className="success-notice" role="status">
          {notice}
        </p>
      ) : null}
      <section className="profile-hero">
        <div className="profile-portrait">
          {user.avatarUrl ? (
            <TravelImage src={user.avatarUrl} fallback={localFallback(0)} alt={user.name} />
          ) : (
            <span>{user.name.slice(0, 1)}</span>
          )}
          <i />
        </div>
        <div>
          <p className="eyebrow">Member since {new Date(user.createdAt).getFullYear()}</p>
          <h2>{user.name}</h2>
          <p>{user.bio || 'Curating a life measured in places, people, and memorable detours.'}</p>
          <span>
            {user.city || user.country
              ? `${user.city ?? ''}${user.city && user.country ? ', ' : ''}${user.country ?? ''}`
              : 'Home base not set'}{' '}
            · {user.email}
          </span>
        </div>
        <div className="profile-actions">
          <label className="button button--secondary profile-upload">
            {uploading ? 'Uploading…' : 'Change photo'}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={uploading}
              onChange={(event) => void uploadAvatar(event.target.files?.[0])}
            />
          </label>
          <Button variant="secondary" onClick={() => setEditing((value) => !value)}>
            {editing ? 'Close editor' : 'Edit profile'}
          </Button>
        </div>
      </section>

      <div className="profile-stats">
        <div>
          <strong>{trips.length}</strong>
          <span>Journeys</span>
        </div>
        <div>
          <strong>{countries}</strong>
          <span>Countries</span>
        </div>
        <div>
          <strong>{trips.reduce((sum, trip) => sum + trip.stops.length, 0)}</strong>
          <span>Cities explored</span>
        </div>
        <div>
          <strong>{saved.length}</strong>
          <span>Saved places</span>
        </div>
      </div>

      {editing ? (
        <section className="settings-section">
          <form className="settings-card profile-form" onSubmit={submitProfile}>
            <div className="settings-card__heading">
              <p className="eyebrow">Public profile</p>
              <h2>About you</h2>
            </div>
            <Field
              label="First name"
              value={form.firstName}
              onChange={(event) =>
                setForm((current) => ({ ...current, firstName: event.target.value }))
              }
              required
            />
            <Field
              label="Last name"
              value={form.lastName}
              onChange={(event) =>
                setForm((current) => ({ ...current, lastName: event.target.value }))
              }
              required
            />
            <Field
              label="Phone"
              type="tel"
              value={form.phone}
              onChange={(event) =>
                setForm((current) => ({ ...current, phone: event.target.value }))
              }
            />
            <Field
              label="Home city"
              value={form.city}
              onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))}
            />
            <Field
              label="Country"
              value={form.country}
              onChange={(event) =>
                setForm((current) => ({ ...current, country: event.target.value }))
              }
            />
            <SelectField
              label="Language"
              value={form.language}
              onChange={(event) =>
                setForm((current) => ({ ...current, language: event.target.value }))
              }
            >
              <option value="en">English</option>
              <option value="hi">Hindi</option>
              <option value="fr">French</option>
              <option value="es">Spanish</option>
            </SelectField>
            <TextareaField
              className="settings-card__wide"
              label="Bio"
              rows={3}
              value={form.bio}
              onChange={(event) => setForm((current) => ({ ...current, bio: event.target.value }))}
            />
            <Button className="settings-card__wide" type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save profile'}
            </Button>
          </form>
          <div className="account-settings">
            <form className="settings-card" onSubmit={changeEmail}>
              <p className="eyebrow">Account email</p>
              <h2>Change sign-in email</h2>
              <Field
                label="New email"
                type="email"
                value={emailForm.email}
                onChange={(event) =>
                  setEmailForm((current) => ({ ...current, email: event.target.value }))
                }
                required
              />
              <Field
                label="Current password"
                type="password"
                value={emailForm.currentPassword}
                onChange={(event) =>
                  setEmailForm((current) => ({ ...current, currentPassword: event.target.value }))
                }
                required
              />
              <Button type="submit" variant="secondary" disabled={saving}>
                Update email
              </Button>
            </form>
            <form className="settings-card" onSubmit={changePassword}>
              <p className="eyebrow">Security</p>
              <h2>Change password</h2>
              <Field
                label="Current password"
                type="password"
                value={passwordForm.currentPassword}
                onChange={(event) =>
                  setPasswordForm((current) => ({
                    ...current,
                    currentPassword: event.target.value,
                  }))
                }
                required
              />
              <Field
                label="New password"
                type="password"
                minLength={8}
                value={passwordForm.newPassword}
                onChange={(event) =>
                  setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))
                }
                required
              />
              <Button type="submit" variant="secondary" disabled={saving}>
                Update password
              </Button>
            </form>
          </div>
        </section>
      ) : null}

      <section className="content-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Travel journal</p>
            <h2>Your journeys</h2>
          </div>
          <Link to="/trips">View archive →</Link>
        </div>
        <div className="profile-trip-grid">
          {trips.slice(0, 3).map((trip, index) => (
            <Link
              to={`/trips/${trip.id}`}
              key={trip.id}
              style={{
                backgroundImage: `linear-gradient(180deg, transparent, rgba(8,31,31,.82)), url(${trip.coverPhotoUrl ?? travelFallback(index)}), url(${localFallback(index)})`,
              }}
            >
              <span>{trip.stops.map((stop) => stop.city.country).join(' · ') || 'Planning'}</span>
              <h3>{trip.name}</h3>
            </Link>
          ))}
        </div>
      </section>

      <section className="content-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Saved inspiration</p>
            <h2>Places for later</h2>
          </div>
          <Link to="/cities">Discover more →</Link>
        </div>
        {saved.length ? (
          <div className="saved-grid">
            {saved.map((city, index) => (
              <article key={city.id}>
                <TravelImage
                  src={city.imageUrl ?? travelFallback(index)}
                  fallback={localFallback(index)}
                  alt={`${city.name}, ${city.country}`}
                />
                <div>
                  <p>{city.country}</p>
                  <h3>{city.name}</h3>
                  <button type="button" onClick={() => void removeSaved(city.id)}>
                    Remove
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="soft-empty">
            Save destinations from Discover and they will appear here.
          </div>
        )}
      </section>

      <section className="danger-zone">
        <div>
          <p className="eyebrow">Privacy and data</p>
          <h2>Delete account</h2>
          <p>Permanently removes your profile, trips, itinerary, and saved places.</p>
        </div>
        <Button variant="secondary" onClick={() => void deleteAccount()}>
          Delete my account
        </Button>
      </section>
    </div>
  );
}
