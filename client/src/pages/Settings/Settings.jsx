import React, { useState } from 'react'
import { Save, Store } from 'lucide-react'
import toast from 'react-hot-toast'

const DEFAULT_SETTINGS = {
  shopName: 'UniStock Uniform Shop',
  currency: '₹',
  lowStockDefault: '5',
  address: '',
  phone: '',
}

export default function Settings() {
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('unistock_settings')
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS
    } catch { return DEFAULT_SETTINGS }
  })

  const handleSave = (e) => {
    e.preventDefault()
    localStorage.setItem('unistock_settings', JSON.stringify(settings))
    toast.success('Settings saved!')
  }

  const f = (k) => (e) => setSettings(p => ({ ...p, [k]: e.target.value }))

  return (
    <div>
      <div className="page-header">
        <div><h1>Settings</h1><p>Configure your shop preferences</p></div>
      </div>

      <form onSubmit={handleSave}>
        <div className="settings-section">
          <h3><Store size={16} style={{ display:'inline', marginRight:8 }} />Shop Information</h3>
          <div className="form-grid">
            <div className="form-group">
              <label>Shop Name</label>
              <input value={settings.shopName} onChange={f('shopName')} placeholder="Your shop name" />
            </div>
            <div className="form-group">
              <label>Currency Symbol</label>
              <input value={settings.currency} onChange={f('currency')} placeholder="₹" />
            </div>
            <div className="form-group">
              <label>Phone Number</label>
              <input value={settings.phone} onChange={f('phone')} placeholder="+91 00000 00000" />
            </div>
            <div className="form-group">
              <label>Default Min Stock Level</label>
              <input type="number" min="0" value={settings.lowStockDefault} onChange={f('lowStockDefault')} placeholder="5" />
              <span className="form-hint">Default minimum stock level for new products</span>
            </div>
            <div className="form-group full">
              <label>Shop Address</label>
              <textarea value={settings.address} onChange={f('address')} placeholder="Shop address..." rows={3} />
            </div>
          </div>
        </div>

        <button type="submit" className="btn btn-primary">
          <Save size={15} /> Save Settings
        </button>
      </form>
    </div>
  )
}
