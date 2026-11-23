```jsx
import React, { useEffect, useState, useCallback } from 'react'
import { Plus, Search, Pencil, Trash2, X, Package } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  getProducts,
  getCategories,
  createProduct,
  updateProduct,
  deleteProduct
} from '../../api'
import StockBadge from '../../components/StockBadge'
import ConfirmDialog from '../../components/ConfirmDialog'
import socket from '../../socket'

const EMPTY = {
  name: '',
  category_id: '',
  size: '',
  color: '',
  quantity: '',
  min_stock: '5'
}

export default function Products() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const loadProducts = useCallback((params = {}) => {
    getProducts(params)
      .then(r => {
        setProducts(r.data)
        setLoading(false)
      })
      .catch(() => {
        toast.error('Failed to load products')
        setLoading(false)
      })
  }, [])

  const loadCategories = useCallback(() => {
    getCategories()
      .then(r => setCategories(r.data))
      .catch(() => toast.error('Failed to load categories'))
  }, [])

  // Initial loading and real-time synchronization
  useEffect(() => {
    loadProducts()
    loadCategories()

    const onProductsChange = () => {
      loadProducts({
        category_id: filterCat || undefined,
        status: filterStatus || undefined
      })
    }

    const onCategoriesChange = () => loadCategories()

    socket.on('products:change', onProductsChange)
    socket.on('categories:change', onCategoriesChange)

    return () => {
      socket.off('products:change', onProductsChange)
      socket.off('categories:change', onCategoriesChange)
    }
  }, [loadProducts, loadCategories, filterCat, filterStatus])

  // Apply category and stock status filters
  useEffect(() => {
    loadProducts({
      category_id: filterCat || undefined,
      status: filterStatus || undefined
    })
  }, [filterCat, filterStatus, loadProducts])

  // Search by product name, category, size and color
  const filteredProducts = products.filter(product => {
    const searchTerms = search
      .toLowerCase()
      .trim()
      .split(/\s+/)
      .filter(Boolean)

    const searchableWords = [
      product.name,
      product.category_name,
      product.size,
      product.color
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .split(/[\s-]+/)
      .filter(Boolean)

    return searchTerms.every(term =>
      searchableWords.some(word => word.startsWith(term))
    )
  })

  const openAdd = () => {
    setEditing(null)
    setForm(EMPTY)
    setShowModal(true)
  }

  const openEdit = (p) => {
    setEditing(p)

    setForm({
      name: p.name,
      category_id: p.category_id || '',
      size: p.size || '',
      color: p.color || '',
      quantity: p.quantity,
      min_stock: p.min_stock
    })

    setShowModal(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!form.name.trim()) {
      return toast.error('Product name is required')
    }

    setSaving(true)

    try {
      if (editing) {
        await updateProduct(editing.id, form)
        toast.success('Product updated!')
      } else {
        await createProduct(form)
        toast.success('Product added!')
      }

      setShowModal(false)

    } catch (err) {
      toast.error(
        err.response?.data?.error || 'Something went wrong'
      )
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return

    try {
      await deleteProduct(deleteTarget.id)
      toast.success('Product deleted')
    } catch {
      toast.error('Failed to delete product')
    } finally {
      setDeleteTarget(null)
    }
  }

  const f = (k) => (e) =>
    setForm(p => ({
      ...p,
      [k]: e.target.value
    }))

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Products</h1>
          <p>
            {filteredProducts.length} product
            {filteredProducts.length !== 1 ? 's' : ''} found
          </p>
        </div>

        <button
          className="btn btn-primary"
          onClick={openAdd}
        >
          <Plus size={16} /> Add Product
        </button>
      </div>

      <div className="table-wrapper">
        <div className="table-toolbar">

          <div className="search-input-wrap">
            <Search className="search-icon" />

            <input
              placeholder="Search by name, category, size or color..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <select
            value={filterCat}
            onChange={e => setFilterCat(e.target.value)}
            style={{ minWidth: 160 }}
          >
            <option value="">All Categories</option>

            {categories.map(c => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            style={{ minWidth: 140 }}
          >
            <option value="">All Status</option>
            <option value="in">In Stock</option>
            <option value="low">Low Stock</option>
            <option value="out">Out of Stock</option>
          </select>

          {(search || filterCat || filterStatus) && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setSearch('')
                setFilterCat('')
                setFilterStatus('')
              }}
            >
              <X size={14} /> Clear
            </button>
          )}
        </div>

        {loading ? (
          <div className="loading-screen">
            <div className="spin-dark" />
          </div>

        ) : filteredProducts.length === 0 ? (
          <div className="empty-state">
            <Package size={40} />
            <h3>No products found</h3>
            <p>Try adjusting your filters or add a new product.</p>
          </div>

        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Product Name</th>
                  <th>Category</th>
                  <th>Size</th>
                  <th>Color</th>
                  <th>Quantity</th>
                  <th>Min Stock</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredProducts.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600 }}>
                      {p.name}
                    </td>

                    <td>
                      <span className="badge badge-blue">
                        {p.category_name || '—'}
                      </span>
                    </td>

                    <td className="text-mid">
                      {p.size || '—'}
                    </td>

                    <td className="text-mid">
                      {p.color || '—'}
                    </td>

                    <td>
                      <strong>{p.quantity}</strong>
                    </td>

                    <td className="text-mid">
                      {p.min_stock}
                    </td>

                    <td>
                      <StockBadge
                        quantity={p.quantity}
                        minStock={p.min_stock}
                      />
                    </td>

                    <td>
                      <div className="flex gap-2">
                        <button
                          className="btn btn-ghost btn-icon btn-sm"
                          title="Edit"
                          onClick={() => openEdit(p)}
                        >
                          <Pencil size={15} />
                        </button>

                        <button
                          className="btn btn-ghost btn-icon btn-sm"
                          title="Delete"
                          style={{ color: 'var(--red)' }}
                          onClick={() => setDeleteTarget(p)}
                        >
                          <Trash2 size={15} />
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

      {/* Add/Edit Modal */}
      {showModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowModal(false)}
        >
          <div
            className="modal"
            onClick={e => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>
                {editing ? 'Edit Product' : 'Add New Product'}
              </h2>

              <button
                className="btn btn-ghost btn-icon"
                onClick={() => setShowModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-grid">

                  <div className="form-group full">
                    <label>
                      Product Name <span>*</span>
                    </label>

                    <input
                      value={form.name}
                      onChange={f('name')}
                      placeholder="e.g. School White Shirt"
                      required
                      autoFocus
                    />
                  </div>

                  <div className="form-group">
                    <label>Category</label>

                    <select
                      value={form.category_id}
                      onChange={f('category_id')}
                    >
                      <option value="">Select category</option>

                      {categories.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Size</label>

                    <input
                      value={form.size}
                      onChange={f('size')}
                      placeholder="e.g. S, M, L, XL, 28..."
                    />
                  </div>

                  <div className="form-group">
                    <label>Color</label>

                    <input
                      value={form.color}
                      onChange={f('color')}
                      placeholder="e.g. White, Navy Blue..."
                    />
                  </div>

                  <div className="form-group">
                    <label>
                      Quantity <span>*</span>
                    </label>

                    <input
                      type="number"
                      min="0"
                      value={form.quantity}
                      onChange={f('quantity')}
                      placeholder="0"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Minimum Stock Level</label>

                    <input
                      type="number"
                      min="0"
                      value={form.min_stock}
                      onChange={f('min_stock')}
                      placeholder="5"
                    />

                    <span className="form-hint">
                      Warning shown when stock falls at or below this
                    </span>
                  </div>

                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                >
                  {saving
                    ? <span className="spinner" />
                    : editing
                      ? 'Save Changes'
                      : 'Add Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Product"
        message={'Delete "' + (deleteTarget?.name || '') + '"? This cannot be undone.'}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

    </div>
  )
}
```
