require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

// সার্ভার স্টার্ট হওয়ার সময় অটোমেটিক ডাটাবেজ মাইগ্রেশন রান করার জন্য
require('./db/migrate');

const { router: messagesRouter } = require('./routes/messages');
const webhookRouter = require('./routes/webhook');
const metaWebhookRouter = require('./routes/webhooks/meta');
const telegramWebhookRouter = require('./routes/webhooks/telegram');
const gmailWebhookRouter = require('./routes/webhooks/gmail');
const exportRouter = require('./routes/export');

const app = express();

app.use(cors());
app.use(morgan('dev'));

app.use(express.json({
  limit: '1mb',
  verify: (req, _res, buf) => { req.rawBody = buf.toString(); },
}));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/messages', messagesRouter);
app.use('/api/webhook', webhookRouter);
app.use('/api/webhooks/meta', metaWebhookRouter);
app.use('/api/webhooks/telegram', telegramWebhookRouter);
app.use('/api/webhooks/gmail', gmailWebhookRouter);
app.use('/api/export', exportRouter);

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

if (process.env.VERCEL !== '1') {
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => {
    console.log(`IPRN SMS Panel API listening on http://localhost:${PORT}`);
  });
}

module.exports = app;
