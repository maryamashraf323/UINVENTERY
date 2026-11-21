import React, { useEffect, useState, useCallback } from 'react'
import { getReports } from '../../api'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts'
import { TrendingUp, Package, AlertTriangle, XCircle } from 'lucide-react'
import StockBadge from '../../components/StockBadge'
import socket from '../../socket'

const COLORS = ['#1e3a5f','#2d5a8e','#3b82f6','#60a5fa','#93c5fd','#bfdbfe']

export default function Reports() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('summary')

  const load = useCallback(() => {
    getReports().then(r => { setData(r.data); setLoading(false) })
  }, [])

  useEffect(() => {
    load()
    // Refresh reports when any change happens
    socket.on('products:change', load)
    socket.on('categories:change', load)
    return () => {
      socket.off('products:change', load)
      socket.off('categories:change', load)
    }
  }, [load])

  if (loading) return <div className="loading-screen"><div className="spin-dark" /></div>

  const { summary, by_category, low_stock_items, out_of_stock_items } = data

  return (
    <div>
      <div className="page-header">
        <div><h1>Reports</h1><p>Inventory overview and stock insights</p></div>
      </div>

      {/* Summary cards — no price values */}
      <div className="report-cards">
        {[
          { label:'Total Products', value:summary.total_products, icon:Package, color:'#3b82f6' },
          { label:'Total Stock Units', value:summary.total_units, icon:TrendingUp, color:'#16a34a' },
          { label:'Low Stock Items', value:summary.low_stock, icon:AlertTriangle, color:'#ea580c' },
          { label:'Out of Stock', value:summary.out_of_stock, icon:XCircle, color:'#dc2626' },
        ].map(s => (
          <div className="report-card" key={s.label}>
            <div className="flex items-center gap-2 mb-1">
              <s.icon size={16} color={s.color} />
              <span className="label">{s.label}</span>
            </div>
            <div className="value" style={{ color:s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="tabs">
        {[
          { key:'summary', label:'By Category' },
          { key:'low', label:`Low Stock (${summary.low_stock})` },
          { key:'out', label:`Out of Stock (${summary.out_of_stock})` },
        ].map(t => (
          <button key={t.key} className={`tab-btn${tab===t.key?' active':''}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Category breakdown */}
      {tab === 'summary' && (
        <div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:24 }}>
            <div className="chart-card">
              <div className="section-title" style={{ marginBottom:16 }}>Units by Category</div>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={by_category} margin={{ top:5, right:10, left:0, bottom:40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="category" tick={{ fontSize:11, fill:'#64748b' }} angle={-30} textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize:11, fill:'#64748b' }} />
                  <Tooltip contentStyle={{ borderRadius:8, border:'1px solid #e2e8f0', fontSize:13 }} />
                  <Bar dataKey="total_units" name="Units" radius={[5,5,0,0]}>
                    {by_category.map((_,i) => <Cell key={i} fill={COLORS[i%COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="chart-card">
              <div className="section-title" style={{ marginBottom:16 }}>Products by Category</div>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={by_category} dataKey="product_count" nameKey="category"
                    cx="50%" cy="50%" outerRadius={90}
                    label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`}>
                    {by_category.map((_,i) => <Cell key={i} fill={COLORS[i%COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius:8, fontSize:13 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>Category</th><th>Products</th><th>Total Units</th></tr>
              </thead>
              <tbody>
                {by_category.map(c => (
                  <tr key={c.category}>
                    <td><strong>{c.category}</strong></td>
                    <td>{c.product_count}</td>
                    <td>{c.total_units}</td>
                  </tr>
                ))}
                {by_category.length === 0 && (
                  <tr><td colSpan={3} style={{ textAlign:'center', padding:40, color:'var(--text-light)' }}>No data</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'low' && (
        <div className="table-wrapper">
          {low_stock_items.length === 0 ? (
            <div className="empty-state"><AlertTriangle size={40} /><h3>No low stock items</h3><p>All products are well stocked.</p></div>
          ) : (
            <table>
              <thead><tr><th>Product</th><th>Category</th><th>Current Stock</th><th>Min Level</th><th>Status</th></tr></thead>
              <tbody>
                {low_stock_items.map(p => (
                  <tr key={p.id}>
                    <td><strong>{p.name}</strong></td>
                    <td><span className="badge badge-blue">{p.category_name || '—'}</span></td>
                    <td><span style={{ color:'var(--orange)', fontWeight:700 }}>{p.quantity}</span></td>
                    <td>{p.min_stock}</td>
                    <td><StockBadge quantity={p.quantity} minStock={p.min_stock} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'out' && (
        <div className="table-wrapper">
          {out_of_stock_items.length === 0 ? (
            <div className="empty-state"><XCircle size={40} /><h3>No out-of-stock items</h3></div>
          ) : (
            <table>
              <thead><tr><th>Product</th><th>Category</th><th>Size</th><th>Color</th><th>Status</th></tr></thead>
              <tbody>
                {out_of_stock_items.map(p => (
                  <tr key={p.id}>
                    <td><strong>{p.name}</strong></td>
                    <td><span className="badge badge-blue">{p.category_name || '—'}</span></td>
                    <td className="text-mid">{p.size || '—'}</td>
                    <td className="text-mid">{p.color || '—'}</td>
                    <td><StockBadge quantity={p.quantity} minStock={p.min_stock} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
