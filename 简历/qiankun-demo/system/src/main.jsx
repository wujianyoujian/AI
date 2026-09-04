import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { renderWithQiankun, qiankunWindow } from 'vite-plugin-qiankun/dist/helper'
import App from './App'
import cssText from './App.css?inline' // Vite 的 ?inline：把 CSS 拿成字符串

let root = null
let wrapper = null

function render(props = {}) {
  const { container } = props

  // 独立运行：渲染到 index.html 的 #root，CSS 注入 head
  if (!container) {
    const style = document.createElement('style')
    style.textContent = cssText
    document.head.appendChild(style)
    root = ReactDOM.createRoot(document.getElementById('root'))
    root.render(<BrowserRouter><App /></BrowserRouter>)
    return
  }

  // qiankun 运行：在 container 里新建 wrapper，给它挂 Shadow DOM
  // 每次 mount 用全新 wrapper，避开「attachShadow 一个元素只能调一次」的限制
  wrapper = document.createElement('div')
  container.appendChild(wrapper)
  const shadow = wrapper.attachShadow({ mode: 'open' })

  // 关键：CSS 注入 shadow 内部（head 里的样式进不了 shadow，必须手动塞进来）
  const style = document.createElement('style')
  style.textContent = cssText
  shadow.appendChild(style)

  root = ReactDOM.createRoot(shadow)
  root.render(
    <BrowserRouter basename={qiankunWindow.__POWERED_BY_QIANKUN__ ? '/system' : '/'}>
      <App />
    </BrowserRouter>
  )
}

renderWithQiankun({
  bootstrap() {},
  mount(props) {
    render(props)
  },
  unmount() {
    root?.unmount()
    wrapper?.remove()
  },
  update() {},
})

if (!qiankunWindow.__POWERED_BY_QIANKUN__) {
  render()
}
