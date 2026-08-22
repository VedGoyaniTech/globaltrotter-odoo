# GlobeTrotter API

Base URL: `http://localhost:4000/api`

Auth: `Authorization: Bearer <token>` (a `token` cookie is also accepted).
Errors: `{ "error": string, "details"?: unknown }` with a matching HTTP status.
Lists are paginated: `{ items, total, page, limit, pages }`.

## Auth — `/auth`

| Method | Path               | Auth | Notes                                            |
| ------ | ------------------ | ---- | ------------------------------------------------ |
| POST   | `/signup`          | —    | `{ name, email, password, city?, country? }`     |
| POST   | `/login`           | —    | returns `{ user, token }`                        |
| GET    | `/me`              | ✓    | current user                                     |
| POST   | `/forgot-password` | —    | always 200; dev responses include `devResetToken` |
| POST   | `/reset-password`  | —    | `{ token, password }`                            |

## Users — `/users`  (all require auth)

| Method | Path                             | Notes                       |
| ------ | -------------------------------- | --------------------------- |
| PATCH  | `/me`                            | name, avatar, city, language |
| DELETE | `/me`                            | deletes account + trips      |
| GET    | `/me/saved-destinations`         | saved city list              |
| POST   | `/me/saved-destinations/:cityId` | save                         |
| DELETE | `/me/saved-destinations/:cityId` | unsave                       |

## Cities — `/cities`

| Method | Path         | Notes                                                      |
| ------ | ------------ | ---------------------------------------------------------- |
| GET    | `/`          | `?q&country&region&sort=popularity\|name\|costIndex&page&limit` |
| GET    | `/countries` | filter options with city counts                             |
| GET    | `/:id`       | city + its activities                                       |

## Activities — `/activities`

| Method | Path          | Notes                                                                |
| ------ | ------------- | -------------------------------------------------------------------- |
| GET    | `/`           | `?q&cityId&category&maxCost&maxDuration&sort=name\|cost\|duration`    |
| GET    | `/categories` | enum values for filter chips                                          |
| GET    | `/:id`        | single activity                                                       |

## Trips — `/trips`  (all require auth, owner-scoped)

| Method | Path                | Notes                                        |
| ------ | ------------------- | -------------------------------------------- |
| GET    | `/`                 | `?q&filter=all\|upcoming\|past&page&limit`   |
| POST   | `/`                 | `{ name, startDate, endDate, ... }`          |
| GET    | `/:tripId`          | full trip with stops + activities + expenses |
| GET    | `/:tripId/timeline` | one entry per calendar day                   |
| PATCH  | `/:tripId`          | partial update                               |
| DELETE | `/:tripId`          | cascades                                     |
| POST   | `/:tripId/share`    | `{ isPublic }` → mints `publicSlug`          |

Dates are `YYYY-MM-DD`. `endDate` must be on or after `startDate`.

## Stops — `/trips/:tripId/stops`

| Method | Path                             | Notes                                        |
| ------ | -------------------------------- | -------------------------------------------- |
| GET    | `/`                              | ordered stops with city + activities         |
| POST   | `/`                              | `{ cityId, startDate, endDate, notes? }`     |
| PUT    | `/reorder`                       | `{ stopIds: [...] }` — must list every stop  |
| PATCH  | `/:stopId`                       | partial update                               |
| DELETE | `/:stopId`                       | cascades to its activities                   |
| POST   | `/:stopId/activities`            | `{ activityId }` or `{ name, cost, ... }`    |
| PATCH  | `/:stopId/activities/:activityId`| partial update                               |
| DELETE | `/:stopId/activities/:activityId`|                                              |

Passing `activityId` copies name/cost/duration from the catalogue; any field you also
send overrides it. Without `activityId`, `name` is required.

## Budget — `/trips/:tripId/budget`

| Method | Path                     | Notes                                    |
| ------ | ------------------------ | ---------------------------------------- |
| GET    | `/`                      | breakdown, per-day totals, over-budget   |
| GET    | `/expenses`              | manual expense rows                      |
| POST   | `/expenses`              | `{ category, label, amount, date? }`     |
| PATCH  | `/expenses/:expenseId`   |                                          |
| DELETE | `/expenses/:expenseId`   |                                          |

`totals.ACTIVITIES` is derived from the itinerary and added to any manual
`ACTIVITIES` rows. `perDay[].overAverage` drives the over-budget day warnings.

## Public sharing — `/public`

| Method | Path                  | Auth | Notes                            |
| ------ | --------------------- | ---- | -------------------------------- |
| GET    | `/trips/:slug`        | —    | read-only itinerary + `days[]`   |
| POST   | `/trips/:slug/copy`   | ✓    | deep-copies the trip to the caller |

## Admin — `/admin`  (role `ADMIN`)

| Method | Path      | Notes                                       |
| ------ | --------- | ------------------------------------------- |
| GET    | `/stats`  | counts, top cities, top activities          |
| GET    | `/users`  | latest 100 users with trip counts           |
| GET    | `/trips`  | latest 100 trips                            |

## Health

`GET /api/health` → `{ status: "ok", time }`

## Data model

`User → Trip → TripStop → TripActivity`, with `City`/`Activity` as the shared
catalogue and `Expense` for manual budget lines. Stop order is
`TripStop.orderIndex`, unique per trip; reordering runs in a transaction that
parks rows at negative indexes first so the constraint can't collide mid-update.

See [`prisma/schema.prisma`](prisma/schema.prisma).
