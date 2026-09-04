import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerMicroApps, start } from 'qiankun'
import App from './App'
import './index.css'

// 注册两个子应用，通过路由前缀激活
registerMicroApps([
  {
    name: 'system',                 // 必须与子应用 vite-plugin-qiankun 的应用名一致
    entry: '//localhost:7101',      // system 子应用 dev server 地址
    container: '#subapp-container', // 子应用挂载到的 DOM 节点
    activeRule: '/system',          // 命中 /system 前缀时激活
  },
  {
    name: 'operation',
    entry: '//localhost:7102',
    container: '#subapp-container',
    activeRule: '/operation',
  },
])

// 样式隔离改用「子应用手动挂 Shadow DOM」实现，见子应用 main.jsx
start()

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
)
