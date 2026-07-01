const express = require('express');
const { storeMessage } = require('../../utils/storeMessage');
const verifyGoogle = require('../../middleware/verifyGoogle');

const router = express.Router();

function safeBase64(str) {
  return (str || '')
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .replace(/\s/g, '');
}

router.post('/', verifyGoogle, async (req, res) => {
  try {
    const body = req.body;

    const message = body.message || {};
    const data = message.data || '';

    let decoded;
    try {
      decoded = JSON.parse(Buffer.from(safeBase64(data), 'base64').toString('utf8'));
    } catch {
      return res.status(200).json({ status: 'ignored', reason: 'invalid pubsub data' });
    }

    const emailAddress = decoded.emailAddress || '';
    const historyId = decoded.historyId || '';

    const result = await storeMessage({
      platform: 'Gmail',
      sender: 'gmail-notification',
      receiver: emailAddress,
      messageText: `Gmail notification - historyId: ${historyId} - new email activity detected`,
      otpCode: null,
      rawPayload: decoded,
      idempotencyKey: `gm_${emailAddress}_${historyId}`,
      sourceProvider: 'gmail_pubsub',
    });

    res.status(201).json(result);
  } catch (err) {
    console.error('Gmail webhook error:', err);
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    res.status(500).json({ error: 'Failed to process Gmail webhook' });
  }
});

module.exports = router;
