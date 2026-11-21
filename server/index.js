const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const initSqlJs = require('sql.js');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET','POST','PUT','DELETE'] }
});

const PORT = 5000;
const DB_FILE = path.join(__dirname, 'inventory.db');
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(uploadsDir));

let db;

function saveDb() {
  const data = db.export();
  fs.writeFileSync(DB_FILE, Buffer.from(data));
}
setInterval(saveDb, 5000);

function run(sql, params = []) {
  db.run(sql, params);
  const row = db.exec('SELECT last_insert_rowid() as id');
  if (row.length && row[0].values.length) return row[0].values[0][0];
  return null;
}

function all(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function get(sql, params = []) {
  return all(sql, params)[0] || null;
}

// Emit dashboard stats to all clients
function broadcastDashboard() {
  const stats = get(`SELECT
    COUNT(*) as total_products,
    COALESCE(SUM(quantity),0) as total_units,
    COUNT(CASE WHEN quantity=0 THEN 1 END) as out_of_stock,
    COUNT(CASE WHEN quantity>0 AND quantity<=min_stock THEN 1 END) as low_stock
    FROM products`);
  const total_categories = get('SELECT COUNT(*) as c FROM categories').c;
  const recent_products = all(`SELECT p.*, c.name as category_name FROM products p
    LEFT JOIN categories c ON c.id=p.category_id ORDER BY p.created_at DESC LIMIT 5`);
  const low_stock_products = all(`SELECT p.*, c.name as category_name FROM products p
    LEFT JOIN categories c ON c.id=p.category_id
    WHERE p.quantity>0 AND p.quantity<=p.min_stock ORDER BY p.quantity ASC LIMIT 10`);
  const category_stock = all(`SELECT c.name,
    COALESCE(SUM(p.quantity),0) as total_units,
    COUNT(p.id) as product_count
    FROM categories c LEFT JOIN products p ON p.category_id=c.id
    GROUP BY c.id ORDER BY total_units DESC`);
  io.emit('dashboard:update', { ...stats, total_categories, recent_products, low_stock_products, category_stock });
}

function initDb() {
  db.run(`CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category_id INTEGER,
    size TEXT,
    color TEXT,
    quantity INTEGER DEFAULT 0,
    min_stock INTEGER DEFAULT 5,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS stock_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER,
    change_type TEXT,
    quantity_change INTEGER,
    note TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  const count = get('SELECT COUNT(*) as c FROM categories');
  if (count.c === 0) {
    ['School Uniforms','College Uniforms','Hospital Uniforms','Sports Uniforms','Accessories','Other']
      .forEach(n => db.run('INSERT INTO categories (name) VALUES (?)', [n]));
    saveDb();
  }
}

// ─── SOCKET ──────────────────────────────────────────────────────────────────

io.on('connection', (socket) => {
  console.log(`Admin connected: ${socket.id}`);
  socket.on('disconnect', () => console.log(`Admin disconnected: ${socket.id}`));
});

// ─── CATEGORIES ──────────────────────────────────────────────────────────────

app.get('/api/categories', (req, res) => {
  const rows = all(`SELECT c.id, c.name, c.created_at,
    (SELECT COUNT(*) FROM products p WHERE p.category_id=c.id) as product_count
    FROM categories c ORDER BY c.name`);
  res.json(rows);
});

app.post('/api/categories', (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Category name is required' });
  if (get('SELECT id FROM categories WHERE lower(name)=lower(?)', [name.trim()]))
    return res.status(400).json({ error: 'Category already exists' });
  const id = run('INSERT INTO categories (name) VALUES (?)', [name.trim()]);
  saveDb();
  const cat = get(`SELECT c.id, c.name, c.created_at,
    (SELECT COUNT(*) FROM products p WHERE p.category_id=c.id) as product_count
    FROM categories c WHERE c.id=?`, [id]);
  io.emit('categories:change');
  broadcastDashboard();
  res.json(cat);
});

app.put('/api/categories/:id', (req, res) => {
  const { name } = req.body;
  const cid = parseInt(req.params.id);
  if (!name?.trim()) return res.status(400).json({ error: 'Category name is required' });
  if (get('SELECT id FROM categories WHERE lower(name)=lower(?) AND id!=?', [name.trim(), cid]))
    return res.status(400).json({ error: 'Category already exists' });
  db.run('UPDATE categories SET name=? WHERE id=?', [name.trim(), cid]);
  saveDb();
  const cat = get(`SELECT c.id, c.name, c.created_at,
    (SELECT COUNT(*) FROM products p WHERE p.category_id=c.id) as product_count
    FROM categories c WHERE c.id=?`, [cid]);
  io.emit('categories:change');
  io.emit('products:change');
  broadcastDashboard();
  res.json(cat);
});

app.delete('/api/categories/:id', (req, res) => {
  const { force } = req.query;
  const cid = parseInt(req.params.id);
  const count = get('SELECT COUNT(*) as c FROM products WHERE category_id=?', [cid]);
  if (count.c > 0 && force !== 'true')
    return res.status(409).json({ error: `This category has ${count.c} product(s).` });
  db.run('DELETE FROM categories WHERE id=?', [cid]);
  saveDb();
  io.emit('categories:change');
  io.emit('products:change');
  broadcastDashboard();
  res.json({ success: true });
});

// ─── PRODUCTS ────────────────────────────────────────────────────────────────

app.get('/api/products', (req, res) => {
  const { search, category_id, status } = req.query;
  let sql = `SELECT p.*, c.name as category_name FROM products p
    LEFT JOIN categories c ON c.id=p.category_id WHERE 1=1`;
  const params = [];
  if (search) { sql += ' AND p.name LIKE ?'; params.push(`%${search}%`); }
  if (category_id) { sql += ' AND p.category_id=?'; params.push(parseInt(category_id)); }
  if (status === 'out') sql += ' AND p.quantity=0';
  else if (status === 'low') sql += ' AND p.quantity>0 AND p.quantity<=p.min_stock';
  else if (status === 'in') sql += ' AND p.quantity>p.min_stock';
  sql += ' ORDER BY p.created_at DESC';
  res.json(all(sql, params));
});

app.get('/api/products/:id', (req, res) => {
  const p = get('SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.id=?', [parseInt(req.params.id)]);
  if (!p) return res.status(404).json({ error: 'Not found' });
  res.json(p);
});

app.post('/api/products', (req, res) => {
  const { name, category_id, size, color, quantity, min_stock } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Product name is required' });
  const qty = Math.max(0, parseInt(quantity) || 0);
  const id = run(
    `INSERT INTO products (name,category_id,size,color,quantity,min_stock) VALUES (?,?,?,?,?,?)`,
    [name.trim(), category_id ? parseInt(category_id) : null, size || null, color || null,
     qty, parseInt(min_stock) || 5]
  );
  if (qty > 0) db.run('INSERT INTO stock_logs (product_id,change_type,quantity_change,note) VALUES (?,?,?,?)', [id,'add',qty,'Initial stock']);
  saveDb();
  const product = get('SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.id=?', [id]);
  io.emit('products:change');
  broadcastDashboard();
  res.json(product);
});

app.put('/api/products/:id', (req, res) => {
  const pid = parseInt(req.params.id);
  const existing = get('SELECT * FROM products WHERE id=?', [pid]);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const { name, category_id, size, color, quantity, min_stock } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Product name is required' });
  const qty = Math.max(0, parseInt(quantity) || 0);
  db.run(
    `UPDATE products SET name=?,category_id=?,size=?,color=?,quantity=?,min_stock=? WHERE id=?`,
    [name.trim(), category_id ? parseInt(category_id) : null, size || null, color || null,
     qty, parseInt(min_stock) || 5, pid]
  );
  saveDb();
  const product = get('SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.id=?', [pid]);
  io.emit('products:change');
  broadcastDashboard();
  res.json(product);
});

app.delete('/api/products/:id', (req, res) => {
  const pid = parseInt(req.params.id);
  if (!get('SELECT id FROM products WHERE id=?', [pid])) return res.status(404).json({ error: 'Not found' });
  db.run('DELETE FROM products WHERE id=?', [pid]);
  saveDb();
  io.emit('products:change');
  broadcastDashboard();
  res.json({ success: true });
});

// ─── INVENTORY ───────────────────────────────────────────────────────────────

app.post('/api/inventory/update', (req, res) => {
  const { product_id, change_type, quantity_change, note } = req.body;
  const pid = parseInt(product_id);
  const p = get('SELECT * FROM products WHERE id=?', [pid]);
  if (!p) return res.status(404).json({ error: 'Product not found' });
  const change = parseInt(quantity_change);
  if (isNaN(change) || change <= 0) return res.status(400).json({ error: 'Quantity must be positive' });
  let newQty = p.quantity;
  if (change_type === 'add') newQty += change;
  else if (change_type === 'remove') {
    if (p.quantity - change < 0) return res.status(400).json({ error: 'Stock cannot go below zero' });
    newQty = p.quantity - change;
  } else if (change_type === 'set') {
    newQty = Math.max(0, change);
  } else return res.status(400).json({ error: 'Invalid change_type' });
  db.run('UPDATE products SET quantity=? WHERE id=?', [newQty, pid]);
  db.run('INSERT INTO stock_logs (product_id,change_type,quantity_change,note) VALUES (?,?,?,?)', [pid, change_type, change, note || null]);
  saveDb();
  const updated = get('SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.id=?', [pid]);
  io.emit('products:change');
  broadcastDashboard();
  res.json(updated);
});

app.get('/api/inventory/logs/:product_id', (req, res) => {
  res.json(all('SELECT * FROM stock_logs WHERE product_id=? ORDER BY created_at DESC LIMIT 50', [parseInt(req.params.product_id)]));
});

// ─── DASHBOARD ───────────────────────────────────────────────────────────────

app.get('/api/dashboard', (req, res) => {
  const stats = get(`SELECT
    COUNT(*) as total_products,
    COALESCE(SUM(quantity),0) as total_units,
    COUNT(CASE WHEN quantity=0 THEN 1 END) as out_of_stock,
    COUNT(CASE WHEN quantity>0 AND quantity<=min_stock THEN 1 END) as low_stock
    FROM products`);
  const total_categories = get('SELECT COUNT(*) as c FROM categories').c;
  const recent_products = all(`SELECT p.*, c.name as category_name FROM products p
    LEFT JOIN categories c ON c.id=p.category_id ORDER BY p.created_at DESC LIMIT 5`);
  const low_stock_products = all(`SELECT p.*, c.name as category_name FROM products p
    LEFT JOIN categories c ON c.id=p.category_id
    WHERE p.quantity>0 AND p.quantity<=p.min_stock ORDER BY p.quantity ASC LIMIT 10`);
  const category_stock = all(`SELECT c.name,
    COALESCE(SUM(p.quantity),0) as total_units,
    COUNT(p.id) as product_count
    FROM categories c LEFT JOIN products p ON p.category_id=c.id
    GROUP BY c.id ORDER BY total_units DESC`);
  res.json({ ...stats, total_categories, recent_products, low_stock_products, category_stock });
});

// ─── REPORTS ─────────────────────────────────────────────────────────────────

app.get('/api/reports', (req, res) => {
  const summary = get(`SELECT
    COUNT(*) as total_products,
    COALESCE(SUM(quantity),0) as total_units,
    COUNT(CASE WHEN quantity=0 THEN 1 END) as out_of_stock,
    COUNT(CASE WHEN quantity>0 AND quantity<=min_stock THEN 1 END) as low_stock
    FROM products`);
  const by_category = all(`SELECT c.name as category,
    COUNT(p.id) as product_count,
    COALESCE(SUM(p.quantity),0) as total_units
    FROM categories c LEFT JOIN products p ON p.category_id=c.id
    GROUP BY c.id ORDER BY total_units DESC`);
  const low_stock_items = all(`SELECT p.*, c.name as category_name FROM products p
    LEFT JOIN categories c ON c.id=p.category_id
    WHERE p.quantity>0 AND p.quantity<=p.min_stock ORDER BY p.quantity ASC`);
  const out_of_stock_items = all(`SELECT p.*, c.name as category_name FROM products p
    LEFT JOIN categories c ON c.id=p.category_id WHERE p.quantity=0 ORDER BY p.name`);
  res.json({ summary, by_category, low_stock_items, out_of_stock_items });
});

// ─── START ───────────────────────────────────────────────────────────────────

initSqlJs().then(SQL => {
  db = fs.existsSync(DB_FILE)
    ? new SQL.Database(fs.readFileSync(DB_FILE))
    : new SQL.Database();
  initDb();
  server.listen(PORT, () => console.log(`✅ UniStock server on http://localhost:${PORT}`));
}).catch(err => { console.error(err); process.exit(1); });
