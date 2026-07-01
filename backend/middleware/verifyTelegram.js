function verifyTelegram(req, res, next) {
  const secretToken = req.header('x-telegram-bot-api-secret-token');
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;

  if (!expected) {
    console.error('TELEGRAM_WEBHOOK_SECRET not configured');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  if (!secretToken || secretToken !== expected) {
    return res.status(401).json({ error: 'Invalid or missing Telegram secret token' });
  }

  next();
}

module.exports = verifyTelegram;
