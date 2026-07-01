const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const pool = new Pool({
  host: process.env.PGHOST,
  port: process.env.PGPORT,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
});

async function migrateV2() {
  try {
    await pool.query(`
      ALTER TABLE messages
        ADD COLUMN IF NOT EXISTS raw_payload JSONB,
        ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255),
        ADD COLUMN IF NOT EXISTS source_provider VARCHAR(50);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_messages_idempotency_key ON messages (idempotency_key);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_messages_source_provider ON messages (source_provider);
    `);

    await pool.query(`
      DROP INDEX IF EXISTS idx_messages_idempotency_unique;
    `);

    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_idempotency_unique
      ON messages (idempotency_key);
    `);

    console.log('Migration v2 complete: added raw_payload, idempotency_key, source_provider columns.');
  } catch (err) {
    console.error('Migration v2 failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

migrateV2();
