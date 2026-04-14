import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from "path";

// Derive base path from GITHUB_REPOSITORY (e.g. "user/rider" → "/rider/")
// Falls back to "/" for local dev and user/org pages.
const repo = process.env.GITHUB_REPOSITORY?.split('/')[1];

export default defineConfig({
  base: repo ? `/${repo}/` : '/',
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});