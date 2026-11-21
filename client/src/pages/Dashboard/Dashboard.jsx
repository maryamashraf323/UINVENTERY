import React, { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Package, Tag, Layers, AlertTriangle, XCircle, TrendingUp, ArrowRight } from 'lucide-react'
import { getDashboard } from '../../api'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import StockBadge from '../../components/StockBadge'
import socket from '../../socket'

const COLORS = ['#1e3a5f','#2d5a8e','#3b82f6','#60a5fa','#93c5fd','#bfdbfe']

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    getDashboard().then(r => { setData(r.data); setLoading(false) })
  }, [])

  useEffect(() => {
    load()
    // Real-time: server pushes full dashboard data on any change
    socket.on('dashboard:update', (freshData) => setData(freshData))
    return () => socket.off('dashboard:update')
  }, [load])

  if (loading) return (
    <div className="loading-screen"><div className="spin-dark" /><p className="text-mid">Loading...</p></div>
  )

  const { total_products, total_categories, total_units, low_stock, out_of_stock,
          recent_products, low_stock_products, category_stock } = data

  const stats = [
    { label:'Total Products', value:total_products, icon:Package, bg:'#eff6ff', color:'#3b82f6' },
    { label:'Categories', value:total_categories, icon:Tag, bg:'#f0fdf4', color:'#16a34a' },
    { label:'Total Units', value:total_units, icon:Layers, bg:'#faf5ff', color:'#7c3aed' },
    { label:'Low Stock', value:low_stock, icon:AlertTriangle, bg:'#fff7ed', color:'#ea580c' },
    { label:'Out of Stock', value:out_of_stock, icon:XCircle, bg:'#fef2f2', color:'#dc2626' },
  ]

  return (
    <div>
      {(low_stock > 0 || out_of_stock > 0) && (
        <div className="alert alert-warning" style={{ marginBottom:24 }}>
          <AlertTriangle size={18} style={{ flexShrink:0, marginTop:1 }} />
          <div>
            <strong>Attention: </strong>
            {out_of_stock > 0 && <span>{out_of_stock} product(s) are <strong>out of stock</strong>. </span>}
            {low_stock > 0 && <span>{low_stock} product(s) have <strong>low stock</strong>.</span>}
            <Link to="/inventory" style={{ marginLeft:8, color:'inherit', fontWeight:600, textDecoration:'underline' }}>
              Update Inventory →
            </Link>
          </div>
        </div>
      )}

      <div className="stat-cards">
        {stats.map(s => (
          <div className="stat-card" key={s.label}>
            <div className="stat-icon" style={{ background:s.bg }}>
              <s.icon size={22} color={s.color} />
            </div>
            <div className="stat-info">
              <p>{s.label}</p>
              <h3 style={{ color:s.color }}>{s.value}</h3>
            </div>
          </div>
        ))}
      </div>

      <div className="dashboard-bottom">
        {/* Recent Products */}
        <div>
          <div className="section-header">
            <div>
              <div className="section-title">Recent Products</div>
              <div className="section-subtitle">Latest added</div>
            </div>
            <Link to="/products" className="btn btn-outline btn-sm">View All <ArrowRight size={14} /></Link>
          </div>
          <div className="table-wrapper">
            {recent_products.length === 0 ? (
              <div className="empty-state"><Package size={36} /><h3>No products yet</h3></div>
            ) : (
              <table>
                <thead><tr><th>Product</th><th>Category</th><th>Qty</th><th>Status</th></tr></thead>
                <tbody>
                  {recent_products.map(p => (
                    <tr key={p.id}>
                      <td>
                        <div style={{ fontWeight:600 }}>{p.name}</div>
                        <div className="text-xs text-light">{[p.size,p.color].filter(Boolean).join(' · ')}</div>
                      </td>
                      <td><span className="badge badge-blue">{p.category_name || 'Uncategorized'}</span></td>
                      <td><strong>{p.quantity}</strong></td>
                      <td><StockBadge quantity={p.quantity} minStock={p.min_stock} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div>
          <div className="section-header">
            <div>
              <div className="section-title">Low Stock Alerts</div>
              <div className="section-subtitle">Products needing restock</div>
            </div>
            <Link to="/inventory" className="btn btn-outline btn-sm">Manage <ArrowRight size={14} /></Link>
          </div>
          <div className="table-wrapper">
            {low_stock_products.length === 0 ? (
              <div className="empty-state"><TrendingUp size={36} /><h3>All stocked up!</h3></div>
            ) : (
              <table>
                <thead><tr><th>Product</th><th>Have</th><th>Min</th><th>Status</th></tr></thead>
                <tbody>
                  {low_stock_products.map(p => (
                    <tr key={p.id}>
                      <td style={{ fontWeight:600 }}>{p.name}</td>
                      <td><span style={{ color:'var(--orange)', fontWeight:700 }}>{p.quantity}</span></td>
                      <td className="text-mid">{p.min_stock}</td>
                      <td><StockBadge quantity={p.quantity} minStock={p.min_stock} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Chart */}
        <div className="dashboard-full">
          <div className="section-header">
            <div>
              <div className="section-title">Stock by Category</div>
              <div className="section-subtitle">Total units per category</div>
            </div>
          </div>
          <div className="chart-card">
            {category_stock.length === 0 ? (
              <div className="empty-state"><h3>No data yet</h3></div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={category_stock} margin={{ top:5, right:20, left:0, bottom:5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize:12, fill:'#64748b' }} />
                  <YAxis tick={{ fontSize:12, fill:'#64748b' }} />
                  <Tooltip contentStyle={{ borderRadius:8, border:'1px solid #e2e8f0', fontSize:13 }} formatter={v => [v,'Units']} />
                  <Bar dataKey="total_units" radius={[6,6,0,0]}>
                    {category_stock.map((_,i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
