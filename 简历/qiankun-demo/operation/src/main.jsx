import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { renderWithQiankun, qiankunWindow } from 'vite-plugin-qiankun/dist/helper'
import App from './App'
import cssText from './App.css?inline'

let root = null
let wrapper = null

function render(props = {}) {
  const { container } = props

  if (!container) {
    const style = document.createElement('style')
    style.textContent = cssText
    document.head.appendChild(style)
    root = ReactDOM.createRoot(document.getElementById('root'))
    root.render(<BrowserRouter><App /></BrowserRouter>)
    return
  }

  wrapper = document.createElement('div')
  container.appendChild(wrapper)
  const shadow = wrapper.attachShadow({ mode: 'open' })

  const style = document.createElement('style')
  style.textContent = cssText
  shadow.appendChild(style)

  root = ReactDOM.createRoot(shadow)
  root.render(
    <BrowserRouter basename={qiankunWindow.__POWERED_BY_QIANKUN__ ? '/operation' : '/'}>
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
