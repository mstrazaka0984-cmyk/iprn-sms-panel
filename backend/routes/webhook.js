const express = require('express');
const { storeMessage } = require('../utils/storeMessage');

const router = express.Router();

function requireWebhookToken(req, res, next) {
  const token = req.header('x-webhook-token');
  if (!token || token !== process.env.WEBHOOK_TOKEN) {
    return res.status(401).json({ error: 'Invalid or missing webhook token' });
  }
  next();
}

router.post('/receive', requireWebhookToken, async (req, res) => {
  try {
    const {
      platform,
      sender,
      receiver,
      otpCode,
      messageText,
      payout,
      currency,
      countryCode,
      rawPayload,
      idempotencyKey,
    } = req.body || {};

    const result = await storeMessage({
      platform,
      sender,
      receiver,
      otpCode,
      messageText,
      payout,
      currency,
      countryCode,
      rawPayload,
      idempotencyKey,
      sourceProvider: 'generic',
    });

    const statusCode = result.status === 'duplicate' ? 200 : 201;
    res.status(statusCode).json(result);
  } catch (err) {
    console.error('Generic webhook error:', err);
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    res.status(500).json({ error: 'Failed to store message' });
  }
});

module.exports = router;
