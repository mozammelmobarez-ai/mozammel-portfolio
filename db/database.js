const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'portfolio.db');

let db = null;

function closeDb(callback) {
  if (db) {
    const dbToClose = db;
    db = null; // Prevent double-close by setting global reference to null immediately
    dbToClose.close((err) => {
      if (err) {
        console.error('Error closing database:', err);
      } else {
        console.log('Database closed successfully');
      }
      if (callback) callback(err);
    });
  } else {
    if (callback) callback(null);
  }
}

function connectDb(callback) {
  closeDb(() => {
    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('Error opening database:', err);
        if (callback) callback(err);
      } else {
        console.log('Connected to SQLite database');
        db.run('PRAGMA foreign_keys = ON;', (err) => {
          if (err) console.error('Error enabling foreign keys:', err);
          else console.log('Foreign keys enabled');
        });
        initializeDatabase();
        if (callback) callback(null);
      }
    });
  });
}

connectDb();

function initializeDatabase() {
  db.serialize(() => {
    // Create categories table
    db.run(`
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        preview_image TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) console.error('Error creating categories table:', err);
      else console.log('Categories table ready');
    });

    // Create projects table
    db.run(`
      CREATE TABLE IF NOT EXISTS projects (
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
      )
    `, (err) => {
      if (err) console.error('Error creating projects table:', err);
      else console.log('Projects table ready');
    });

    // Create messages table
    db.run(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        subject TEXT,
        message TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) console.error('Error creating messages table:', err);
      else console.log('Messages table ready');
    });

    // Seed default categories if they don't exist
    seedDefaultCategories();
    ensurePreviewUrlColumn();
    ensureHiddenColumn();
  });
}

function seedDefaultCategories() {
  const categories = [
    { name: 'Graphic Design', description: 'Logo design, branding, and visual identity projects' },
    { name: 'Video Editing', description: 'Video production, editing, and motion graphics' },
    { name: 'Web Design', description: 'Website design and user interface projects' },
    { name: 'Poster Design', description: 'Poster and promotional design work' }
  ];

  categories.forEach((cat) => {
    db.get('SELECT id FROM categories WHERE name = ?', [cat.name], (err, row) => {
      if (err) {
        console.error('Error checking category:', err);
      } else if (!row) {
        db.run('INSERT INTO categories (name, description) VALUES (?, ?)', [cat.name, cat.description], (err) => {
          if (err) console.error('Error inserting category:', err);
          else console.log(`Category '${cat.name}' created`);
        });
      }
    });
  });
}

function ensurePreviewUrlColumn() {
  db.all(`PRAGMA table_info(projects)`, (err, rows) => {
    if (!err && rows && !rows.some((col) => col.name === 'preview_url')) {
      db.run(`ALTER TABLE projects ADD COLUMN preview_url TEXT`, (alterErr) => {
        if (alterErr) console.error('Error adding preview_url column:', alterErr);
        else console.log('Added preview_url column to projects table');
      });
    }
  });
}

function ensureHiddenColumn() {
  db.all(`PRAGMA table_info(projects)`, (err, rows) => {
    if (!err && rows && !rows.some((col) => col.name === 'is_hidden')) {
      db.run(`ALTER TABLE projects ADD COLUMN is_hidden INTEGER DEFAULT 0`, (alterErr) => {
        if (alterErr) console.error('Error adding is_hidden column:', alterErr);
        else console.log('Added is_hidden column to projects table');
      });
    }
  });
}

// Helper functions for database operations
const dbHelpers = {
  // Category operations
  getAllCategories: (callback) => {
    db.all(`
      SELECT c.*, 
             (SELECT COALESCE(preview_url, media_url) FROM projects WHERE category_id = c.id AND content_type = 'image' LIMIT 1) as preview_project_image
      FROM categories c 
      ORDER BY c.created_at DESC
    `, callback);
  },

  getCategoryById: (id, callback) => {
    db.get('SELECT * FROM categories WHERE id = ?', [id], callback);
  },

  createCategory: (name, description, preview_image, callback) => {
    db.run(
      'INSERT INTO categories (name, description, preview_image) VALUES (?, ?, ?)',
      [name, description, preview_image],
      function(err) {
        callback(err, this.lastID);
      }
    );
  },

  updateCategory: (id, name, description, preview_image, callback) => {
    db.run(
      'UPDATE categories SET name = ?, description = ?, preview_image = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [name, description, preview_image, id],
      callback
    );
  },

  deleteCategory: (id, callback) => {
    db.run('DELETE FROM categories WHERE id = ?', [id], callback);
  },

  // Project operations
  getAllProjects: (callback) => {
    db.all('SELECT * FROM projects ORDER BY category_id, display_order, created_at DESC', callback);
  },

  getProjectsByCategory: (categoryId, callback) => {
    db.all('SELECT * FROM projects WHERE category_id = ? ORDER BY display_order, created_at DESC', [categoryId], callback);
  },

  getProjectById: (id, callback) => {
    db.get('SELECT * FROM projects WHERE id = ?', [id], callback);
  },

  getFirstProjectByCategory: (categoryId, callback) => {
    db.get('SELECT * FROM projects WHERE category_id = ? ORDER BY display_order, created_at DESC LIMIT 1', [categoryId], callback);
  },

  createProject: (categoryId, title, description, contentType, mediaUrl, displayOrder, previewUrl, callback) => {
    db.run(
      'INSERT INTO projects (category_id, title, description, content_type, media_url, preview_url, display_order) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [categoryId, title, description, contentType, mediaUrl, previewUrl, displayOrder],
      function(err) {
        callback(err, this.lastID);
      }
    );
  },

  updateProject: (id, categoryId, title, description, contentType, mediaUrl, displayOrder, previewUrl, callback) => {
    db.run(
      'UPDATE projects SET category_id = ?, title = ?, description = ?, content_type = ?, media_url = ?, preview_url = ?, display_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [categoryId, title, description, contentType, mediaUrl, previewUrl, displayOrder, id],
      callback
    );
  },

  deleteProject: (id, callback) => {
    db.run('DELETE FROM projects WHERE id = ?', [id], callback);
  },

  toggleProjectVisibility: (id, isHidden, callback) => {
    db.run('UPDATE projects SET is_hidden = ? WHERE id = ?', [isHidden ? 1 : 0, id], callback);
  },

  duplicateProject: (id, callback) => {
    db.get('SELECT * FROM projects WHERE id = ?', [id], (err, project) => {
      if (err || !project) return callback(err || new Error('Project not found'));
      db.run(
        'INSERT INTO projects (category_id, title, description, content_type, media_url, preview_url, is_hidden, display_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [project.category_id, project.title + ' (Copy)', project.description, project.content_type, project.media_url, project.preview_url, 1, project.display_order],
        function(err) { callback(err, this.lastID); }
      );
    });
  },

  deleteMultipleProjects: (ids, callback) => {
    if (!ids || ids.length === 0) return callback(null);
    const placeholders = ids.map(() => '?').join(',');
    db.run(`DELETE FROM projects WHERE id IN (${placeholders})`, ids, callback);
  },

  moveProjectCategory: (id, newCategoryId, callback) => {
    db.run('UPDATE projects SET category_id = ? WHERE id = ?', [newCategoryId, id], callback);
  },

  // Message operations
  getAllMessages: (callback) => {
    db.all('SELECT * FROM messages ORDER BY created_at DESC', callback);
  },

  createMessage: (name, email, subject, message, callback) => {
    db.run(
      'INSERT INTO messages (name, email, subject, message) VALUES (?, ?, ?, ?)',
      [name, email, subject, message],
      function(err) {
        callback(err, this.lastID);
      }
    );
  },

  deleteMessage: (id, callback) => {
    db.run('DELETE FROM messages WHERE id = ?', [id], callback);
  },

  resetDatabase: (callback) => {
    db.serialize(() => {
      db.run('DROP TABLE IF EXISTS messages');
      db.run('DROP TABLE IF EXISTS projects');
      db.run('DROP TABLE IF EXISTS categories');
      initializeDatabase();
      callback(null);
    });
  },

  restoreDatabaseFromFile: (sourcePath, callback) => {
    closeDb((closeErr) => {
      try {
        const fs = require('fs');
        fs.copyFileSync(sourcePath, DB_PATH);
        connectDb((connectErr) => {
          callback(connectErr);
        });
      } catch (copyErr) {
        console.error('Error copying database file for restore:', copyErr);
        connectDb((connectErr) => {
          callback(copyErr || connectErr);
        });
      }
    });
  }
};

module.exports = {
  get db() { return db; },
  dbHelpers
};
