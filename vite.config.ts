import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
  },
  // Set base to '/' for GitLab Pages with a custom domain,
  // or '/repo-name/' if deploying to a project namespace.
  // Update this to match your GitLab Pages URL path.
  base: '/',
})
