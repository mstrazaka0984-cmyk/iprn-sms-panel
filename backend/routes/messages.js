const express = require('express');
const pool = require('../db/pool');

const router = express.Router();

// Builds a WHERE clause + params array from query filters shared by
// list, summary, and export endpoints.
function buildFilters(query) {
  const clauses = [];
  const params = [];
  let i = 1;

  if (query.numberFrom) {
    clauses.push(`number_value >= $${i++}`);
    params.push(Number(query.numberFrom));
  }
  if (query.numberTo) {
    clauses.push(`number_value <= $${i++}`);
    params.push(Number(query.numberTo));
  }
  if (query.dateFrom) {
    clauses.push(`received_at >= $${i++}`);
    params.push(query.dateFrom);
  }
  if (query.dateTo) {
    // include the whole end day
    clauses.push(`received_at <= $${i++}::date + interval '1 day'`);
    params.push(query.dateTo);
  }
  if (query.payoutMin) {
    clauses.push(`payout >= $${i++}`);
    params.push(Number(query.payoutMin));
  }
  if (query.payoutMax) {
    clauses.push(`payout <= $${i++}`);
    params.push(Number(query.payoutMax));
  }
  if (query.platform) {
    clauses.push(`platform_name = $${i++}`);
    params.push(query.platform);
  }
  if (query.status) {
    clauses.push(`status = $${i++}`);
    params.push(query.status);
  }
  if (query.search) {
    clauses.push(`(receiver_number ILIKE $${i} OR otp_code ILIKE $${i} OR message_text ILIKE $${i})`);
    params.push(`%${query.search}%`);
    i++;
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return { where, params, nextIndex: i };
}

// GET /api/messages?numberFrom=&numberTo=&dateFrom=&dateTo=&payoutMin=&payoutMax=&platform=&status=&search=&page=&pageSize=
router.get('/', async (req, res) => {
  try {
    const { where, params, nextIndex } = buildFilters(req.query);
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(200, Number(req.query.pageSize) || 25);
    const offset = (page - 1) * pageSize;

    const dataParams = [...params, pageSize, offset];
    const dataSql = `
      SELECT id, platform_name, sender_number, receiver_number, country_code,
             otp_code, message_text, payout, currency, status, received_at
      FROM messages
      ${where}
      ORDER BY received_at DESC
      LIMIT $${nextIndex} OFFSET $${nextIndex + 1}
    `;
    const countSql = `SELECT COUNT(*)::int AS count FROM messages ${where}`;

    const [dataRes, countRes] = await Promise.all([
      pool.query(dataSql, dataParams),
      pool.query(countSql, params),
    ]);

    res.json({
      rows: dataRes.rows,
      total: countRes.rows[0].count,
      page,
      pageSize,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// GET /api/messages/summary?...same filters
// Returns totals used for the dashboard cards (count + total payout).
router.get('/summary', async (req, res) => {
  try {
    const { where, params } = buildFilters(req.query);
    const sql = `
      SELECT COUNT(*)::int AS message_count,
             COALESCE(SUM(payout), 0)::float AS total_payout,
             COUNT(DISTINCT receiver_number)::int AS unique_numbers
      FROM messages
      ${where}
    `;
    const result = await pool.query(sql, params);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

// GET /api/messages/platforms - distinct platform names for the filter dropdown
router.get('/meta/platforms', async (req, res) => {
  try {
    const result = await pool.query('SELECT name FROM platforms ORDER BY name');
    res.json(result.rows.map((r) => r.name));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch platforms' });
  }
});

module.exports = { router, buildFilters };
