# UniStock — Uniform Shop Inventory Management System

A clean, modern inventory management system for uniform shops.

## Quick Start

**Option 1:** Double-click `start.bat`

**Option 2:** Manual start

```bash
# Terminal 1 — Backend
cd server
node index.js

# Terminal 2 — Frontend
cd client
npm run dev
```

Then open **http://localhost:3000**

## Features

- **Dashboard** — Summary cards, low stock alerts, stock-by-category chart
- **Products** — Add, edit, delete products with image upload, search & filter
- **Categories** — Manage categories (6 defaults: School, College, Hospital, Sports, Accessories, Other)
- **Inventory** — Update stock (add/remove/set), view stock history logs
- **Reports** — Inventory value, category breakdown, low stock & out-of-stock lists
- **Settings** — Shop name, currency, address

## Stock Status Rules

| Status | Condition |
|--------|-----------|
| ✓ In Stock | Quantity > Minimum Stock Level |
| ▲ Low Stock | 0 < Quantity ≤ Minimum Stock Level |
| ● Out of Stock | Quantity = 0 |

## Tech Stack

- **Frontend:** React + Vite + Recharts + Lucide Icons
- **Backend:** Node.js + Express
- **Database:** SQL.js (SQLite, file-persisted as `server/inventory.db`)
- **Styling:** Pure CSS (no framework)

## Ports

- Frontend: http://localhost:3000
- Backend API: http://localhost:5000
