# GlobeTrotter — Empowering Personalized Travel Planning

Multi-city travel planner: build day-wise itineraries, discover cities and activities,
track a budget, and share plans publicly.

Problem statement: `docs/GlobeTrotter.pdf` (kept local, not tracked)
Mockups: https://link.excalidraw.com/l/65VNwvy7c4X/6CzbTgEeSr1

## Stack

| Layer    | Choice                                              |
| -------- | --------------------------------------------------- |
| Frontend | React 18 + Vite + TypeScript + Tailwind              |
| Backend  | Node + Express + TypeScript                          |
| Database | PostgreSQL 16 via Prisma ORM                         |
| Auth     | JWT (Bearer token) + bcrypt                          |
| Infra    | Docker Compose for local Postgres                    |

## Layout

```
globetrotter/
├── client/            React app — UI/design track (Codex)
│   └── src/
│       ├── pages/       one file per screen
│       ├── components/  shared UI
│       ├── layouts/     shells / nav
│       ├── hooks/
│       ├── lib/api.ts   typed fetch wrapper
│       └── types/api.ts server response types
├── server/            Express API — backend track (Claude)
│   ├── prisma/
│   │   ├── migrations/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   ├── tests/          vitest + supertest integration tests
│   └── Dockerfile
│   └── src/
│       ├── config/      env validation
│       ├── lib/         prisma, jwt, password, errors
│       ├── middleware/  auth, validate, error handling
│       ├── modules/     auth, users, trips, stops, cities,
│       │                activities, budget, share, admin
│       └── routes/      router composition
├── docs/
└── docker-compose.yml
```

## Getting started

```bash
# 1. install (npm workspaces — installs both apps)
npm install

# 2. start Postgres
npm run db:up

# 3. configure the server
cp server/.env.example server/.env
#    then set JWT_SECRET:  openssl rand -base64 48

# 4. create the schema + demo data
npm run db:migrate
npm run db:seed

# 5. run both apps
npm run dev:server    # http://localhost:4000/api
npm run dev:client    # http://localhost:5173
```

Seed accounts (password `Password123`):

- `demo@globetrotter.app` — has a fully populated public trip
- `admin@globetrotter.app` — `ADMIN` role, can reach `/api/admin/*`

Vite proxies `/api` → `localhost:4000`, so the frontend calls `/api/...` with no CORS setup.

## Tests

```bash
npm run db:up            # tests need Postgres running
npm test -w server       # 64 integration tests against a real database
```

Tests hit the real API through supertest and a dedicated `globetrotter_test`
database — migrations are applied once per run, and every table is truncated
between cases. Dev data is never touched.

## CI

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on every push and PR:

| Job             | Does                                                          |
| --------------- | ------------------------------------------------------------- |
| `Server`        | migrate → schema-drift check → typecheck → build → test → seed |
| `Client`        | typecheck → build → upload `dist`                              |
| `Server image`  | builds `server/Dockerfile` and boots it                        |

The drift check fails the build if `schema.prisma` no longer matches the
committed migrations — i.e. someone edited the schema without generating one.

## Deploying the server

```bash
docker build -f server/Dockerfile -t globetrotter-server .
docker run -p 4000:4000 -e DATABASE_URL=... -e JWT_SECRET=... globetrotter-server
```

The image applies pending migrations on boot, then starts the API.

## API

Full endpoint list: [`server/README.md`](server/README.md)

## Track ownership

- **`server/`, `prisma/`, infra** — backend track. Do not edit from the design branch.
- **`client/src/pages`, `components`, `layouts`, `styles`** — design/frontend track.
- **Contract files** (`client/src/types/api.ts`, `client/src/lib/api.ts`) — change only
  alongside the matching server change.

Both tracks work on separate branches and merge via PR.
