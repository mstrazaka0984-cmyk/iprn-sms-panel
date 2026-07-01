// Inserts a handful of platforms and sample OTP messages so the panel has
// something to show immediately after setup.
const pool = require('./pool');

const PLATFORMS = ['WhatsApp', 'Telegram', 'Google', 'Facebook', 'Generic Route A'];

function randomNumber(prefix, length) {
  let n = prefix;
  for (let i = 0; i < length; i++) n += Math.floor(Math.random() * 10);
  return n;
}

function randomOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const platformIds = {};
    for (const name of PLATFORMS) {
      const res = await client.query(
        `INSERT INTO platforms (name) VALUES ($1)
         ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
         RETURNING id, name`,
        [name]
      );
      platformIds[name] = res.rows[0].id;
    }

    const rows = 60;
    for (let i = 0; i < rows; i++) {
      const platform = PLATFORMS[Math.floor(Math.random() * PLATFORMS.length)];
      const receiver = randomNumber('92300', 7); // example country/operator prefix
      const otp = randomOtp();
      const payout = (Math.random() * 0.45 + 0.05).toFixed(4); // 0.05 - 0.50
      const receivedAt = daysAgo(Math.floor(Math.random() * 30));

      await client.query(
        `INSERT INTO messages
          (platform_id, platform_name, sender_number, receiver_number, number_value,
           country_code, otp_code, message_text, payout, currency, status, received_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          platformIds[platform],
          platform,
          platform.slice(0, 3).toUpperCase(),
          receiver,
          Number(receiver),
          '92',
          otp,
          `${otp} is your ${platform} verification code. Do not share it.`,
          payout,
          'USD',
          'received',
          receivedAt,
        ]
      );
    }

    await client.query('COMMIT');
    console.log(`Seeded ${PLATFORMS.length} platforms and ${rows} sample messages.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
