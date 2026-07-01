const express = require('express');
const { storeMessage } = require('../../utils/storeMessage');
const verifyMeta = require('../../middleware/verifyMeta');

const router = express.Router();

router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  res.status(403).json({ error: 'Verification failed' });
});

router.post('/', verifyMeta, async (req, res) => {
  try {
    const body = req.body;

    if (body.object === 'whatsapp_business_account') {
      const results = [];
      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          const value = change.value || {};
          for (const msg of value.messages || []) {
            const from = msg.from || '';
            const textBody = msg.text?.body || msg.text || '';
            const name = value.messaging_product || 'WhatsApp';

            const result = await storeMessage({
              platform: `WhatsApp (${name})`,
              sender: msg.id ? msg.id.slice(0, 31) : null,
              receiver: from,
              messageText: textBody,
              countryCode: '' + (from || '').slice(0, 4),
              rawPayload: msg,
              idempotencyKey: msg.id || null,
              sourceProvider: 'meta_whatsapp',
            });
            results.push(result);
          }
        }
      }
      return res.status(201).json({ status: 'ok', processed: results.length, results });
    }

    if (body.object === 'page') {
      const results = [];
      for (const entry of body.entry || []) {
        for (const event of entry.messaging || []) {
          const sender = event.sender?.id || '';
          const textBody = event.message?.text || '';
          const mid = event.message?.mid || '';

          const result = await storeMessage({
            platform: 'Facebook Messenger',
            sender: sender.slice(0, 31),
            receiver: sender,
            messageText: textBody,
            rawPayload: event,
            idempotencyKey: mid || null,
            sourceProvider: 'meta_messenger',
          });
          results.push(result);
        }
      }
      return res.status(201).json({ status: 'ok', processed: results.length, results });
    }

    res.status(400).json({ error: 'Unsupported object type', object: body.object });
  } catch (err) {
    console.error('Meta webhook error:', err);
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    res.status(500).json({ error: 'Failed to process Meta webhook' });
  }
});

module.exports = router;
