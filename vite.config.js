import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages serves a project repo at https://<user>.github.io/<repo>/,
// so every asset URL needs that sub-path prefix. `base` must match the
// repository name exactly. If you name the repo something other than
// "overload", change this to '/<your-repo-name>/'.
export default defineConfig({
  base: '/overload/',
  plugins: [react()],
})
