const pool = require('../db/pool');

function digitsOnly(str) {
  return (str || '').replace(/\D/g, '');
}

const OTP_REGEX = /\b\d{4,8}\b/;

async function storeMessage({
  platform,
  sender,
  receiver,
  otpCode,
  messageText,
  payout,
  currency,
  countryCode,
  status = 'received',
  receivedAt,
  rawPayload,
  idempotencyKey,
  sourceProvider,
}) {
  if (!platform || !receiver || !messageText) {
    const err = new Error('platform, receiver and messageText are required');
    err.statusCode = 400;
    throw err;
  }

  const numberValue = Number(digitsOnly(receiver));
  if (!numberValue) {
    const err = new Error('receiver must contain a valid number');
    err.statusCode = 400;
    throw err;
  }

  const detectedOtp = otpCode || (messageText.match(OTP_REGEX) || [])[0] || null;

  const platformRes = await pool.query(
    `INSERT INTO platforms (name) VALUES ($1)
     ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    [platform]
  );
  const platformId = platformRes.rows[0].id;

  const insertRes = await pool.query(
    `INSERT INTO messages
       (platform_id, platform_name, sender_number, receiver_number, number_value,
        country_code, otp_code, message_text, payout, currency, status, received_at,
        raw_payload, idempotency_key, source_provider)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, $12, $13, $14, $15)
     ON CONFLICT (idempotency_key) DO NOTHING
     RETURNING id, received_at`,
    [
      platformId,
      platform,
      sender || null,
      receiver,
      numberValue,
      countryCode || null,
      detectedOtp,
      messageText,
      payout || 0,
      currency || 'USD',
      status,
      receivedAt || new Date().toISOString(),
      rawPayload ? JSON.stringify(rawPayload) : null,
      idempotencyKey || null,
      sourceProvider || null,
    ]
  );

  if (!insertRes.rows.length) {
    return { status: 'duplicate', id: null, receivedAt: null, otpDetected: null };
  }

  return {
    status: 'ok',
    id: insertRes.rows[0].id,
    receivedAt: insertRes.rows[0].received_at,
    otpDetected: detectedOtp,
  };
}

module.exports = { storeMessage, digitsOnly };
