import React from 'react'
import { AlertTriangle, Trash2, X } from 'lucide-react'

export default function ConfirmDialog({ open, title, message, onConfirm, onCancel, variant = 'danger', confirmText = 'Delete' }) {
  if (!open) return null
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
        <div className="modal-header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
          <span />
          <button className="btn btn-ghost btn-icon" onClick={onCancel}><X size={18} /></button>
        </div>
        <div className="modal-body" style={{ paddingTop: 8, textAlign: 'center' }}>
          <div className={`confirm-icon ${variant}`}>
            {variant === 'danger' ? <Trash2 size={24} /> : <AlertTriangle size={24} />}
          </div>
          <div className="confirm-title">{title}</div>
          <div className="confirm-msg">{message}</div>
        </div>
        <div className="modal-footer" style={{ justifyContent: 'center', gap: 12 }}>
          <button className="btn btn-outline" onClick={onCancel}>Cancel</button>
          <button className={`btn ${variant === 'danger' ? 'btn-danger' : 'btn-secondary'}`} onClick={onConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
