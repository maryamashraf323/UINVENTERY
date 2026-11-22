const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { Pool } = require('pg');

const app = express();
const server = http.createServer(app);

const allowedOrigins = (process.env.CLIENT_URL || '')
  .split(',')
  .map(v => v.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Origin not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));

const io = new Server(server, {
  cors: {
    origin: allowedOrigins.length ? allowedOrigins : true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  },
});

app.use(express.json());

const PORT = process.env.PORT || 5000;

const uploadsDir = path.join(__dirname, 'uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use('/uploads', express.static(uploadsDir));

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL environment variable is missing.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) =>
    cb(null, `${Date.now()}${path.extname(file.originalname)}`),
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
});

// DATABASE HELPERS

async function all(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows;
}

async function get(sql, params = []) {
  const rows = await all(sql, params);
  return rows[0] || null;
}

async function run(sql, params = []) {
  return pool.query(sql, params);
}

// INITIALIZE DATABASE

async function initDb() {

  await pool.query(`
    CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      size TEXT,
      color TEXT,
      quantity INTEGER DEFAULT 0,
      min_stock INTEGER DEFAULT 5,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS stock_logs (
      id SERIAL PRIMARY KEY,
      product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
      change_type TEXT,
      quantity_change INTEGER,
      note TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const count = await get(
    'SELECT COUNT(*)::int AS c FROM categories'
  );

  if (count.c === 0) {
    await pool.query(`
      INSERT INTO categories (name) VALUES
      ('School Uniforms'),
      ('College Uniforms'),
      ('Hospital Uniforms'),
      ('Sports Uniforms'),
      ('Accessories'),
      ('Other')
      ON CONFLICT (name) DO NOTHING
    `);
  }
}

// DASHBOARD BROADCAST

async function broadcastDashboard() {

  const stats = await get(`
    SELECT
      COUNT(*)::int AS total_products,
      COALESCE(SUM(quantity), 0)::int AS total_units,
      COUNT(*) FILTER (WHERE quantity = 0)::int AS out_of_stock,
      COUNT(*) FILTER (
        WHERE quantity > 0 AND quantity <= min_stock
      )::int AS low_stock
    FROM products
  `);

  const categoryCount = await get(
    'SELECT COUNT(*)::int AS c FROM categories'
  );

  const recent_products = await all(`
    SELECT p.*, c.name AS category_name
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    ORDER BY p.created_at DESC
    LIMIT 5
  `);

  const low_stock_products = await all(`
    SELECT p.*, c.name AS category_name
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.quantity > 0 AND p.quantity <= p.min_stock
    ORDER BY p.quantity ASC
    LIMIT 10
  `);

  const category_stock = await all(`
    SELECT
      c.name,
      COALESCE(SUM(p.quantity), 0)::int AS total_units,
      COUNT(p.id)::int AS product_count
    FROM categories c
    LEFT JOIN products p ON p.category_id = c.id
    GROUP BY c.id
    ORDER BY total_units DESC
  `);

  io.emit('dashboard:update', {
    ...stats,
    total_categories: categoryCount.c,
    recent_products,
    low_stock_products,
    category_stock,
  });
}

// SOCKET.IO

io.on('connection', (socket) => {
  console.log(`Admin connected: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`Admin disconnected: ${socket.id}`);
  });
});

// CATEGORIES

