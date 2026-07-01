const crypto = require('crypto');

function verifyMeta(req, res, next) {
  const signature = req.header('x-hub-signature-256');
  if (!signature) {
    return res.status(401).json({ error: 'Missing X-Hub-Signature-256 header' });
  }

  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) {
    console.error('META_APP_SECRET not configured');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const rawBody = req.rawBody || JSON.stringify(req.body);
  const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  next();
}

module.exports = verifyMeta;
