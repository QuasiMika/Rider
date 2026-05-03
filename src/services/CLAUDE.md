# Services Layer Architecture

This directory is the **sole boundary** between the application and any backend provider.
Nothing outside `src/services/` may import from `@supabase/supabase-js` or touch the
Supabase client directly.

---

## Directory layout

```
src/services/
  types/          ← Provider-agnostic TypeScript interfaces (no runtime code)
    auth.ts       — AuthService, AuthUser, AuthSession, UserRole
    db.ts         — DbService, ServiceError, UserProfile, GuestRequestRow, ReportRow
    functions.ts  — FunctionsService (edge function calls)
    realtime.ts   — RealtimeService, PresenceService, LocationBroadcast, DriverLocationPayload

  supabase/       ← Concrete Supabase implementations of every interface above
    client.ts     — Single createClient() call; imported only within this folder
    auth.ts       — supabaseAuthService
    db.ts         — supabaseDbService
    functions.ts  — supabaseFunctionsService
    presence.ts   — supabasePresenceService
    realtime.ts   — supabaseRealtimeService

  index.ts        ← Only export point for the entire app
```

---

## Contracts

### `AuthService` (`types/auth.ts`)
Wraps `supabase.auth.*`. Key design decisions:
- `onAuthStateChange` returns a plain `() => void` unsubscribe — no Supabase subscription object leaks out.
- `getSession` returns our own `AuthSession` type (`{ access_token, user: AuthUser }`), not the Supabase `Session`.
- The `AuthUser` type only exposes `id` and `email` — the fields the app actually uses.

### `DbService` (`types/db.ts`)
Wraps all `supabase.from(…)` queries and RPCs.
- **Reads that callers check for errors** (e.g. `getUserProfile`) return `{ data: T | null; error: ServiceError | null }`.
- **Reads that callers only use the value** return `T | null` directly (null on both not-found and error).
- **Writes** always return `{ error: ServiceError | null }`.
- `ServiceError` is `{ message: string }` — never a Supabase `PostgrestError`.
- RPCs (`confirmPickup`, `completeRide`, `getPublicStats`) are modelled as typed methods, not raw `.rpc()` calls.

### `FunctionsService` (`types/functions.ts`)
Wraps `supabase.functions.invoke(…)`. The implementation fetches the session token internally — callers never handle auth headers.

Methods:
- `invokeMatchRide(role, recordId)` → `MatchResult`
- `invokeAcceptRide(requestId)` → `AcceptResult`
- `invokeCreateCheckout(rideId)` → `{ url } | null`

### `RealtimeService` (`types/realtime.ts`)
Wraps Supabase Realtime channels. Every method returns `() => void` so hooks can call it directly in `useEffect` cleanup.

| Method | Used by |
|--------|---------|
| `subscribeGuestRequests(channelId, onInsert, onDelete)` | `useDriverRequests` |
| `subscribeRideByDriverId(channelId, driverId, onInsert, onUpdate)` | `useDriverRequests`, `useRideMatching` |
| `subscribeRideByGuestId(channelId, guestId, onInsert, onUpdate)` | `useRideMatching` |
| `subscribeDriverLocation(rideId, onLocation)` | `GuestRideActive` |
| `createLocationBroadcast(rideId)` → `LocationBroadcast` | `useDriverLocation` |

`LocationBroadcast` is a stateful object with `subscribe / send / close` — used by the driver to both open the channel and stream GPS updates on it.

### `PresenceService` (`types/realtime.ts`)
Kept separate from `RealtimeService` because presence and broadcast/postgres-changes have different mental models.

| Method | Used by |
|--------|---------|
| `trackOnline(channelId, userId)` → `() => void` | `DriverPanel` |
| `subscribeOnlineCount(channelId, onCount)` → `() => void` | `GuestPanel` |

---

## `index.ts` — the only import point

All application code imports services from here:

```ts
import { authService, dbService, realtimeService, presenceService, functionsService } from '../services'
import type { UserProfile, ServiceError, DriverLocationPayload } from '../services'
```

### Swapping the backend (`VITE_USE_MOCK_BACKEND`)

The index file exports the five Supabase implementations by default. To swap to mocks:

1. Create `src/services/mock/{auth,db,functions,realtime,presence}.ts` implementing the same interfaces.
2. In `index.ts`, replace the five `supabase*` imports with the `mock*` imports.
3. Set `VITE_USE_MOCK_BACKEND=true` in your env file.

No hook, component, or page needs to change.

---

## Hard rules

- `@supabase/supabase-js` may only be imported inside `src/services/supabase/`.
- `supabase/client.ts` is the only file that calls `createClient()`.
- Never add a method to a service interface that exposes a Supabase type in its signature.
- All errors surface as `ServiceError` (`{ message: string }`), never as `PostgrestError` or `FunctionsHttpError`.
- Every realtime / presence subscription must return `() => void` so hooks can use it as a `useEffect` cleanup directly.
