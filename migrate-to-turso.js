#!/usr/bin/env node
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { createClient } = require('@libsql/client');
const { copyDatabase } = require('../db/schema');

async function main() {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;
  const localPath = path.resolve(process.env.LOCAL_DB_PATH || path.join(__dirname, '../db/portfolio.db'));

  if (!tursoUrl || !tursoUrl.trim() || tursoUrl.startsWith('file:')) {
    console.error('Set TURSO_DATABASE_URL in .env to your Turso URL, e.g. libsql://your-db-user.turso.io');
    process.exit(1);
  }

  if (!tursoToken || !tursoToken.trim()) {
    console.error('Set TURSO_AUTH_TOKEN in .env');
    process.exit(1);
  }

  if (!fs.existsSync(localPath)) {
    console.error(`Local SQLite file not found: ${localPath}`);
    process.exit(1);
  }

  console.log(`Source: ${localPath}`);
  console.log(`Target: ${tursoUrl}`);

  const source = createClient({ url: `file:${localPath}` });
  const dest = createClient({ url: tursoUrl.trim(), authToken: tursoToken.trim() });

  try {
    const counts = await copyDatabase(source, dest);
    console.log('Migration complete.');
    console.log(`  categories: ${counts.categories}`);
    console.log(`  projects:   ${counts.projects}`);
    console.log(`  messages:   ${counts.messages}`);
    console.log('Files were NOT uploaded. They stay on this server in public/uploads/.');
  } finally {
    await source.close();
    await dest.close();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
