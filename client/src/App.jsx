import React, { useState, useEffect } from 'react'
import { Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import {
  LayoutDashboard, Package, Tag, Warehouse, BarChart3,
  Settings, ShirtIcon, ChevronRight, Wifi, WifiOff
} from 'lucide-react'
import Dashboard from './pages/Dashboard/Dashboard'
import Products from './pages/Products/Products'
import Categories from './pages/Categories/Categories'
import Inventory from './pages/Inventory/Inventory'
import Reports from './pages/Reports/Reports'
import SettingsPage from './pages/Settings/Settings'
import socket from './socket'

const NAV = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/products', icon: Package, label: 'Products' },
  { to: '/categories', icon: Tag, label: 'Categories' },
  { to: '/inventory', icon: Warehouse, label: 'Inventory' },
  { to: '/reports', icon: BarChart3, label: 'Reports' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

const PAGE_TITLES = {
  '/': { title: 'Dashboard', sub: 'Overview of your inventory' },
  '/products': { title: 'Products', sub: 'Manage your uniform products' },
  '/categories': { title: 'Categories', sub: 'Manage product categories' },
  '/inventory': { title: 'Inventory', sub: 'Update stock quantities' },
  '/reports': { title: 'Reports', sub: 'Inventory summary & insights' },
  '/settings': { title: 'Settings', sub: 'Configure your shop' },
}

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [connected, setConnected] = useState(socket.connected)
  const location = useLocation()
  const pageInfo = PAGE_TITLES[location.pathname] || PAGE_TITLES['/']

  useEffect(() => {
    const onConnect = () => setConnected(true)
    const onDisconnect = () => setConnected(false)
    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    return () => { socket.off('connect', onConnect); socket.off('disconnect', onDisconnect) }
  }, [])

  return (
    <div className="layout">
      {sidebarOpen && (
        <div
          style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:99 }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`sidebar${sidebarOpen ? ' open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <div className="sidebar-logo-icon">
              <ShirtIcon size={20} color="white" />
            </div>
            <div className="sidebar-logo-text">
              <h2>UniStock</h2>
              <p>Inventory Manager</p>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-label">Main Menu</div>
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <Icon className="nav-icon" />
              {label}
              <ChevronRight size={14} style={{ marginLeft:'auto', opacity:0.4 }} />
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="user-avatar">A</div>
            <div className="user-info">
              <p>Administrator</p>
              <span style={{ display:'flex', alignItems:'center', gap:4 }}>
                {connected
                  ? <><Wifi size={11} style={{ color:'#4ade80' }} /><span style={{ color:'#4ade80' }}>Live sync on</span></>
                  : <><WifiOff size={11} style={{ color:'#f87171' }} /><span style={{ color:'#f87171' }}>Reconnecting…</span></>
                }
              </span>
            </div>
          </div>
        </div>
      </aside>

      <div className="main-content">
        <header className="topbar">
          <button className="btn btn-ghost btn-icon" id="menu-btn" onClick={() => setSidebarOpen(true)}>
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <div className="topbar-title">
            <h1>{pageInfo.title}</h1>
            <p>{pageInfo.sub}</p>
          </div>
          <div className="topbar-right">
            <div style={{
              display:'flex', alignItems:'center', gap:6,
              padding:'5px 12px', borderRadius:20,
              background: connected ? 'var(--green-bg)' : 'var(--red-bg)',
              border: `1px solid ${connected ? '#bbf7d0' : '#fecaca'}`,
              fontSize:12, fontWeight:600,
              color: connected ? 'var(--green)' : 'var(--red)',
            }}>
              <span style={{
                width:7, height:7, borderRadius:'50%',
                background: connected ? 'var(--green)' : 'var(--red)',
                animation: connected ? 'pulse 2s infinite' : 'none'
              }} />
              {connected ? 'Live' : 'Offline'}
            </div>
            <span className="topbar-date">
              {new Date().toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric', year:'numeric' })}
            </span>
          </div>
        </header>

        <main className="page-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/products" element={<Products />} />
            <Route path="/categories" element={<Categories />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>

      <Toaster position="top-right" toastOptions={{ duration:3000, style:{ borderRadius:'10px', fontSize:'14px' } }} />

      <style>{`
        @media (max-width: 900px) { #menu-btn { display: flex !important; } }
        @keyframes pulse {
          0%,100% { opacity:1; }
          50% { opacity:0.4; }
        }
      `}</style>
    </div>
  )
}
