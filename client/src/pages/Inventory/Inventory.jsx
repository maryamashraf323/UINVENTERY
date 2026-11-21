import React, { useEffect, useState, useCallback } from 'react'
import { Search, RefreshCw, X, History, Package } from 'lucide-react'
import toast from 'react-hot-toast'
import { getProducts, getCategories, updateStock, getStockLogs } from '../../api'
import StockBadge from '../../components/StockBadge'
import socket from '../../socket'

export default function Inventory() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [updateModal, setUpdateModal] = useState(null)
  const [logModal, setLogModal] = useState(null)
  const [logs, setLogs] = useState([])
  const [form, setForm] = useState({ change_type:'add', quantity_change:'', note:'' })
  const [saving, setSaving] = useState(false)

  const loadProducts = useCallback((params = {}) => {
    getProducts(params).then(r => { setProducts(r.data); setLoading(false) })
  }, [])

  useEffect(() => {
    loadProducts()
    getCategories().then(r => setCategories(r.data))

    const onProductsChange = () => {
      loadProducts({ search: search || undefined, category_id: filterCat || undefined, status: filterStatus || undefined })
    }
    socket.on('products:change', onProductsChange)
    socket.on('categories:change', () => getCategories().then(r => setCategories(r.data)))
    return () => {
      socket.off('products:change', onProductsChange)
      socket.off('categories:change')
    }
  }, [search, filterCat, filterStatus])

  useEffect(() => {
    loadProducts({ search: search || undefined, category_id: filterCat || undefined, status: filterStatus || undefined })
  }, [search, filterCat, filterStatus])

  const openUpdate = (p) => { setUpdateModal(p); setForm({ change_type:'add', quantity_change:'', note:'' }) }
  const openLogs = (p) => { setLogModal(p); getStockLogs(p.id).then(r => setLogs(r.data)) }

  const handleUpdate = async (e) => {
    e.preventDefault()
    if (!form.quantity_change || parseInt(form.quantity_change) <= 0)
      return toast.error('Enter a valid quantity (must be > 0)')
    setSaving(true)
    try {
      await updateStock({
        product_id: updateModal.id,
        change_type: form.change_type,
        quantity_change: parseInt(form.quantity_change),
        note: form.note
      })
      toast.success('Stock updated!')
      setUpdateModal(null)
      // products:change will refresh the list for all admins
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update stock')
    } finally {
      setSaving(false)
    }
  }

  const getNewQty = () => {
    if (!updateModal) return null
    const change = parseInt(form.quantity_change) || 0
    if (form.change_type === 'add') return updateModal.quantity + change
    if (form.change_type === 'remove') return Math.max(0, updateModal.quantity - change)
    if (form.change_type === 'set') return Math.max(0, change)
    return null
  }

  const newQty = getNewQty()

  return (
    <div>
      <div className="page-header">
        <div><h1>Inventory</h1><p>Update and manage stock quantities</p></div>
      </div>

      <div className="table-wrapper">
        <div className="table-toolbar">
          <div className="search-input-wrap">
            <Search className="search-icon" />
            <input placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select value={filterCat} onChange={e => setFilterCat(e.target.value)} style={{ minWidth:160 }}>
            <option value="">All Categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ minWidth:150 }}>
            <option value="">All Status</option>
            <option value="in">In Stock</option>
            <option value="low">Low Stock</option>
            <option value="out">Out of Stock</option>
          </select>
          {(search || filterCat || filterStatus) && (
            <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setFilterCat(''); setFilterStatus('') }}>
              <X size={14} /> Clear
            </button>
          )}
        </div>

        {loading ? (
          <div className="loading-screen"><div className="spin-dark" /></div>
        ) : products.length === 0 ? (
          <div className="empty-state"><Package size={40} /><h3>No products found</h3></div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Current Stock</th>
                  <th>Min Level</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => (
                  <tr key={p.id}>
                    <td>
                      <div style={{ fontWeight:600 }}>{p.name}</div>
                      <div className="text-xs text-light">{[p.size,p.color].filter(Boolean).join(' · ')}</div>
                    </td>
                    <td><span className="badge badge-blue">{p.category_name || '—'}</span></td>
                    <td>
                      <span style={{
                        fontSize:18, fontWeight:700,
                        color: p.quantity===0 ? 'var(--red)' : p.quantity<=p.min_stock ? 'var(--orange)' : 'var(--green)'
                      }}>
                        {p.quantity}
                      </span>
                      <span className="text-xs text-light" style={{ marginLeft:4 }}>units</span>
                    </td>
                    <td className="text-mid">{p.min_stock}</td>
                    <td><StockBadge quantity={p.quantity} minStock={p.min_stock} /></td>
                    <td>
                      <div className="flex gap-2">
                        <button className="btn btn-secondary btn-sm" onClick={() => openUpdate(p)}>
                          <RefreshCw size={13} /> Update
                        </button>
                        <button className="btn btn-outline btn-sm" onClick={() => openLogs(p)}>
                          <History size={13} /> Logs
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Update Stock Modal */}
      {updateModal && (
        <div className="modal-overlay" onClick={() => setUpdateModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Update Stock — {updateModal.name}</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setUpdateModal(null)}><X size={18} /></button>
            </div>
            <form onSubmit={handleUpdate}>
              <div className="modal-body">
                {/* Current info */}
                <div className="inv-card">
                  <div className="flex items-center gap-3" style={{ justifyContent:'space-between' }}>
                    <div>
                      <div style={{ fontWeight:700, fontSize:15 }}>{updateModal.name}</div>
                      <div className="text-sm text-mid">{updateModal.category_name || 'Uncategorized'}</div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div className="text-xs text-light">Current Stock</div>
                      <div style={{
                        fontSize:26, fontWeight:700,
                        color: updateModal.quantity===0 ? 'var(--red)' : updateModal.quantity<=updateModal.min_stock ? 'var(--orange)' : 'var(--green)'
                      }}>
                        {updateModal.quantity} <span className="text-sm text-light" style={{ fontSize:13 }}>units</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Type selector */}
                <div className="form-group" style={{ marginBottom:16 }}>
                  <label>Update Type</label>
                  <div style={{ display:'flex', gap:10 }}>
                    {[
                      { v:'add', label:'+ Add Stock', color:'var(--green)', bg:'var(--green-bg)' },
                      { v:'remove', label:'− Remove Stock', color:'var(--red)', bg:'var(--red-bg)' },
                      { v:'set', label:'= Set Exact', color:'var(--secondary)', bg:'var(--blue-bg)' },
                    ].map(opt => (
                      <button key={opt.v} type="button"
                        onClick={() => setForm(f => ({ ...f, change_type:opt.v }))}
                        style={{
                          flex:1, padding:'10px 8px', borderRadius:8, cursor:'pointer',
                          border:`2px solid ${form.change_type===opt.v ? opt.color : 'var(--border)'}`,
                          background: form.change_type===opt.v ? opt.bg : 'white',
                          color: form.change_type===opt.v ? opt.color : 'var(--text-mid)',
                          fontWeight:600, fontSize:13, transition:'all 0.15s'
                        }}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-grid">
                  <div className="form-group">
                    <label>Quantity <span>*</span></label>
                    <input type="number" min="1" value={form.quantity_change}
                      onChange={e => setForm(f => ({ ...f, quantity_change:e.target.value }))}
                      placeholder="Enter quantity" required autoFocus />
                    {newQty !== null && (
                      <span className="form-hint">
                        New quantity: <strong style={{
                          color: newQty===0 ? 'var(--red)' : newQty<=updateModal.min_stock ? 'var(--orange)' : 'var(--green)'
                        }}>{newQty} units</strong>
                      </span>
                    )}
                  </div>
                  <div className="form-group">
                    <label>Note (optional)</label>
                    <input value={form.note} onChange={e => setForm(f => ({ ...f, note:e.target.value }))}
                      placeholder="e.g. New delivery, Sold..." />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setUpdateModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <span className="spinner" /> : 'Update Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Logs Modal */}
      {logModal && (
        <div className="modal-overlay" onClick={() => setLogModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Stock History — {logModal.name}</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setLogModal(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              {logs.length === 0 ? (
                <div className="empty-state"><History size={36} /><h3>No history yet</h3></div>
              ) : (
                <table>
                  <thead><tr><th>Type</th><th>Quantity</th><th>Note</th><th>Date</th></tr></thead>
                  <tbody>
                    {logs.map(l => (
                      <tr key={l.id}>
                        <td>
                          <span className={`badge ${l.change_type==='add'?'badge-green':l.change_type==='remove'?'badge-red':'badge-blue'}`}>
                            {l.change_type==='add'?'+ Add':l.change_type==='remove'?'− Remove':'= Set'}
                          </span>
                        </td>
                        <td><strong>{l.quantity_change}</strong></td>
                        <td className="text-mid">{l.note || '—'}</td>
                        <td className="text-xs text-light">{new Date(l.created_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setLogModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
