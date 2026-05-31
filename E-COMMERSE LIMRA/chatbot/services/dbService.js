import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../data');

// Ensure data folder exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const FILES = {
  conversations: path.join(DATA_DIR, 'conversations.json'),
  messages: path.join(DATA_DIR, 'messages.json'),
  settings: path.join(DATA_DIR, 'settings.json'),
  knowledge_base: path.join(DATA_DIR, 'knowledge_base.json'),
  customers: path.join(DATA_DIR, 'customers.json'),
  campaigns: path.join(DATA_DIR, 'campaigns.json')
};

// Generic read/write helpers
function readJSON(file, defaultVal = []) {
  if (!fs.existsSync(file)) {
    writeJSON(file, defaultVal);
    return defaultVal;
  }
  try {
    const data = fs.readFileSync(file, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error(`Error reading database file ${file}:`, err);
    return defaultVal;
  }
}

function writeJSON(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error(`Error writing database file ${file}:`, err);
    return false;
  }
}

// Initialise Database with rich fallback records
function initDatabase() {
  // 1. Settings Init
  const defaultSettings = {
    systemPrompt: `You are a warm, professional, and efficient AI Assistant for LIMRA Restaurant. 
Always greet guests, answer details using the Knowledge Base, explain menu items with absolute clarity, and help with delivery charge estimations or order tracking.
Respond in the language that the customer speaks (English, Hindi, or Bengali). 
Keep answers concise, appetizing, and polite. If a customer is angry or asks to speak with a human, kindly transfer them to Human Agent Mode.`,
    personality: 'Warm & Appetizing',
    language: 'Auto',
    autoReply: true,
    handoffRules: 'Angry feedback, direct "human" or "agent" request, or rating <= 2 stars',
    responseTimeStyle: 'Instant (1-3 seconds)',
    enableOrderNotifications: true,
    orderTemplates: {
      confirmed: `Thank you for ordering from Limra Restaurant, {{name}}. Your order #{{orderId}} has been confirmed and our team has started processing it.

📋 *Ordered Items:*
{{items}}

💰 *Total Amount:* {{total}}
🛵 *Delivery Address:* {{address}}
⏳ *Estimated Delivery Time:* 35-45 mins`,
      preparing: `Good news, {{name}}! Your order #{{orderId}} is now being prepared by our kitchen team. 🍳🍢`,
      ready: `Your order #{{orderId}} is ready and will be dispatched shortly! 🛵🍜`,
      out_for_delivery: `Your order #{{orderId}} is on the way and will arrive soon! 🛵💨
      
👤 *Delivery Partner:* {{partner}}
📞 *Contact Number:* {{partnerPhone}}`,
      delivered: `Your order #{{orderId}} has been delivered. Thank you for choosing Limra Restaurant! Bon Appétit! 🍲😊`,
      review_request: `Hi {{name}}, we hope you loved your meal from Limra Restaurant! Can you please take 1 minute to rate your experience? ⭐⭐⭐⭐⭐
      
Feedback Link: https://g.page/r/limra-restaurant/review`,
      cancelled: `We apologize. Your order #{{orderId}} has been cancelled. Please contact support at +91 97390 83418 if you need assistance. 🙏`
    }
  };
  readJSON(FILES.settings, defaultSettings);

  // 2. Knowledge Base Init
  const defaultKB = [
    {
      id: 1,
      category: 'general',
      title: 'Restaurant Details',
      content: 'LIMRA Restaurant is a premium dining and delivery service specializing in high-fidelity Biryani, Mughlai dishes, Kebabs, and Tandoori items. Located at 12 Park Avenue. Open every day from 11:00 AM to 11:00 PM.'
    },
    {
      id: 2,
      category: 'menu',
      title: 'Limra Special Mutton Biryani',
      content: 'Price: ₹280. Description: Super premium basmati rice cooked with succulent mutton pieces, aromatic spices, and a boiled egg. Our house specialty.'
    },
    {
      id: 3,
      category: 'menu',
      title: 'Chicken Tikka Butter Masala',
      content: 'Price: ₹240. Description: Tandoor-grilled chicken tikka chunks cooked in a rich, creamy, buttery tomato sauce.'
    },
    {
      id: 4,
      category: 'menu',
      title: 'Tandoori Roti',
      content: 'Price: ₹30. Description: Whole wheat bread baked fresh in a traditional clay tandoor oven.'
    },
    {
      id: 5,
      category: 'delivery',
      title: 'Delivery Rules',
      content: 'We deliver up to 10 km. Delivery charge is dynamically calculated at checkout based on geocoded pin distances (flat ₹30 for local delivery, otherwise ₹10 per kilometer). Flat table booking reservation slot preference fee is ₹50.'
    },
    {
      id: 6,
      category: 'faqs',
      title: 'Is seating indoor available?',
      content: 'Yes! We have a gorgeous indoor table seating area. Booking seats requires a ₹50 slot reservation fee which syncs instantly in the admin dashboard.'
    }
  ];
  readJSON(FILES.knowledge_base, defaultKB);

  // 3. Customers Directory Init
  const defaultCustomers = [
    {
      phone: '9876543210',
      name: 'Arfat Salim',
      email: 'arfat@limraresturent.in',
      totalSpend: 1540.00,
      orderCount: 5,
      loyaltyPoints: 154,
      lastInteraction: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
      status: 'Loyal Client',
      notes: 'Prefers extra spicy mutton biryani. Always pays via UPI.'
    },
    {
      phone: '9123456789',
      name: 'Rohit Sharma',
      email: 'rohit@gmail.com',
      totalSpend: 420.00,
      orderCount: 2,
      loyaltyPoints: 42,
      lastInteraction: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
      status: 'Regular',
      notes: 'Prefers weekend dinners. Prefers Tandoori items.'
    }
  ];
  readJSON(FILES.customers, defaultCustomers);

  // 4. Conversations & Message History Init
  const defaultConversations = [
    {
      phone: '9876543210',
      customer_name: 'Arfat Salim',
      mode: 'ai',
      status: 'active',
      satisfaction_score: 5,
      notes: 'Order status check',
      team_comments: 'Regular VIP client',
      unread_count: 0,
      last_message: 'Where is my mutton biryani order?',
      updated_at: new Date().toISOString()
    },
    {
      phone: '9123456789',
      customer_name: 'Rohit Sharma',
      mode: 'human',
      status: 'pending',
      satisfaction_score: null,
      notes: 'Handoff requested',
      team_comments: 'Wants to change table preference slot from indoor to outdoor',
      unread_count: 1,
      last_message: 'Can I change my seating preference for order #1024?',
      updated_at: new Date().toISOString()
    }
  ];
  readJSON(FILES.conversations, defaultConversations);

  const defaultMessages = [
    {
      id: 'm1',
      phone: '9876543210',
      sender: 'customer',
      body: 'Hello Limra Restaurant!',
      type: 'text',
      created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString()
    },
    {
      id: 'm2',
      phone: '9876543210',
      sender: 'ai',
      body: 'Hello Arfat! How can I assist you with your Limra dining experience today? 🍲🍛',
      type: 'text',
      created_at: new Date(Date.now() - 29 * 60 * 1000).toISOString()
    },
    {
      id: 'm3',
      phone: '9876543210',
      sender: 'customer',
      body: 'Where is my mutton biryani order?',
      type: 'text',
      created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString()
    },
    {
      id: 'm4',
      phone: '9123456789',
      sender: 'customer',
      body: 'Can I change my seating preference for order #1024?',
      type: 'text',
      created_at: new Date(Date.now() - 10 * 60 * 1000).toISOString()
    }
  ];
  readJSON(FILES.messages, defaultMessages);

  // 5. Campaigns Init
  const defaultCampaigns = [
    {
      id: 1,
      title: 'Saturday Biryani Bash Promotion',
      segment: 'All Customers',
      channel: 'WhatsApp',
      status: 'Completed',
      scheduledAt: new Date().toISOString(),
      sentCount: 124,
      responseRate: '34%'
    }
  ];
  readJSON(FILES.campaigns, defaultCampaigns);

  console.log('📦 [DB Service] High-Fidelity JSON Database fully initialized.');
}

