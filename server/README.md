# GlobeTrotter API

Base URL: `http://localhost:4000/api`

Auth: `Authorization: Bearer <token>` (a `token` cookie is also accepted).
Errors: `{ "error": string, "details"?: unknown }` with a matching HTTP status.
Lists are paginated: `{ items, total, page, limit, pages }`.

## Auth — `/auth`

| Method | Path               | Auth | Notes                                            |
| ------ | ------------------ | ---- | ------------------------------------------------ |
| POST   | `/signup`          | —    | see below                                        |
| POST   | `/login`           | —    | returns `{ user, token }`                        |
| GET    | `/me`              | ✓    | current user                                     |
| POST   | `/forgot-password` | —    | always 200; dev responses include `devResetToken` |
| POST   | `/reset-password`  | —    | `{ token, password }`                            |

`POST /signup` accepts `{ email, password }` plus **either** `name` **or** both
`firstName` and `lastName` — the display name is derived from the pair when only those
are sent. Optional: `phone`, `bio`, `city`, `country`.

**Rate limits.** Three separate budgets, all keyed on client IP, all returning `429`:

| Route | Window | Default | Counts |
| --- | --- | --- | --- |
| `/login` | 15 min | `AUTH_RATE_LIMIT_MAX` = 20 | failed attempts only |
| `/signup` | 1 hour | `SIGNUP_RATE_LIMIT_MAX` = 10 | every request |
| `/forgot-password`, `/reset-password` | 1 hour | `RESET_RATE_LIMIT_MAX` = 5 | every request |

Login skips successful requests so a legitimate user on a shared IP cannot lock
themselves out; signup counts everything, because a *successful* signup is exactly what
an abuser wants. Set `TRUST_PROXY` to the number of reverse proxies in front of the app,
or every client will look like one IP and the limits will fire on the wrong people.

## Users — `/users`  (all require auth)

| Method | Path                             | Notes                       |
| ------ | -------------------------------- | --------------------------- |
| PATCH  | `/me`                            | name, firstName, lastName, phone, bio, avatarUrl, city, country, language |
| POST   | `/me/avatar`                     | `multipart/form-data`, field `image` |
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
| POST   | `/:tripId/cover`    | `multipart/form-data`, field `image`         |

Dates are `YYYY-MM-DD`. `endDate` must be on or after `startDate` — checked against the
stored value too, so a partial `PATCH` cannot invert an existing range.

`filter` buckets are disjoint: `upcoming` is *not yet started*, `ongoing` is *running
today*, `past` is *finished*. A trip starting today counts as `ongoing`.

`GET /trips` returns a **lighter shape than `GET /trips/:tripId`** — each stop carries only
its `id`, `city` and `activities: [{ id }]` (enough to count experiences on a card), and
there are no `expenses`. Type it as `TripListItem`, not `Trip`.

## Stops — `/trips/:tripId/stops`

| Method | Path                             | Notes                                        |
| ------ | -------------------------------- | -------------------------------------------- |
| GET    | `/`                              | ordered stops with city + activities         |
| POST   | `/`                              | `{ cityId, startDate, endDate, notes?, budget? }` |
| PUT    | `/reorder`                       | `{ stopIds: [...] }` — must list every stop  |
| PATCH  | `/:stopId`                       | partial update                               |
| DELETE | `/:stopId`                       | cascades to its activities                   |
| PUT    | `/:stopId/activities/reorder`    | `{ activityIds: [...] }` — every activity on the stop |
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
| GET    | `/trips`              | —    | community feed — `?q&country&sort=recent\|soonest\|stops&page&limit` |
| GET    | `/countries`          | —    | country filter options for the feed |
| GET    | `/trips/:slug`        | —    | read-only itinerary + `days[]`   |
| POST   | `/trips/:slug/copy`   | ✓    | deep-copies the trip to the caller |

`GET /trips` searches trip name, description **and** the cities on the itinerary. Each
card carries `stopCount`, a flattened `cities[]` and the author's public profile — the
owner's `userId` is not exposed.

## Admin — `/admin`  (role `ADMIN`)

| Method | Path      | Notes                                       |
| ------ | --------- | ------------------------------------------- |
| GET    | `/stats`  | counts, top cities, top activities          |
| GET    | `/users`  | paginated — `?page&limit` (max 100)         |
| GET    | `/trips`  | paginated — `?page&limit` (max 100)         |

## Uploads

`POST /users/me/avatar` and `POST /trips/:tripId/cover` take `multipart/form-data` with a
single field named `image`. JPEG, PNG and WebP only, capped at `MAX_UPLOAD_BYTES`
(default 5 MB). The stored filename is always random — the client-supplied name is
discarded — and the response carries a `/uploads/<name>` URL served as a static file.
Replacing an image deletes the previous one. In Docker, `/app/uploads` is a volume;
without one, images vanish when the container is replaced.

## Health

`GET /api/health` → `{ status: "ok", time }`

## Data model

`User → Trip → TripStop → TripActivity`, with `City`/`Activity` as the shared
catalogue and `Expense` for manual budget lines. Stop order is
`TripStop.orderIndex`, unique per trip; reordering runs in a transaction that
parks rows at negative indexes first so the constraint can't collide mid-update.

See [`prisma/schema.prisma`](prisma/schema.prisma).
