import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ApiError, api } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { Button, ErrorNotice, Field, TextareaField } from '../components/ui';
import { Icon } from '../components/Icon';
import { localVisuals, travelBackground, travelVisuals } from '../lib/assets';

function AuthLayout({
  children,
  mode,
  quote = 'Collect moments, not things.',
}: {
  children: React.ReactNode;
  mode: 'login' | 'signup' | 'recovery';
  quote?: string;
}) {
  return (
    <main className="auth-layout">
      <section
        className="auth-visual"
        style={{ backgroundImage: travelBackground(travelVisuals.auth, localVisuals.journey) }}
      >
        <Link className="brand brand--light" to="/">
          <span className="brand__mark">G</span>
          <span>GlobeTrotter</span>
        </Link>
        <div>
          <p className="eyebrow">Your world, thoughtfully planned</p>
          <blockquote>“{quote}”</blockquote>
          <p>One beautiful place for every city, story, and shared adventure.</p>
        </div>
      </section>
      <section className="auth-panel">
        <div className="auth-tabs" aria-label="Account access">
          <Link className={mode === 'login' ? 'auth-tabs__active' : ''} to="/login">
            Sign in
          </Link>
          <Link className={mode === 'signup' ? 'auth-tabs__active' : ''} to="/signup">
            Register
          </Link>
        </div>
        {children}
      </section>
    </main>
  );
}

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('demo@globetrotter.app');
  const [password, setPassword] = useState('Password123');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await login({ email, password });
      navigate('/');
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : 'Could not sign in. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout mode="login">
      <div className="auth-form-wrap">
        <div className="auth-heading">
          <span className="auth-heading__icon">✦</span>
          <p className="eyebrow">Welcome back</p>
          <h1>Continue your journey</h1>
          <p>Your next adventure is only a few thoughtful choices away.</p>
        </div>
        {error ? <ErrorNotice message={error} /> : null}
        <form onSubmit={submit} className="auth-form">
          <Field
            label="Email address"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />
          <Field
            label="Password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
          <div className="form-row">
            <label className="check">
              <input type="checkbox" defaultChecked /> Remember me
            </label>
            <Link to="/forgot-password">Forgot password?</Link>
          </div>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'} <Icon name="arrow" />
          </Button>
        </form>
        <p className="auth-switch">
          New to GlobeTrotter? <Link to="/signup">Create an account</Link>
        </p>
        <div className="demo-note">
          <strong>Demo ready</strong>
          <span>The seeded traveler credentials are prefilled for the hackathon demo.</span>
        </div>
      </div>
    </AuthLayout>
  );
}

export function SignupPage() {
  const { user, signup } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    phone: '',
    city: '',
    country: '',
    bio: '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/" replace />;
  const update = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await signup(form);
      navigate('/');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not create your account.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout mode="signup" quote="The journey of a thousand miles begins with a single step.">
      <div className="auth-form-wrap auth-form-wrap--wide">
        <div className="auth-heading">
          <p className="eyebrow">Join the journey</p>
          <h1>Create your travel space</h1>
          <p>Plan intentionally, stay on budget, and keep every memory close.</p>
        </div>
        {error ? <ErrorNotice message={error} /> : null}
        <form onSubmit={submit} className="auth-form">
          <div className="field-grid">
            <Field
              label="First name"
              autoComplete="given-name"
              value={form.firstName}
              onChange={(e) => update('firstName', e.target.value)}
              required
            />
            <Field
              label="Last name"
              autoComplete="family-name"
              value={form.lastName}
              onChange={(e) => update('lastName', e.target.value)}
              required
            />
            <Field
              label="Email address"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
              required
            />
            <Field
              label="Phone number"
              type="tel"
              autoComplete="tel"
              value={form.phone}
              onChange={(e) => update('phone', e.target.value)}
            />
            <Field
              label="Home city"
              value={form.city}
              onChange={(e) => update('city', e.target.value)}
            />
            <Field
              label="Country"
              value={form.country}
              onChange={(e) => update('country', e.target.value)}
            />
          </div>
          <TextareaField
            className="auth-bio"
            label="A little about your travel style"
            rows={2}
            value={form.bio}
            onChange={(e) => update('bio', e.target.value)}
          />
          <Field
            label="Password"
            type="password"
            minLength={8}
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => update('password', e.target.value)}
            hint="Use at least 8 characters."
            required
          />
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Creating account…' : 'Start exploring'} <Icon name="arrow" />
          </Button>
        </form>
        <p className="auth-switch">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </AuthLayout>
  );
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Request failed.');
    }
  };
  return (
    <AuthLayout mode="recovery" quote="Adventure is worthwhile in itself.">
      <div className="auth-form-wrap">
        <div className="auth-heading">
          <p className="eyebrow">Account recovery</p>
          <h1>Find your way back</h1>
          <p>Enter your email and we’ll send password reset instructions.</p>
        </div>
        {error ? <ErrorNotice message={error} /> : null}
        {sent ? (
          <div className="success-card">
            <span>✓</span>
            <h3>Check your inbox</h3>
            <p>If an account exists for {email}, reset instructions are on their way.</p>
            <Link className="button button--secondary" to="/login">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="auth-form">
            <Field
              label="Email address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Button type="submit">
              Send reset link <Icon name="arrow" />
            </Button>
          </form>
        )}
      </div>
    </AuthLayout>
  );
}