initDatabase();

export const db = {
  // Settings API
  settings: {
    get: () => readJSON(FILES.settings, {}),
    update: (newSettings) => {
      const current = readJSON(FILES.settings, {});
      const updated = { ...current, ...newSettings };
      return writeJSON(FILES.settings, updated);
    }
  },

  // Conversations API
  conversations: {
    list: () => readJSON(FILES.conversations, []),
    getByPhone: (phone) => readJSON(FILES.conversations, []).find(c => c.phone === phone),
    upsert: (phone, record) => {
      const list = readJSON(FILES.conversations, []);
      const idx = list.findIndex(c => c.phone === phone);
      const now = new Date().toISOString();
      
      if (idx > -1) {
        list[idx] = { ...list[idx], ...record, phone, updated_at: now };
      } else {
        list.push({
          phone,
          customer_name: record.customer_name || 'Customer',
          mode: record.mode || 'ai',
          status: record.status || 'active',
          satisfaction_score: record.satisfaction_score || null,
          notes: record.notes || '',
          team_comments: record.team_comments || '',
          unread_count: record.unread_count || 0,
          last_message: record.last_message || '',
          updated_at: now
        });
      }
      writeJSON(FILES.conversations, list);
      return db.conversations.getByPhone(phone);
    },
    updateMode: (phone, mode) => {
      return db.conversations.upsert(phone, { mode });
    },
    updateComments: (phone, notes, team_comments) => {
      return db.conversations.upsert(phone, { notes, team_comments });
    }
  },

  // Messages API
  messages: {
    listByPhone: (phone) => readJSON(FILES.messages, []).filter(m => m.phone === phone),
    add: (phone, sender, body, type = 'text', mediaUrl = '') => {
      const list = readJSON(FILES.messages, []);
      const newMsg = {
        id: `msg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        phone,
        sender, // 'customer', 'agent', 'ai'
        body,
        type,
        mediaUrl,
        created_at: new Date().toISOString()
      };
      list.push(newMsg);
      writeJSON(FILES.messages, list);

      // Update last message in conversation
      db.conversations.upsert(phone, {
        last_message: body,
        unread_count: sender === 'customer' ? (db.conversations.getByPhone(phone)?.unread_count || 0) + 1 : 0
      });

      return newMsg;
    },
    clearUnread: (phone) => {
      db.conversations.upsert(phone, { unread_count: 0 });
    }
  },

  // Knowledge Base API
  knowledgeBase: {
    list: () => readJSON(FILES.knowledge_base, []),
    add: (category, title, content) => {
      const list = readJSON(FILES.knowledge_base, []);
      const newDoc = {
        id: Date.now(),
        category, // 'general', 'menu', 'delivery', 'faqs'
        title,
        content
      };
      list.push(newDoc);
      writeJSON(FILES.knowledge_base, list);
      return newDoc;
    },
    delete: (id) => {
      const list = readJSON(FILES.knowledge_base, []);
      const filtered = list.filter(item => item.id !== Number(id));
      return writeJSON(FILES.knowledge_base, filtered);
    }
  },

  // Customers API
  customers: {
    list: () => readJSON(FILES.customers, []),
    getByPhone: (phone) => readJSON(FILES.customers, []).find(c => c.phone === phone),
    upsert: (phone, record) => {
      const list = readJSON(FILES.customers, []);
      const idx = list.findIndex(c => c.phone === phone);
      if (idx > -1) {
        list[idx] = { ...list[idx], ...record, phone };
      } else {
        list.push({
          phone,
          name: record.name || 'New Client',
          email: record.email || '',
          totalSpend: record.totalSpend || 0,
          orderCount: record.orderCount || 0,
          loyaltyPoints: record.loyaltyPoints || 0,
          lastInteraction: new Date().toISOString(),
          status: record.status || 'Active',
          notes: record.notes || ''
        });
      }
      writeJSON(FILES.customers, list);
      return db.customers.getByPhone(phone);
    }
  },

  // Campaigns API
  campaigns: {
    list: () => readJSON(FILES.campaigns, []),
    add: (title, segment, messageBody) => {
      const list = readJSON(FILES.campaigns, []);
      const newCamp = {
        id: Date.now(),
        title,
        segment,
        channel: 'WhatsApp',
        status: 'Completed',
        scheduledAt: new Date().toISOString(),
        sentCount: segment === 'All Customers' ? 124 : 45,
        responseRate: '32%',
        messageBody
      };
      list.push(newCamp);
      writeJSON(FILES.campaigns, list);
      return newCamp;
    }
  }
};
