# Rider — Architecture Reference

## Stack

- **Frontend:** React 19 + Vite, TypeScript, React Router v6
- **Backend:** Supabase (Postgres, Auth, Realtime, Edge Functions)
- **Styling:** Plain CSS with CSS custom properties (`var(--accent)`, `var(--bg)`, etc.)
- **Language:** German UI text throughout

---

## Project Structure

```
src/
  auth/         AuthUser.tsx        — AuthContext + useAuth hook
  components/   DriverPanel.tsx     — Driver UI (request list → accept → ride)
                GuestPanel.tsx      — Guest UI (request → waiting → ride)
                RideMatchingApp.tsx — Routes to Driver/GuestPanel by DB role
                AppLayout.tsx       — Nav wrapper (theme toggle, sign-out)
                RideMatching.css    — Styles shared by ride flow components
                GuestPanel.css      — Guest-specific animations
  hooks/        useDriverRequests.ts — Driver: fetch requests, realtime, accept
                useRideMatching.ts   — Guest: create request, realtime ride watch
  pages/        Login.tsx, LandingPage.tsx, Profil.tsx, Help.tsx, ...
  types/        ride.ts             — Shared TypeScript types
  utils/        supabase.ts         — Supabase client singleton

supabase/
  migrations/   Applied in order; do not edit applied migrations
  functions/    Deno edge functions (match-ride, accept-ride)
```

---

## Database Schema

### `user_profile`
Auto-created by trigger on `auth.users` insert.

| column | type | notes |
|--------|------|-------|
| user_id | uuid PK | → auth.users |
| first_name / family_name | varchar | |
| role | user_role | `'driver'` or `'customer'` |
| currently_working | bool | unused for now |

### `guest_requests`
Ephemeral — deleted when a driver accepts.

| column | type | notes |
|--------|------|-------|
| id | uuid PK | |
| guest_id | uuid | → auth.users |
| status | text | only `'waiting'` in practice (matched rows are deleted) |
| pickup_location | text | optional, unused |

Unique index: one `'waiting'` row per guest.

### `driver_availability`
Legacy — no longer written by the app. Kept for schema compatibility with `atomic_match_ride`.

### `rides`
Source of truth.

| column | type | notes |
|--------|------|-------|
| id | uuid PK | |
| driver_id | uuid | → auth.users |
| guest_id | uuid | → auth.users |
| status | text | `pending` → `active` → `completed` |

---

## Ride Flow (current)

```
Guest                          Supabase DB              Driver
  │                                │                      │
  │── requestRide() ──────────────>│  INSERT guest_requests│
  │                                │<── realtime INSERT ───│  (sees new request)
  │                                │                      │── acceptRequest(id)
  │                                │                      │     calls accept-ride
  │                                │                      │     edge function
  │                                │  accept_ride() RPC ──│
  │                                │  INSERT rides        │
  │                                │  DELETE guest_request│
  │<── realtime INSERT (rides) ────│                      │<── realtime INSERT (rides)
  │  status = 'matched'            │                  status = 'matched'
```

**Key invariant:** `accept_ride` uses `SELECT … FOR UPDATE SKIP LOCKED` — two drivers racing to accept the same request can never both succeed.

---

## Edge Functions

### `match-ride`
Legacy. Still referenced by `useRideMatching` but effectively a no-op now because `driver_availability` is always empty. Safe to remove in a future cleanup.

### `accept-ride`
Verifies caller JWT → extracts `driver_id` → calls `accept_ride(driver_id, request_id)` RPC with service role.

Returns `{ accepted: true, ride_id }` or `{ accepted: false, reason }`.

---

## Hooks

### `useDriverRequests(driverId)`
Used only by `DriverPanel`.

- On mount: checks for existing active ride (state restore after reload)
- Initial fetch: `guest_requests` WHERE `status='waiting'` + batch profile lookup
- Realtime: INSERT on `guest_requests` → add to list; DELETE → remove from list
- Realtime: INSERT on `rides` WHERE `driver_id=eq.driverId` → set `status='matched'`
- `acceptRequest(requestId)` → calls `accept-ride` edge function

### `useRideMatching(userId, role)`
Used only by `GuestPanel` (role is always `'guest'`).

- On mount: checks for existing active ride or waiting request (state restore)
- `requestRide()`: inserts `guest_requests` row, sets status `'waiting'`, then waits
- Realtime: INSERT on `rides` WHERE `guest_id=eq.userId` → set `status='matched'`

---

## RLS Policies (guest_requests)

| operation | who |
|-----------|-----|
| SELECT | own rows OR (driver role AND status='waiting') |
| INSERT | guest_id = auth.uid() |
| UPDATE | guest_id = auth.uid() |
| DELETE | guest_id = auth.uid() |

Rides: SELECT only, driver_id = uid OR guest_id = uid.

---

## CSS Conventions

All ride-flow styles live in `RideMatching.css` (prefixed `rm-`) and `GuestPanel.css`.
Theme tokens are in `index.css` under `:root` / `[data-theme]`. Dark mode supported.

Key classes: `.rm-card`, `.rm-card--matched`, `.rm-partner`, `.rm-btn`, `.rm-btn--accept`,
`.rm-requests-list`, `.rm-request-item`, `.rm-requests-badge`.

---

## Migrations

Applied in filename order. Never edit an already-applied migration; add a new one.

| file | what it does |
|------|-------------|
| 20240101000000_ride_matching.sql | Initial tables, RLS, `atomic_match_ride` function |
| 20240102000000_ride_matching_cleanup.sql | Unique indexes, updated `atomic_match_ride` to DELETE instead of UPDATE |
| 20240103000000_ride_accept.sql | `accept_ride` function, driver SELECT policy on `guest_requests`, adds table to realtime |
