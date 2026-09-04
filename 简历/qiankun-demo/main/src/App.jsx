import { Link, Route, Routes } from 'react-router-dom'
import styles from './App.module.css'

export default function App() {
  return (
    <div className={styles.layout}>
      <nav className={styles.nav}>
        <Link to="/">首页</Link>
        <Link to="/system">系统管理</Link>
        <Link to="/operation">运营管理</Link>
      </nav>

      {/* 主应用自己的路由 */}
      <Routes>
        <Route path="/" element={<div className={styles.home}>主应用首页 —— 点顶部菜单进入子应用</div>} />
      </Routes>

      {/* 子应用挂载点：URL 命中 /system 或 /operation 时，qiankun 会把子应用渲染到这里 */}
      <div id="subapp-container" />
    </div>
  )
}
