import { useEffect, useState } from 'react';
import { Icon } from '../components/Icon';
import { ErrorNotice, LoadingState, PageHeader } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';
import type { Role } from '../types/api';

interface AdminStats {
  counts: {
    users: number;
    trips: number;
    publicTrips: number;
    stops: number;
    cities: number;
    activities: number;
  };
  averageStopsPerTrip: number;
  topCities: { id?: string; name?: string; country?: string; stops: number }[];
  topActivities: { name: string; uses: number }[];
}
interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  _count?: { trips: number };
}

export function AdminPage() {
  const { user: currentUser } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  useEffect(() => {
    Promise.all([
      api.get<AdminStats>('/admin/stats'),
      api.get<{ items: AdminUser[] }>('/admin/users'),
    ])
      .then(([statsData, usersData]) => {
        setStats(statsData);
        setUsers(usersData.items);
      })
      .catch(() => setError('Admin analytics are unavailable or this account lacks permission.'));
  }, []);
  if (error)
    return (
      <div className="page">
        <ErrorNotice message={error} />
      </div>
    );
  if (!stats)
    return (
      <div className="page">
        <LoadingState label="Preparing the travel pulse..." />
      </div>
    );
  const cards = [
    { label: 'Travelers', value: stats.counts.users, icon: 'users' as const },
    { label: 'Journeys', value: stats.counts.trips, icon: 'map' as const },
    {
      label: 'Shared stories',
      value: stats.counts.publicTrips,
      icon: 'share' as const,
    },
    {
      label: 'Experiences',
      value: stats.counts.activities,
      icon: 'compass' as const,
    },
  ];
  const changeRole = async (user: AdminUser) => {
    setActionError('');
    try {
      const role: Role = user.role === 'ADMIN' ? 'USER' : 'ADMIN';
      const updated = await api.patch<AdminUser>(`/admin/users/${user.id}/role`, { role });
      setUsers((current) =>
        current.map((item) => (item.id === user.id ? { ...item, role: updated.role } : item)),
      );
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : 'Role update failed.');
    }
  };
  const removeUser = async (user: AdminUser) => {
    if (!window.confirm(`Delete ${user.name} and all of their journeys?`)) return;
    setActionError('');
    try {
      await api.delete(`/admin/users/${user.id}`);
      setUsers((current) => current.filter((item) => item.id !== user.id));
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : 'User deletion failed.');
    }
  };
  return (
    <div className="page admin-page">
      <PageHeader
        eyebrow="GlobeTrotter admin"
        title="The travel pulse"
        description="A concise view of how the community is planning, exploring, and sharing."
      />
      <div className="admin-stats">
        {cards.map((card) => (
          <article key={card.label}>
            <span>
              <Icon name={card.icon} />
            </span>
            <p>{card.label}</p>
            <strong>{card.value.toLocaleString()}</strong>
            <small>Live platform total</small>
          </article>
        ))}
      </div>
      <div className="admin-grid">
        <section className="admin-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Destination demand</p>
              <h2>Most planned cities</h2>
            </div>
          </div>
          <div className="bar-chart">
            {stats.topCities.map((city, index) => (
              <div key={city.id ?? city.name}>
                <span>{index + 1}</span>
                <p>
                  <strong>{city.name ?? 'Unknown city'}</strong>
                  <small>{city.country ?? 'Worldwide'}</small>
                </p>
                <div>
                  <i
                    style={{
                      width: `${(city.stops / Math.max(stats.topCities[0]?.stops ?? 1, 1)) * 100}%`,
                    }}
                  />
                </div>
                <b>{city.stops}</b>
              </div>
            ))}
          </div>
        </section>
        <section className="admin-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Community taste</p>
              <h2>Top experiences</h2>
            </div>
          </div>
          <ol className="rank-list">
            {stats.topActivities.map((activity, index) => (
              <li key={activity.name}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <strong>{activity.name}</strong>
                <b>{activity.uses} adds</b>
              </li>
            ))}
          </ol>
        </section>
      </div>
      <section className="admin-card admin-users">
        {actionError ? <ErrorNotice message={actionError} /> : null}
        <div className="section-heading">
          <div>
            <p className="eyebrow">Latest arrivals</p>
            <h2>Traveler accounts</h2>
          </div>
          <span>
            {Math.min(users.length, 8)} shown · {stats.averageStopsPerTrip} stops/trip
          </span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Traveler</th>
                <th>Role</th>
                <th>Journeys</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.slice(0, 8).map((user) => (
                <tr key={user.id}>
                  <td>
                    <span className="avatar">{user.name[0]}</span>
                    <p>
                      <strong>{user.name}</strong>
                      <small>{user.email}</small>
                    </p>
                  </td>
                  <td>
                    <span className="category-pill">{user.role}</span>
                  </td>
                  <td>{user._count?.trips ?? 0}</td>
                  <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                  <td>
                    <div className="admin-user-actions">
                      <button
                        type="button"
                        disabled={currentUser?.id === user.id}
                        onClick={() => void changeRole(user)}
                      >
                        {user.role === 'ADMIN' ? 'Make user' : 'Make admin'}
                      </button>
                      <button
                        type="button"
                        disabled={currentUser?.id === user.id}
                        onClick={() => void removeUser(user)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
