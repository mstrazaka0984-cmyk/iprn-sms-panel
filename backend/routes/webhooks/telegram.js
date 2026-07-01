const express = require('express');
const { storeMessage } = require('../../utils/storeMessage');
const verifyTelegram = require('../../middleware/verifyTelegram');

const router = express.Router();

router.post('/', verifyTelegram, async (req, res) => {
  try {
    const update = req.body;
    const msg = update.message || update.channel_post || update.edited_message;

    if (!msg) {
      return res.status(200).json({ status: 'ignored', reason: 'no message in update' });
    }

    const chat = msg.chat || {};
    const from = msg.from || {};
    const text = msg.text || msg.caption || '';

    const chatId = String(chat.id || '');
    const senderUsername = from.username || from.first_name || '';
    const messageId = String(update.update_id || '');

    const result = await storeMessage({
      platform: 'Telegram',
      sender: (senderUsername || chatId).slice(0, 31),
      receiver: chatId,
      messageText: text,
      countryCode: null,
      rawPayload: update,
      idempotencyKey: messageId ? `tg_${messageId}` : null,
      sourceProvider: 'telegram',
    });

    res.status(201).json(result);
  } catch (err) {
    console.error('Telegram webhook error:', err);
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    res.status(500).json({ error: 'Failed to process Telegram webhook' });
  }
});

module.exports = router;
