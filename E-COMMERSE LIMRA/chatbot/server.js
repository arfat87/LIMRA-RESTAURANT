import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { config } from './config.js';
import { db } from './services/dbService.js';
import { geminiService } from './services/geminiService.js';
import { initRealtimeListener } from './services/realtimeListener.js';
import { initMarketingScheduler } from './services/marketingCron.js';
import { handleIncomingWhatsAppMessage } from './services/replyHandler.js';
import { sendWhatsAppMessage } from './providers/whatsappMock.js';
import { createAdminClient } from '@insforge/sdk';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const port = process.env.CHATBOT_PORT || 3000;

// Init InsForge admin client for live orders sync in REST APIs
const insforge = createAdminClient({ baseUrl: config.insforgeUrl, apiKey: config.insforgeAdminKey });

// Middleware parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static assets from public/
app.use(express.static(path.join(__dirname, 'public')));

// Health Check API
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    provider: config.whatsappProvider,
    timestamp: new Date().toISOString()
  });
});

// REST API 1: Dashboard Stats
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const convos = db.conversations.list();
    const customers = db.customers.list();
    
    const active = convos.filter(c => c.status === 'active').length;
    const pending = convos.filter(c => c.status === 'pending').length;
    const aiHandled = convos.filter(c => c.mode === 'ai').length;
    const humanHandled = convos.filter(c => c.mode === 'human').length;
    
    // Satisfaction Score calculation
    const scores = convos.map(c => c.satisfaction_score).filter(s => s !== null);
    const avgSatisfaction = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : '4.8';
    
    // Synchronize revenue statistics directly from InsForge Orders database
    let totalOrders = 0;
    let totalRevenue = 0;
    try {
      const { data: orders } = await insforge.database
        .from('orders')
        .select('total_amount, status');
        
      if (orders && orders.length) {
        totalOrders = orders.length;
        totalRevenue = orders
          .filter(o => o.status !== 'cancelled')
          .reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
      }
    } catch (dbErr) {
      console.warn('⚠️ [API] Dashboard stats failed to sync live InsForge revenue:', dbErr.message);
      // Fallback
      totalOrders = customers.length * 3;
      totalRevenue = customers.reduce((sum, c) => sum + c.totalSpend, 0);
    }
    
    res.json({
      totalConversations: convos.length,
      activeChats: active,
      pendingChats: pending,
      aiHandled,
      humanHandled,
      satisfactionScore: `${avgSatisfaction}/5.0`,
      totalOrders,
      totalRevenue: `₹${totalRevenue.toLocaleString()}`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// REST API 2: Conversations List
app.get('/api/conversations', (req, res) => {
  try {
    res.json(db.conversations.list());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// REST API 3: Timeline Message Logs
app.get('/api/conversations/:phone/messages', (req, res) => {
  try {
    const { phone } = req.params;
    db.messages.clearUnread(phone); // Clear unreads upon opening chat
    res.json(db.messages.listByPhone(phone));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// REST API 4: Send Manual Message as Human Operator
app.post('/api/conversations/:phone/send', async (req, res) => {
  try {
    const { phone } = req.params;
    const { body, sender = 'agent' } = req.body;
    
    if (!body) return res.status(400).json({ error: 'Message body is required' });
    
    // Add manual agent message to timeline
    const msg = db.messages.add(phone, sender, body);
    
    // Force set mode to 'human' if manual agent reply was sent, as requested in handoff rules
    db.conversations.upsert(phone, {
      mode: 'human',
      status: 'active',
      unread_count: 0
    });
    
    // Deliver mock WhatsApp message
    await sendWhatsAppMessage(phone, body);
    
    res.json(msg);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// REST API 5: Simulate Incoming Customer Message (Developer testing tool!)
app.post('/api/conversations/:phone/simulate', async (req, res) => {
  try {
    const { phone } = req.params;
    const { body } = req.body;
    
    if (!body) return res.status(400).json({ error: 'Message body is required' });
    
    // Execute incoming router pipeline
    await handleIncomingWhatsAppMessage(phone, body);
    
    res.json({ success: true, conversation: db.conversations.getByPhone(phone) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// REST API 6: Toggle human vs AI mode
app.post('/api/conversations/:phone/toggle', (req, res) => {
  try {
    const { phone } = req.params;
    const { mode } = req.body; // 'human' or 'ai'
    
    const convo = db.conversations.updateMode(phone, mode);
    res.json(convo);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// REST API 7: Update Conversation Metadata/Team Comments
app.post('/api/conversations/:phone/notes', (req, res) => {
  try {
    const { phone } = req.params;
    const { notes, team_comments } = req.body;
    
    const convo = db.conversations.updateComments(phone, notes, team_comments);
    res.json(convo);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// REST API 8: Settings (System Prompt)
app.get('/api/settings', (req, res) => {
  res.json(db.settings.get());
});

app.post('/api/settings', (req, res) => {
  try {
    db.settings.update(req.body);
    res.json({ success: true, settings: db.settings.get() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// REST API 9: Knowledge Base CRUD
app.get('/api/knowledge-base', (req, res) => {
  res.json(db.knowledgeBase.list());
});

app.post('/api/knowledge-base', (req, res) => {
  try {
    const { category, title, content } = req.body;
    const doc = db.knowledgeBase.add(category, title, content);
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/knowledge-base/:id', (req, res) => {
  try {
    db.knowledgeBase.delete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// REST API 10: Customers List
app.get('/api/customers', (req, res) => {
  res.json(db.customers.list());
});

// REST API 11: Orders sync directly from InsForge
app.get('/api/orders', async (req, res) => {
  try {
    const { data: orders, error } = await insforge.database
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);
      
    if (error) throw error;
    res.json(orders || []);
  } catch (err) {
    console.warn('⚠️ [API] Failed to fetch live orders from InsForge:', err.message);
    res.json([]);
  }
});

app.post('/api/orders/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const { data, error } = await insforge.database
      .from('orders')
      .update({ status })
      .eq('id', id)
      .select();
      
    if (error) throw error;
    res.json(data?.[0] || { success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// REST API 12: Marketing Campaigns
app.get('/api/marketing/campaigns', (req, res) => {
  res.json(db.campaigns.list());
});

app.post('/api/marketing/campaigns', (req, res) => {
  try {
    const { title, segment, messageBody } = req.body;
    const newCamp = db.campaigns.add(title, segment, messageBody);
    
    // Simulate campaigns transmission to segment
    const list = db.customers.list();
    list.forEach(cust => {
      sendWhatsAppMessage(cust.phone, `📣 *Limra Promotion Alert!* 📣\n\n${messageBody}`);
    });
    
    res.json(newCamp);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// REST API 13: Database Notifications Feed
app.get('/api/notifications', async (req, res) => {
  try {
    const { data: notifs } = await insforge.database
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    res.json(notifs || []);
  } catch (err) {
    res.json([]);
  }
});

// Incoming webhook for Twilio WhatsApp message receiver API
app.post('/webhook/twilio', async (req, res) => {
  const fromPhone = req.body.From || ''; // Twilio format: 'whatsapp:+919739083418'
  const messageBody = req.body.Body || '';
  
  if (fromPhone && messageBody) {
    const cleanPhone = fromPhone.replace('whatsapp:', '').replace('+', '');
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
  console.log(`🚀 LIMRA WhatsApp Chat Agent Portal active on port ${port}`);
  console.log(`======================================================\n`);
  
  // Start InsForge PostgreSQL Real-Time triggers WebSocket subscriptions
  initRealtimeListener();
  
  // Start Weekly Saturday 11:00 AM Cron scheduler
  initMarketingScheduler();
});
export default app;