app.get('/api/categories', async (req, res) => {
  try {
    const rows = await all(`
      SELECT
        c.id,
        c.name,
        c.created_at,
        (
          SELECT COUNT(*)::int
          FROM products p
          WHERE p.category_id = c.id
        ) AS product_count
      FROM categories c
      ORDER BY c.name
    `);

    res.json(rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load categories' });
  }
});

app.post('/api/categories', async (req, res) => {
  try {
    const name = req.body.name?.trim();

    if (!name) {
      return res.status(400).json({
        error: 'Category name is required'
      });
    }

    const existing = await get(
      'SELECT id FROM categories WHERE lower(name) = lower($1)',
      [name]
    );

    if (existing) {
      return res.status(400).json({
        error: 'Category already exists'
      });
    }

    const category = await get(
      `INSERT INTO categories (name)
       VALUES ($1)
       RETURNING id, name, created_at`,
      [name]
    );

    io.emit('categories:change');

    await broadcastDashboard();

    res.json({
      ...category,
      product_count: 0
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

app.put('/api/categories/:id', async (req, res) => {
  try {
    const name = req.body.name?.trim();
    const id = Number.parseInt(req.params.id, 10);

    if (!name) {
      return res.status(400).json({
        error: 'Category name is required'
      });
    }

    const existing = await get(
      `SELECT id FROM categories
       WHERE lower(name) = lower($1) AND id <> $2`,
      [name, id]
    );

    if (existing) {
      return res.status(400).json({
        error: 'Category already exists'
      });
    }

    const category = await get(
      `UPDATE categories
       SET name = $1
       WHERE id = $2
       RETURNING id, name, created_at`,
      [name, id]
    );

    if (!category) {
      return res.status(404).json({
        error: 'Category not found'
      });
    }

    const count = await get(
      'SELECT COUNT(*)::int AS product_count FROM products WHERE category_id = $1',
      [id]
    );

    io.emit('categories:change');
    io.emit('products:change');

    await broadcastDashboard();

    res.json({
      ...category,
      product_count: count.product_count
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

app.delete('/api/categories/:id', async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);

    const count = await get(
      'SELECT COUNT(*)::int AS c FROM products WHERE category_id = $1',
      [id]
    );

    if (count.c > 0 && req.query.force !== 'true') {
      return res.status(409).json({
        error: `This category has ${count.c} product(s).`
      });
    }

    await run(
      'DELETE FROM categories WHERE id = $1',
      [id]
    );

    io.emit('categories:change');
    io.emit('products:change');

    await broadcastDashboard();

    res.json({ success: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

// PRODUCTS

app.get('/api/products', async (req, res) => {
  try {
    const { search, category_id, status } = req.query;

    let sql = `
      SELECT p.*, c.name AS category_name
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE 1=1
    `;

    const params = [];

    if (search) {
      params.push(`%${search}%`);
      sql += ` AND p.name ILIKE $${params.length}`;
    }

    if (category_id) {
      params.push(Number.parseInt(category_id, 10));
      sql += ` AND p.category_id = $${params.length}`;
    }

    if (status === 'out') {
      sql += ' AND p.quantity = 0';
    } else if (status === 'low') {
      sql += ' AND p.quantity > 0 AND p.quantity <= p.min_stock';
    } else if (status === 'in') {
      sql += ' AND p.quantity > p.min_stock';
    }

    sql += ' ORDER BY p.created_at DESC';

    res.json(await all(sql, params));

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load products' });
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const product = await get(`
      SELECT p.*, c.name AS category_name
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.id = $1
    `, [Number.parseInt(req.params.id, 10)]);

    if (!product) {
      return res.status(404).json({ error: 'Not found' });
    }

    res.json(product);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load product' });
  }
});

app.post('/api/products', async (req, res) => {
  try {
    const {
      name,
      category_id,
      size,
      color,
      quantity,
      min_stock
    } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({
        error: 'Product name is required'
      });
    }

    const qty = Math.max(
      0,
      Number.parseInt(quantity, 10) || 0
    );

    const product = await get(`
      INSERT INTO products
      (name, category_id, size, color, quantity, min_stock)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      name.trim(),
      category_id ? Number.parseInt(category_id, 10) : null,
      size || null,
      color || null,
      qty,
      Number.parseInt(min_stock, 10) || 5
    ]);

    if (qty > 0) {
      await run(`
        INSERT INTO stock_logs
        (product_id, change_type, quantity_change, note)
        VALUES ($1, 'add', $2, 'Initial stock')
      `, [product.id, qty]);
    }

    const result = await get(`
      SELECT p.*, c.name AS category_name
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.id = $1
    `, [product.id]);

    io.emit('products:change');

    await broadcastDashboard();

    res.json(result);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

app.put('/api/products/:id', async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);

    const existing = await get(
      'SELECT id FROM products WHERE id = $1',
      [id]
    );

    if (!existing) {
      return res.status(404).json({ error: 'Not found' });
    }

    const {
      name,
      category_id,
      size,
      color,
      quantity,
      min_stock
    } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({
        error: 'Product name is required'
      });
    }

    await run(`
      UPDATE products
      SET name=$1,
          category_id=$2,
          size=$3,
          color=$4,
          quantity=$5,
          min_stock=$6
      WHERE id=$7
    `, [
      name.trim(),
      category_id ? Number.parseInt(category_id, 10) : null,
      size || null,
      color || null,
      Math.max(0, Number.parseInt(quantity, 10) || 0),
      Number.parseInt(min_stock, 10) || 5,
      id
    ]);

    const product = await get(`
      SELECT p.*, c.name AS category_name
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.id = $1
    `, [id]);

    io.emit('products:change');

    await broadcastDashboard();

    res.json(product);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);

    const existing = await get(
      'SELECT id FROM products WHERE id = $1',
      [id]
    );

    if (!existing) {
      return res.status(404).json({ error: 'Not found' });
    }

    await run(
      'DELETE FROM products WHERE id = $1',
      [id]
    );

    io.emit('products:change');

    await broadcastDashboard();

    res.json({ success: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// INVENTORY

app.post('/api/inventory/update', async (req, res) => {
  try {
    const {
      product_id,
      change_type,
      quantity_change,
      note
    } = req.body;

    const id = Number.parseInt(product_id, 10);

    const product = await get(
      'SELECT * FROM products WHERE id = $1',
      [id]
    );

    if (!product) {
      return res.status(404).json({
        error: 'Product not found'
      });
    }

    const change = Number.parseInt(quantity_change, 10);

    if (Number.isNaN(change) || change <= 0) {
      return res.status(400).json({
        error: 'Quantity must be positive'
      });
    }

    let newQty = product.quantity;

    if (change_type === 'add') {
      newQty += change;

    } else if (change_type === 'remove') {

      if (product.quantity - change < 0) {
        return res.status(400).json({
          error: 'Stock cannot go below zero'
        });
      }

      newQty = product.quantity - change;

    } else if (change_type === 'set') {
      newQty = change;

    } else {
      return res.status(400).json({
        error: 'Invalid change_type'
      });
    }

    await run(
      'UPDATE products SET quantity = $1 WHERE id = $2',
      [newQty, id]
    );

    await run(`
      INSERT INTO stock_logs
      (product_id, change_type, quantity_change, note)
      VALUES ($1, $2, $3, $4)
    `, [id, change_type, change, note || null]);

    const updated = await get(`
      SELECT p.*, c.name AS category_name
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.id = $1
    `, [id]);

    io.emit('products:change');

    await broadcastDashboard();

    res.json(updated);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update inventory' });
  }
});

app.get('/api/inventory/logs/:product_id', async (req, res) => {
  try {
    res.json(await all(`
      SELECT *
      FROM stock_logs
      WHERE product_id = $1
      ORDER BY created_at DESC
      LIMIT 50
    `, [Number.parseInt(req.params.product_id, 10)]));

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load stock logs' });
  }
});

// DASHBOARD

app.get('/api/dashboard', async (req, res) => {
  try {
    const stats = await get(`
      SELECT
        COUNT(*)::int AS total_products,
        COALESCE(SUM(quantity), 0)::int AS total_units,
        COUNT(*) FILTER (WHERE quantity = 0)::int AS out_of_stock,
        COUNT(*) FILTER (
          WHERE quantity > 0 AND quantity <= min_stock
        )::int AS low_stock
      FROM products
    `);

    const categoryCount = await get(
      'SELECT COUNT(*)::int AS c FROM categories'
    );

    const recent_products = await all(`
      SELECT p.*, c.name AS category_name
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      ORDER BY p.created_at DESC
      LIMIT 5
    `);

    const low_stock_products = await all(`
      SELECT p.*, c.name AS category_name
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.quantity > 0 AND p.quantity <= p.min_stock
      ORDER BY p.quantity ASC
      LIMIT 10
    `);

    const category_stock = await all(`
      SELECT
        c.name,
        COALESCE(SUM(p.quantity), 0)::int AS total_units,
        COUNT(p.id)::int AS product_count
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id
      GROUP BY c.id
      ORDER BY total_units DESC
    `);

    res.json({
      ...stats,
      total_categories: categoryCount.c,
      recent_products,
      low_stock_products,
      category_stock
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
});

// REPORTS

app.get('/api/reports', async (req, res) => {
  try {
    const summary = await get(`
      SELECT
        COUNT(*)::int AS total_products,
        COALESCE(SUM(quantity), 0)::int AS total_units,
        COUNT(*) FILTER (WHERE quantity = 0)::int AS out_of_stock,
        COUNT(*) FILTER (
          WHERE quantity > 0 AND quantity <= min_stock
        )::int AS low_stock
      FROM products
    `);

    const by_category = await all(`
      SELECT
        c.name AS category,
        COUNT(p.id)::int AS product_count,
        COALESCE(SUM(p.quantity), 0)::int AS total_units
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id
      GROUP BY c.id
      ORDER BY total_units DESC
    `);

    const low_stock_items = await all(`
      SELECT p.*, c.name AS category_name
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.quantity > 0 AND p.quantity <= p.min_stock
      ORDER BY p.quantity ASC
    `);

    const out_of_stock_items = await all(`
      SELECT p.*, c.name AS category_name
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.quantity = 0
      ORDER BY p.name
    `);

    res.json({
      summary,
      by_category,
      low_stock_items,
      out_of_stock_items
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load reports' });
  }
});

// HEALTH CHECK

app.get('/', (req, res) => {
  res.send('UniStock API is running');
});

// START SERVER

initDb()
  .then(() => {
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`UniStock API listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Database initialization failed:', err);
    process.exit(1);
  });
