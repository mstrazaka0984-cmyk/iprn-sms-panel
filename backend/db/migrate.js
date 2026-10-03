// Runs schema.sql against the configured Postgres database.
const fs = require('fs');
const path = require('path');
const pool = require('./pool');

async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  try {
    await pool.query(sql);
    console.log('Migration complete: tables and indexes are ready.');
  } catch (err) {
    console.error('Migration failed:', err.message);
  }
}

module.exports = migrate;
