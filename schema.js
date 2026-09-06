function normalizeValue(value) {
  if (typeof value === 'bigint') return Number(value);
  return value;
}

const SCHEMA_SQL = [
  `CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    preview_image TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    content_type TEXT NOT NULL,
    media_url TEXT NOT NULL,
    preview_url TEXT,
    is_hidden INTEGER DEFAULT 0,
    display_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    subject TEXT,
    message TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`
];

async function executeOn(target, sql, args = []) {
  return target.execute({ sql, args });
}

async function enableForeignKeys(target) {
  try {
    await executeOn(target, 'PRAGMA foreign_keys = ON');
  } catch (err) {
    console.error('Error enabling foreign keys:', err);
  }
}

async function createSchema(target) {
  await enableForeignKeys(target);
  for (const sql of SCHEMA_SQL) {
    await executeOn(target, sql);
  }
}

async function tableHasColumn(target, table, column) {
  const result = await executeOn(target, `PRAGMA table_info(${table})`);
  return (result.rows || []).some((col) => col.name === column);
}

async function ensureOptionalColumns(target) {
  if (!(await tableHasColumn(target, 'projects', 'preview_url'))) {
    await executeOn(target, 'ALTER TABLE projects ADD COLUMN preview_url TEXT');
    console.log('Added preview_url column to projects table');
  }
  if (!(await tableHasColumn(target, 'projects', 'is_hidden'))) {
    await executeOn(target, 'ALTER TABLE projects ADD COLUMN is_hidden INTEGER DEFAULT 0');
    console.log('Added is_hidden column to projects table');
  }
}

async function seedDefaultCategories(target) {
  if (process.env.SEED_DEFAULT_CATEGORIES === 'false') {
    return;
  }

  const categories = [
    { name: 'Graphic Design', description: 'Logo design, branding, and visual identity projects' },
    { name: 'Video Editing', description: 'Video production, editing, and motion graphics' },
    { name: 'Web Design', description: 'Website design and user interface projects' },
    { name: 'Poster Design', description: 'Poster and promotional design work' }
  ];

  for (const cat of categories) {
    const existing = await executeOn(target, 'SELECT id FROM categories WHERE name = ?', [cat.name]);
    if (!existing.rows || existing.rows.length === 0) {
      await executeOn(target, 'INSERT INTO categories (name, description) VALUES (?, ?)', [cat.name, cat.description]);
      console.log(`Category '${cat.name}' created`);
    }
  }
}

async function initializeDatabase(target) {
  await createSchema(target);
  await ensureOptionalColumns(target);
  await seedDefaultCategories(target);
  console.log('Database schema ready');
}

async function getExistingColumns(target, table) {
  try {
    const result = await executeOn(target, `PRAGMA table_info(${table})`);
    return (result.rows || []).map((col) => col.name);
  } catch (err) {
    return [];
  }
}

async function copyTable(fromClient, toClient, table, columns) {
  const sourceCols = await getExistingColumns(fromClient, table);
  if (sourceCols.length === 0) return 0;

  const usable = columns.filter((col) => sourceCols.includes(col));
  if (usable.length === 0) return 0;

  const colList = usable.join(', ');
  const placeholders = usable.map(() => '?').join(', ');
  const result = await executeOn(fromClient, `SELECT ${colList} FROM ${table}`);
  const rows = result.rows || [];

  for (const row of rows) {
    const values = usable.map((col) => normalizeValue(row[col]));
    await executeOn(
      toClient,
      `INSERT INTO ${table} (${colList}) VALUES (${placeholders})`,
      values
    );
  }

  return rows.length;
}

async function copyDatabase(fromClient, toClient) {
  await executeOn(toClient, 'PRAGMA foreign_keys = OFF');
  await executeOn(toClient, 'DROP TABLE IF EXISTS messages');
  await executeOn(toClient, 'DROP TABLE IF EXISTS projects');
  await executeOn(toClient, 'DROP TABLE IF EXISTS categories');
  await createSchema(toClient);
  await ensureOptionalColumns(toClient);
  await executeOn(toClient, 'PRAGMA foreign_keys = OFF');

  const categoryCols = ['id', 'name', 'description', 'preview_image', 'created_at', 'updated_at'];
  const projectCols = [
    'id', 'category_id', 'title', 'description', 'content_type',
    'media_url', 'preview_url', 'is_hidden', 'display_order', 'created_at', 'updated_at'
  ];
  const messageCols = ['id', 'name', 'email', 'subject', 'message', 'created_at'];

  const categories = await copyTable(fromClient, toClient, 'categories', categoryCols);
  const projects = await copyTable(fromClient, toClient, 'projects', projectCols);
  const messages = await copyTable(fromClient, toClient, 'messages', messageCols);

  await executeOn(toClient, 'PRAGMA foreign_keys = ON');

  return { categories, projects, messages };
}

module.exports = {
  normalizeValue,
  executeOn,
  createSchema,
  ensureOptionalColumns,
  seedDefaultCategories,
  initializeDatabase,
  copyDatabase
};
