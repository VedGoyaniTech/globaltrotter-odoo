import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, auth } from '../lib/api';
import type { AuthResponse, User } from '../types/api';

type Credentials = { email: string; password: string };
type SignupDetails = Credentials & {
  name: string;
  city?: string;
  country?: string;
};

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (credentials: Credentials) => Promise<void>;
  signup: (details: SignupDetails) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(() => Boolean(auth.get()));

  const refreshUser = useCallback(async () => {
    if (!auth.get()) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      setUser(await api.get<User>('/auth/me'));
    } catch {
      auth.clear();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  const login = useCallback(async (credentials: Credentials) => {
    const response = await api.post<AuthResponse>('/auth/login', credentials);
    auth.set(response.token);
    setUser(response.user);
  }, []);

  const signup = useCallback(async (details: SignupDetails) => {
    const response = await api.post<AuthResponse>('/auth/signup', details);
    auth.set(response.token);
    setUser(response.user);
  }, []);

  const logout = useCallback(() => {
    auth.clear();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, signup, logout, refreshUser }),
    [user, loading, login, signup, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
