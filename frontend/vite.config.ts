import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'node:path'

const apiGatewayTarget = process.env.VITE_API_BASE_URL?.trim() || 'http://localhost:8080'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/auth': apiGatewayTarget,
      '/repositories': apiGatewayTarget,
      '/analysis-jobs': apiGatewayTarget,
      '/exams': apiGatewayTarget,
      '/healthz': apiGatewayTarget,
    },
  },
})
