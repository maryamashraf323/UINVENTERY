import React from 'react'

export function getStockStatus(quantity, minStock) {
  if (quantity === 0) return 'out'
  if (quantity <= minStock) return 'low'
  return 'in'
}

export default function StockBadge({ quantity, minStock }) {
  const status = getStockStatus(quantity, minStock)
  if (status === 'out') return <span className="badge badge-red">● Out of Stock</span>
  if (status === 'low') return <span className="badge badge-orange">▲ Low Stock</span>
  return <span className="badge badge-green">✓ In Stock</span>
}
