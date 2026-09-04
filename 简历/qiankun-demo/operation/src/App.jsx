import { Link, Route, Routes } from 'react-router-dom'

export default function App() {
  return (
    <div className="subApp">
      <h2>【运营管理子应用】</h2>
      <nav className="nav">
        <Link to="/">运营首页</Link>
        <Link to="/content">内容管理</Link>
      </nav>
      <Routes>
        <Route path="/" element={<div className="page">运营管理首页（完整 URL：/operation）</div>} />
        <Route path="/content" element={<div className="page">内容管理页（完整 URL：/operation/content）</div>} />
      </Routes>
    </div>
  )
}
