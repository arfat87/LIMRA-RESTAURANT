import express from 'express';
import { config } from './config.js';
import { initRealtimeListener } from './services/realtimeListener.js';
import { initMarketingScheduler } from './services/marketingCron.js';
import { handleIncomingWhatsAppMessage } from './services/replyHandler.js';

const app = express();
const port = process.env.CHATBOT_PORT || 3000;

// Middleware parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check API
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    provider: config.whatsappProvider,
    timestamp: new Date().toISOString()
  });
});

// Incoming webhook for Twilio WhatsApp message receiver API
app.post('/webhook/twilio', async (req, res) => {
  const fromPhone = req.body.From || ''; // Twilio format: 'whatsapp:+919739083418'
  const messageBody = req.body.Body || '';
  
  if (fromPhone && messageBody) {
    const cleanPhone = fromPhone.replace('whatsapp:', '');
    await handleIncomingWhatsAppMessage(cleanPhone, messageBody);
  }
  res.sendStatus(200);
});

// Incoming webhook for Meta Cloud WhatsApp direct API receiver
app.post('/webhook/meta', async (req, res) => {
  // Verification challenge handling from Meta configuration setup
  if (req.query['hub.mode'] === 'subscribe') {
    return res.send(req.query['hub.challenge']);
  }
  
  const entry = req.body.entry?.[0];
  const changes = entry?.changes?.[0];
  const value = changes?.value;
  const message = value?.messages?.[0];
  
  if (message) {
    const fromPhone = message.from; // format: '919739083418'
    const text = message.text?.body || '';
    await handleIncomingWhatsAppMessage(fromPhone, text);
  }
  
  res.sendStatus(200);
});

// Start Pipelines
app.listen(port, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 LIMRA WhatsApp Chatbot Service active on port ${port}`);
  console.log(`======================================================\n`);
  
  // Start InsForge PostgreSQL Real-Time triggers WebSocket subscriptions
  initRealtimeListener();
  
  // Start Weekly Saturday 11:00 AM Cron scheduler
  initMarketingScheduler();
});
