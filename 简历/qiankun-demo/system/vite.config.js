import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import qiankun from 'vite-plugin-qiankun'

export default defineConfig({
  plugins: [
    react(),
    // 第一个参数是应用名，必须与主应用 registerMicroApps 的 name 一致
    qiankun('system', { useDevMode: true }),
  ],
  server: {
    port: 7101,
    // qiankun 跨端口加载子应用资源需要允许跨域
    headers: { 'Access-Control-Allow-Origin': '*' },
  },
})
