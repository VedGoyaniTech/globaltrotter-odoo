// Response shapes returned by the server. Keep in sync with server/prisma/schema.prisma.

export type Role = 'USER' | 'ADMIN';

export type ActivityCategory =
  | 'SIGHTSEEING'
  | 'FOOD'
  | 'ADVENTURE'
  | 'CULTURE'
  | 'NIGHTLIFE'
  | 'SHOPPING'
  | 'NATURE'
  | 'RELAXATION'
  | 'TRANSPORT'
  | 'OTHER';

export type ExpenseCategory = 'TRANSPORT' | 'STAY' | 'ACTIVITIES' | 'MEALS' | 'OTHER';

export interface User {
  id: string;
  /** Display name — derived from firstName + lastName when signup sends those. */
  name: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  phone: string | null;
  bio: string | null;
  avatarUrl: string | null;
  city: string | null;
  country: string | null;
  language: string;
  role: Role;
  createdAt: string;
}

export interface City {
  id: string;
  name: string;
  country: string;
  region: string | null;
  costIndex: number;
  popularity: number;
  imageUrl: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface Activity {
  id: string;
  cityId: string;
  name: string;
  description: string | null;
  category: ActivityCategory;
  cost: string;
  durationMinutes: number;
  imageUrl: string | null;
  city?: Pick<City, 'id' | 'name' | 'country'>;
}

export interface TripActivity {
  id: string;
  tripStopId: string;
  activityId: string | null;
  name: string;
  notes: string | null;
  scheduledDate: string | null;
  startTime: string | null;
  durationMinutes: number;
  cost: string;
  orderIndex: number;
}

export interface TripStop {
  id: string;
  tripId: string;
  cityId: string;
  startDate: string;
  endDate: string;
  orderIndex: number;
  /** Optional planning target for this leg. Decimal — arrives as a string. */
  budget: string | null;
  notes: string | null;
  city: City;
  activities: TripActivity[];
}

export interface Expense {
  id: string;
  tripId: string;
  category: ExpenseCategory;
  label: string;
  amount: string;
  date: string | null;
}

export interface Trip {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  startDate: string;
  endDate: string;
  coverPhotoUrl: string | null;
  budgetLimit: string | null;
  isPublic: boolean;
  publicSlug: string | null;
  createdAt: string;
  stops: TripStop[];
  expenses: Expense[];
}

export interface BudgetBreakdown {
  tripId: string;
  totals: Record<ExpenseCategory, number>;
  total: number;
  budgetLimit: number | null;
  overBudget: boolean;
  days: number;
  averagePerDay: number;
  perDay: { date: string; total: number; overAverage: boolean }[];
}

export interface TimelineDay {
  date: string;
  cityId: string | null;
  cityName: string | null;
  activities: TripActivity[];
}

/** Trip list buckets. Disjoint: a trip starting today is `ongoing`, not `upcoming`. */
export type TripFilter = 'all' | 'upcoming' | 'ongoing' | 'past';

/** One card in the community feed — `GET /api/public/trips`. */
export interface PublicTripCard {
  id: string;
  name: string;
  description: string | null;
  startDate: string;
  endDate: string;
  coverPhotoUrl: string | null;
  publicSlug: string;
  createdAt: string;
  user: Pick<User, 'id' | 'name' | 'avatarUrl'>;
  stopCount: number;
  cities: Pick<City, 'id' | 'name' | 'country'>[];
}

export interface CountryOption {
  country: string;
  cities: number;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface AuthResponse {
  user: User;
  token: string;
}
