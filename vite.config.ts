import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    host: '0.0.0.0',
    port: 3333,
    strictPort: true,
    // Allow E2B domains with wildcard - leading period matches all subdomains
    allowedHosts: ['.lyzrcompute.com', 'localhost', '127.0.0.1'],
    hmr: {
      overlay: false
    }
  },
  preview: {
    host: '0.0.0.0',
    port: 3333,
    strictPort: true
  }
})