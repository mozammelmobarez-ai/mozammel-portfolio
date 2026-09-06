require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { createClient } = require('@libsql/client');
const {
  normalizeValue,
  initializeDatabase,
  copyDatabase
} = require('./schema');

const LOCAL_DB_PATH = path.join(__dirname, 'portfolio.db');

function resolvePrimaryConfig() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (url && url.trim()) {
    const config = { url: url.trim() };
    if (authToken && !url.trim().startsWith('file:')) {
      config.authToken = authToken.trim();
    }
    return config;
  }

  return { url: `file:${LOCAL_DB_PATH}` };
}

const primaryConfig = resolvePrimaryConfig();
let client = createClient(primaryConfig);
const usingTurso = Boolean(process.env.TURSO_DATABASE_URL && process.env.TURSO_DATABASE_URL.trim());

console.log(
  usingTurso
    ? `Connected to Turso database (${process.env.TURSO_DATABASE_URL})`
    : `Using local SQLite file (${LOCAL_DB_PATH})`
);

function normalizeRow(row) {
  if (!row) return null;
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    out[key] = normalizeValue(value);
  }
  return out;
}

function normalizeRows(rows) {
  return (rows || []).map(normalizeRow);
}

async function execute(sql, args = []) {
  return client.execute({ sql, args });
}

const ready = initializeDatabase(client).catch((err) => {
  console.error('Failed to initialize database:', err);
});

function withReady(fn) {
  return (...args) => {
    const callback = args.pop();
    ready
      .then(() => fn(...args))
      .then((result) => callback(null, result))
      .catch((err) => callback(err));
  };
}

function closeDb(callback) {
  Promise.resolve(client.close())
    .then(() => {
      if (callback) callback(null);
    })
    .catch((err) => {
      console.error('Error closing database:', err);
      if (callback) callback(err);
    });
}

const dbHelpers = {
  getAllCategories: withReady(async () => {
    const result = await execute(`
      SELECT c.*,
             (SELECT COALESCE(preview_url, media_url) FROM projects WHERE category_id = c.id AND is_hidden = 0 LIMIT 1) as preview_project_image
      FROM categories c
      ORDER BY c.created_at DESC
    `);
    return normalizeRows(result.rows);
  }),

  getCategoryById: withReady(async (id) => {
    const result = await execute('SELECT * FROM categories WHERE id = ?', [id]);
    return normalizeRow(result.rows[0]);
  }),

  createCategory: withReady(async (name, description, preview_image) => {
    const result = await execute(
      'INSERT INTO categories (name, description, preview_image) VALUES (?, ?, ?)',
      [name, description, preview_image]
    );
    return Number(result.lastInsertRowid);
  }),

  updateCategory: withReady(async (id, name, description, preview_image) => {
    await execute(
      'UPDATE categories SET name = ?, description = ?, preview_image = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [name, description, preview_image, id]
    );
  }),

  deleteCategory: withReady(async (id) => {
    await execute('DELETE FROM categories WHERE id = ?', [id]);
  }),

  getAllProjects: withReady(async () => {
    const result = await execute(
      'SELECT * FROM projects ORDER BY category_id, display_order, created_at DESC'
    );
    return normalizeRows(result.rows);
  }),

  getProjectsByCategory: withReady(async (categoryId) => {
    const result = await execute(
      'SELECT * FROM projects WHERE category_id = ? ORDER BY display_order, created_at DESC',
      [categoryId]
    );
    return normalizeRows(result.rows);
  }),

  getProjectById: withReady(async (id) => {
    const result = await execute('SELECT * FROM projects WHERE id = ?', [id]);
    return normalizeRow(result.rows[0]);
  }),

  getFirstProjectByCategory: withReady(async (categoryId) => {
    const result = await execute(
      'SELECT * FROM projects WHERE category_id = ? ORDER BY display_order, created_at DESC LIMIT 1',
      [categoryId]
    );
    return normalizeRow(result.rows[0]);
  }),

  createProject: withReady(async (categoryId, title, description, contentType, mediaUrl, displayOrder, previewUrl) => {
    const result = await execute(
      'INSERT INTO projects (category_id, title, description, content_type, media_url, preview_url, display_order) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [categoryId, title, description, contentType, mediaUrl, previewUrl, displayOrder]
    );
    return Number(result.lastInsertRowid);
  }),

  updateProject: withReady(async (id, categoryId, title, description, contentType, mediaUrl, displayOrder, previewUrl) => {
    await execute(
      'UPDATE projects SET category_id = ?, title = ?, description = ?, content_type = ?, media_url = ?, preview_url = ?, display_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [categoryId, title, description, contentType, mediaUrl, previewUrl, displayOrder, id]
    );
  }),

  deleteProject: withReady(async (id) => {
    await execute('DELETE FROM projects WHERE id = ?', [id]);
  }),

  toggleProjectVisibility: withReady(async (id, isHidden) => {
    await execute('UPDATE projects SET is_hidden = ? WHERE id = ?', [isHidden ? 1 : 0, id]);
  }),

  duplicateProject: withReady(async (id) => {
    const result = await execute('SELECT * FROM projects WHERE id = ?', [id]);
    const project = result.rows[0];
    if (!project) throw new Error('Project not found');

    const insert = await execute(
      'INSERT INTO projects (category_id, title, description, content_type, media_url, preview_url, is_hidden, display_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        project.category_id,
        `${project.title} (Copy)`,
        project.description,
        project.content_type,
        project.media_url,
        project.preview_url,
        1,
        project.display_order
      ]
    );
    return Number(insert.lastInsertRowid);
  }),

  deleteMultipleProjects: withReady(async (ids) => {
    if (!ids || ids.length === 0) return;
    const placeholders = ids.map(() => '?').join(',');
    await execute(`DELETE FROM projects WHERE id IN (${placeholders})`, ids);
  }),

  moveProjectCategory: withReady(async (id, newCategoryId) => {
    await execute('UPDATE projects SET category_id = ? WHERE id = ?', [newCategoryId, id]);
  }),

  getAllMessages: withReady(async () => {
    const result = await execute('SELECT * FROM messages ORDER BY created_at DESC');
    return normalizeRows(result.rows);
  }),

  createMessage: withReady(async (name, email, subject, message) => {
    const result = await execute(
      'INSERT INTO messages (name, email, subject, message) VALUES (?, ?, ?, ?)',
      [name, email, subject, message]
    );
    return Number(result.lastInsertRowid);
  }),

  deleteMessage: withReady(async (id) => {
    await execute('DELETE FROM messages WHERE id = ?', [id]);
  }),

  resetDatabase: withReady(async () => {
    await execute('DROP TABLE IF EXISTS messages');
    await execute('DROP TABLE IF EXISTS projects');
    await execute('DROP TABLE IF EXISTS categories');
    await initializeDatabase(client);
  }),

  backupToSqliteFile: withReady(async (destPath) => {
    if (fs.existsSync(destPath)) {
      fs.unlinkSync(destPath);
    }
    const local = createClient({ url: `file:${destPath}` });
    try {
      return await copyDatabase(client, local);
    } finally {
      await local.close();
    }
  }),

  restoreDatabaseFromFile: withReady(async (sourcePath) => {
    if (!fs.existsSync(sourcePath)) {
      throw new Error('Backup file not found');
    }
    const source = createClient({ url: `file:${sourcePath}` });
    try {
      return await copyDatabase(source, client);
    } finally {
      await source.close();
    }
  })
};

module.exports = {
  get db() {
    return client;
  },
  usingTurso,
  closeDb,
  dbHelpers,
  copyDatabase,
  initializeDatabase
};
