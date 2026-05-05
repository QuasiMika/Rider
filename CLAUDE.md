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
  auth/         AuthUser.tsx          — AuthContext + useAuth hook
  components/   RideMatchingApp.tsx   — Reads DB role → renders DriverPanel or GuestPanel
                AppLayout.tsx         — Nav wrapper (theme toggle, sign-out)
                RideMatching.css      — Styles shared across all ride-flow components
                GuestPanel.css        — Guest-specific styles (booking page, radar, reviews)
                │
                │  Guest panel — split by UI state
                ├─ GuestPanel.tsx      — Coordinator: useRideMatching + presence subscribe + state routing
                ├─ GuestBooking.tsx    — idle: booking form, geocoding, GPS locate (own local state)
                ├─ GuestSearching.tsx  — waiting: radar animation + cancel button
                └─ GuestRideActive.tsx — matched: driver info, map, pickup slider, review form (own local state)
                │
                │  Driver panel — split by UI state
                ├─ DriverPanel.tsx     — Coordinator: useDriverRequests + presence track + state routing
                ├─ DriverWaiting.tsx   — browsing: pulse animation when idle, request list + RequestItem
                └─ DriverRideActive.tsx — matched: guest info, map, GPS broadcast, complete slider (own local state)

  hooks/        useDriverRequests.ts  — Driver: fetch requests, realtime, accept (exports RequestWithProfile)
                useRideMatching.ts    — Guest: create request, realtime ride watch
                useDriverLocation.ts  — Broadcasts driver GPS position via Supabase broadcast channel
                useResolvedNames.ts   — Reverse-geocodes pickup/destination coords to display names
  pages/        Login.tsx, LandingPage.tsx, Profil.tsx, Help.tsx, ...
  types/        ride.ts               — Shared TypeScript types
  utils/        supabase.ts           — Supabase client singleton

supabase/
  migrations/   Applied in order; do not edit applied migrations
  functions/    Deno edge functions (match-ride, accept-ride)
```

### Component state ownership

Each coordinator (GuestPanel, DriverPanel) owns only the state that must survive a panel switch or drives the routing decision. Sub-components own their own local state.

| Component | Owns |
|-----------|------|
| `GuestPanel` | `status`, `currentRide`, `onlineDrivers` (presence count) |
| `GuestBooking` | input text, geocoding, GPS locating |
| `GuestRideActive` | driver profile, driver position, ETA, pickup slider, review |
| `DriverPanel` | `status`, `currentRide`, presence channel (track self as online) |
| `DriverWaiting` | — (stateless, all props from parent) |
| `DriverRideActive` | guest profile, complete slider, `useDriverLocation` |

### Realtime channels

| Channel | Purpose |
|---------|---------|
| `drivers-online` | Presence — drivers track themselves; guests count presences for "X Fahrer online" badge |
| `ride-location:<rideId>` | Broadcast — driver sends GPS updates; guest receives position + ETA |
| `guest-requests-driver-<driverId>` | Postgres changes — driver sees new/removed guest requests |
| `rides-driver-<userId>` / `rides-guest-<userId>` | Postgres changes — both sides detect ride INSERT/UPDATE |

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
Written by `useRideMatching.submitAvailability` (driver role). Presence channel (`drivers-online`) is the live online-count source for guests; this table is the durable fallback and is read by `atomic_match_ride`.

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
| 20240104000000_guest_request_destination.sql | Adds `destination` column to `guest_requests` |
| 20240105000000_ride_locations.sql | Pickup/destination columns on `rides`, location tracking infrastructure |
| 20240106000000_pickup_status.sql | `picked_up` ride status, `confirm_pickup` RPC |
| 20240107000000_complete_ride.sql | `complete_ride` RPC, `actual_end_location` column |
| 20240108000000_ride_reports.sql | `ride_reports` table + RLS |
| 20240109000000_ride_reviews.sql | `ride_reviews` table (stars) + RLS |
| 20240110000000_driver_availability_guest_read.sql | SELECT policy so guests can read available drivers; adds table to realtime publication |
