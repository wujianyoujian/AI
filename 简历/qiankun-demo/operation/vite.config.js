import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import qiankun from 'vite-plugin-qiankun'

export default defineConfig({
  plugins: [
    react(),
    // 应用名必须与主应用 registerMicroApps 的 name 一致
    qiankun('operation', { useDevMode: true }),
  ],
  server: {
    port: 7102,
    headers: { 'Access-Control-Allow-Origin': '*' },
  },
})
