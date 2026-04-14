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
