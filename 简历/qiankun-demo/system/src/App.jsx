import { Link, Route, Routes } from 'react-router-dom'

export default function App() {
  return (
    <div className="subApp">
      <h2>【系统管理子应用】</h2>
      <nav className="nav">
        <Link to="/">系统首页</Link>
        <Link to="/user">用户管理</Link>
      </nav>
      <Routes>
        <Route path="/" element={<div className="page">系统管理首页（完整 URL：/system）</div>} />
        <Route path="/user" element={<div className="page">用户管理页（完整 URL：/system/user）</div>} />
      </Routes>
    </div>
  )
}
