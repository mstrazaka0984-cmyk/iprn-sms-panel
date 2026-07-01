require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.PGHOST,
  port: process.env.PGPORT,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle Postgres client', err);
});

module.exports = pool;
