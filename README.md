## React + TypeScript + Vite

| Tool | Version | Docs |
|------|---------|------|
| [React](https://react.dev/) | ^19 | [Documentation](https://react.dev/reference/react) |
| [Vite](https://vite.dev/) | ^6 | [Documentation](https://vite.dev/guide/) |
| [Node.js](https://nodejs.org/) | ≥ 18 | [Documentation](https://nodejs.org/en/docs) |
| [npm](https://www.npmjs.com/) | ≥ 9 | [Documentation](https://docs.npmjs.com/) |

---

## ✅ Prerequisites

Before you begin, make sure you have **Node.js** and **npm** installed on your machine.

### Check if Node.js & npm are installed

Open a terminal and run:

```bash
node -v
npm -v
```

If both commands return a version number, you're good to go. If not, follow the steps below.

---

### Installing Node.js & npm

npm is bundled with Node.js, so installing Node.js is all you need.

1. Go to [https://nodejs.org](https://nodejs.org)
2. Download the **LTS** version (Long Term Support — most stable)
3. Run the installer and follow the steps
4. Restart your terminal, then verify with `node -v` and `npm -v`

## 📦 Installation

1. **Clone the repository**

```bash
git clone https://github.com/your-username/your-repo-name.git
cd your-repo-name
```

2. **Install dependencies**

```bash
npm install
```

> This will install all packages listed in `package.json` into a local `node_modules/` folder.

---

## ▶️ Running the Project

### Development server

Starts a local dev server with hot module replacement (HMR):

```bash
npm run dev
```

Open your browser and visit: [http://localhost:5173](http://localhost:5173)

### Production build

Bundles the app for production into the `dist/` folder:

```bash
npm run build
```

### Preview production build

Serves the production build locally to test before deploying:

```bash
npm run preview
```


---

## Supabase Auth Setup

Email + password auth using Supabase. A Postgres trigger creates a `user_profile` row for every new user based on the signup metadata. Reference: [Managing user data](https://supabase.com/docs/guides/auth/managing-user-data?queryGroups=language&language=js).

### Database schema

```sql
CREATE TYPE user_role AS ENUM ('driver', 'customer');

CREATE TABLE public.user_profile (
  user_id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  first_name        varchar,
  family_name       varchar,
  role              user_role NOT NULL DEFAULT 'customer',
  currently_working boolean NOT NULL DEFAULT false
);
```

### Trigger — auto-creates `user_profile` on signup

Reads `first_name`, `family_name`, and `role` from `raw_user_meta_data` that the frontend passes in `signUp({ options: { data } })`.

```sql
CREATE OR REPLACE FUNCTION public.insert_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.user_profile (user_id, first_name, family_name, role, currently_working)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'family_name',
    COALESCE(
      (NEW.raw_user_meta_data->>'role')::public.user_role,
      'customer'::public.user_role
    ),
    false
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.insert_user_profile();
```

### Row Level Security

```sql
CREATE POLICY "Users can read own profile"
ON public.user_profile FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
ON public.user_profile FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
```

### Supabase dashboard settings

- **Authentication → Providers → Email**: enabled
- **Authentication → Sign In / Providers → Confirm email**: disabled (for local dev — users are signed in immediately after signup)

### Frontend structure

| Path | Purpose |
|------|---------|
| `src/utils/supabase.ts` | Supabase client initialization |
| `src/auth/AuthUser.tsx` | `AuthProvider` + `useAuth()` hook — wraps `signIn`, `signUp`, `signOut` and exposes `user` / `session` |
| `src/pages/Login.tsx` | Email + password login form |
| `src/pages/Register.tsx` | Registration form with first name, last name, role (customer / driver) |
| `src/pages/Protected.tsx` | Example protected page that reads the logged-in user's `user_profile` |
| `src/App.tsx` | Routes + inline `ProtectedRoute` that redirects to `/login` when no user |

The signup call passes profile fields as user metadata so the trigger can read them:

```ts
await supabase.auth.signUp({
  email,
  password,
  options: { data: { first_name, family_name, role } },
})
```

---

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
