# Working agreement

Two tracks, separate branches, merged by PR.

## Backend track (Claude)

Owns: `server/**`, `docker-compose.yml`, `.github/**`, deployment config.

## Frontend / design track (Codex)

Owns: `client/src/pages`, `client/src/components`, `client/src/layouts`,
`client/src/styles`, `client/src/hooks`, `client/index.html`, Tailwind config.

Reference: mockups at https://link.excalidraw.com/l/65VNwvy7c4X/6CzbTgEeSr1
and the screen list in `docs/GlobeTrotter.pdf`.

## Shared contract — coordinate before changing

- `client/src/types/api.ts` — mirrors server response shapes
- `client/src/lib/api.ts` — fetch wrapper and token storage
- `server/README.md` — the endpoint list both sides code against

If a screen needs data the API does not return, raise it rather than reshaping the
response client-side.

## Rules

- Never commit to `main`. Branch per task: `feat/<track>-<description>`.
- Do not edit the other track's files on your branch.
- Run `npm run typecheck` and `npm test -w server` before opening a PR.
- CI must be green before a PR is merged.
- Never commit `server/.env`.
