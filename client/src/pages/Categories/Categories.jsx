import React, { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, X, Tag, Package } from 'lucide-react'
import toast from 'react-hot-toast'
import { getCategories, createCategory, updateCategory, deleteCategory } from '../../api'
import ConfirmDialog from '../../components/ConfirmDialog'
import socket from '../../socket'

export default function Categories() {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [forceDelete, setForceDelete] = useState(false)

  const load = useCallback(() => {
    getCategories().then(r => { setCategories(r.data); setLoading(false) })
  }, [])

  useEffect(() => {
    load()
    socket.on('categories:change', load)
    return () => socket.off('categories:change', load)
  }, [load])

  const openAdd = () => { setEditing(null); setName(''); setShowModal(true) }
  const openEdit = (c) => { setEditing(c); setName(c.name); setShowModal(true) }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return toast.error('Category name is required')
    setSaving(true)
    try {
      if (editing) {
        await updateCategory(editing.id, { name })
        toast.success('Category updated!')
      } else {
        await createCategory({ name })
        toast.success('Category added!')
      }
      setShowModal(false)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  const initiateDelete = (c) => { setForceDelete(false); setDeleteTarget(c) }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteCategory(deleteTarget.id, forceDelete)
      toast.success('Category deleted')
      setDeleteTarget(null)
      setForceDelete(false)
    } catch (err) {
      if (err.response?.status === 409) {
        setForceDelete(true)
      } else {
        toast.error(err.response?.data?.error || 'Failed to delete')
        setDeleteTarget(null)
      }
    }
  }

  const catColors = ['#eff6ff','#f0fdf4','#faf5ff','#fff7ed','#fef2f2','#f0f9ff']
  const catIconColors = ['#3b82f6','#16a34a','#7c3aed','#ea580c','#dc2626','#0ea5e9']

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Categories</h1>
          <p>{categories.length} categor{categories.length !== 1 ? 'ies' : 'y'}</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}><Plus size={16} /> Add Category</button>
      </div>

      {loading ? (
        <div className="loading-screen"><div className="spin-dark" /></div>
      ) : categories.length === 0 ? (
        <div className="empty-state">
          <Tag size={40} /><h3>No categories yet</h3>
          <p>Create your first category.</p>
        </div>
      ) : (
        <div className="cat-cards">
          {categories.map((c, i) => (
            <div className="cat-card" key={c.id}>
              <div className="cat-card-header">
                <div className="flex items-center gap-2">
                  <div style={{
                    width:38, height:38, borderRadius:10,
                    background:catColors[i % catColors.length],
                    display:'flex', alignItems:'center', justifyContent:'center'
                  }}>
                    <Tag size={18} color={catIconColors[i % catIconColors.length]} />
                  </div>
                  <div>
                    <div className="cat-card-name">{c.name}</div>
                    <div className="cat-card-count">{c.product_count} product{c.product_count !== 1 ? 's' : ''}</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEdit(c)}><Pencil size={15} /></button>
                  <button className="btn btn-ghost btn-icon btn-sm" style={{ color:'var(--red)' }} onClick={() => initiateDelete(c)}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
              <div className="divider" style={{ margin:'12px 0' }} />
              <div className="flex items-center gap-2">
                <Package size={14} style={{ color:'var(--text-light)' }} />
                <span className="text-sm text-mid">{c.product_count} product{c.product_count !== 1 ? 's' : ''} in this category</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editing ? 'Edit Category' : 'Add Category'}</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Category Name <span>*</span></label>
                  <input value={name} onChange={e => setName(e.target.value)}
                    placeholder="e.g. School Uniforms" autoFocus required />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <span className="spinner" /> : editing ? 'Save Changes' : 'Add Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Normal delete */}
      {deleteTarget && !forceDelete && deleteTarget.product_count === 0 && (
        <ConfirmDialog
          open={true}
          title="Delete Category"
          message={`Delete "${deleteTarget.name}"? This cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* Force delete — has products */}
      {deleteTarget && (forceDelete || deleteTarget.product_count > 0) && (
        <div className="modal-overlay">
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Category Has Products</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => { setDeleteTarget(null); setForceDelete(false) }}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="alert alert-warning">
                <span>⚠</span>
                <div>
                  <strong>"{deleteTarget.name}"</strong> has <strong>{deleteTarget.product_count} product(s)</strong>.
                  Deleting will <strong>unassign</strong> all its products (they won't be deleted).
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => { setDeleteTarget(null); setForceDelete(false) }}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDelete}>Yes, Delete Anyway</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
