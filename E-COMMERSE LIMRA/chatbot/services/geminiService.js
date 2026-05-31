import OpenAI from 'openai';
import { createAdminClient } from '@insforge/sdk';
import { db } from './dbService.js';
import { config } from '../config.js';

// Init InsForge admin client
const insforge = createAdminClient({ baseUrl: config.insforgeUrl, apiKey: config.insforgeAdminKey });

// Init OpenAI/OpenRouter client if API key is provided
let openai = null;
if (process.env.OPENROUTER_API_KEY) {
  openai = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
    defaultHeaders: {
      'HTTP-Referer': 'https://limraresturent.in',
      'X-Title': 'Limra Restaurant Chat Agent',
    }
  });
  console.log('🤖 [Gemini Service] OpenAI/OpenRouter client initialized with Gemini 2.5 Flash.');
} else {
  console.log('🤖 [Gemini Service] OPENROUTER_API_KEY missing. Active high-fidelity fallback mock engine.');
}

/**
 * Builds the comprehensive system prompt context by joining system prompt, knowledge base,
 * and current customer order/booking history from InsForge DB.
 */
async function buildPromptContext(phone) {
  const settings = db.settings.get();
  const kb = db.knowledgeBase.list();
  
  // Format Knowledge Base docs
  const kbText = kb.map(doc => `[${doc.category.toUpperCase()}] ${doc.title}: ${doc.content}`).join('\n');
  
  // Fetch real-time orders & bookings from InsForge
  let ordersText = 'No orders found.';
  let bookingsText = 'No bookings found.';
  
  try {
    const cleanPhone = phone.replace(/\D/g, '');
    const { data: orders, error: oError } = await insforge.database
      .from('orders')
      .select('id, order_number, total_amount, status, notes, created_at')
      .ilike('customer_phone', `%${cleanPhone.slice(-10)}%`)
      .order('created_at', { ascending: false })
      .limit(5);
      
    if (!oError && orders && orders.length) {
      ordersText = orders.map(o => `Order #${o.order_number}: Status="${o.status}", Total="₹${o.total_amount}", Notes="${o.notes || 'none'}", Placed="${new Date(o.created_at).toLocaleString()}"`).join('\n');
    }
    
    const { data: bookings, error: bError } = await insforge.database
      .from('bookings')
      .select('id, booking_number, type, booking_date, booking_time, guests, status, created_at')
      .ilike('customer_phone', `%${cleanPhone.slice(-10)}%`)
      .order('created_at', { ascending: false })
      .limit(5);
      
    if (!bError && bookings && bookings.length) {
      bookingsText = bookings.map(b => `Booking #${b.booking_number} (${b.type}): Status="${b.status}", Date="${b.booking_date}", Time="${b.booking_time}", Guests="${b.guests}", Booked="${new Date(b.created_at).toLocaleString()}"`).join('\n');
    }
  } catch (err) {
    console.error('⚠️ [Gemini Service] Error loading database context for prompt:', err.message || err);
  }
  
  const fullSystemPrompt = `
${settings.systemPrompt}

=========================================
📖 RESTAURANT KNOWLEDGE BASE REFERENCE
=========================================
${kbText}

=========================================
🛵 CUSTOMER REAL-TIME CONTEXT (${phone})
=========================================
[Recent Orders in Database]:
${ordersText}

[Recent Table/Event Bookings in Database]:
${bookingsText}

=========================================
IMPORTANT RULE: 
- Answer customer questions only using the reference material above.
- If they ask about orders/bookings, use the order/booking database context provided.
- Do not make up order numbers or booking statuses.
- Keep answers warm and structured.
`;
  return fullSystemPrompt;
}

/**
 * High-fidelity fallback AI responder when OpenAI/OpenRouter is unavailable.
 * Analyzes query keywords and crafts rich, custom multi-lingual responses using the knowledge base and database context.
 */
async function generateFallbackResponse(phone, userMessage) {
  const kb = db.knowledgeBase.list();
  const context = await buildPromptContext(phone);
  
  const lowercaseMsg = userMessage.toLowerCase();
  
  // Detect customer language (English, Hindi, Bengali)
  let lang = 'en';
  if (lowercaseMsg.match(/(namaskar|halo|hi|hey|how|what|order|menu|price|delivery|book|table|mutton|biryani|chicken)/i)) {
    lang = 'en';
  }
  if (lowercaseMsg.match(/(menu|khana|kya|batao|order|khaney|dam|paise|price|time|samay|book)/i)) {
    // Basic Hindi detection
    if (lowercaseMsg.match(/(batao|kya|hai|namaste|shukriya|samay|rupe|paisa)/i)) lang = 'hi';
  }
  if (lowercaseMsg.match(/(bhalo|kemon|khabar|ami|amader|achhe|bajar|dam|taka|bhat|debi)/i)) {
    lang = 'bn';
  }

  // Helper template selector based on language
  const reply = (en, hi, bn) => {
    if (lang === 'hi') return hi;
    if (lang === 'bn') return bn;
    return en;
  };

  // 1. Check Seating / Table Booking Inquiry
  if (lowercaseMsg.includes('seat') || lowercaseMsg.includes('table') || lowercaseMsg.includes('book') || lowercaseMsg.includes('reserve')) {
    const feeDoc = kb.find(d => d.content.includes('₹50') || d.title.includes('seat') || d.title.includes('indoor'));
    const feeText = feeDoc ? feeDoc.content : 'Indoor seat bookings have a ₹50 slot preference fee.';
    return reply(
      `🍲 Yes, we have standard and VIP seating available! ${feeText} To book a table, simply use our online dashboard or provide your booking date, time, and guests count here. How many guests are you expecting?`,
      `🍲 हाँ, हमारे यहाँ सुंदर बैठने की जगह उपलब्ध है! ${feeText} टेबल बुक करने के लिए कृपया अपनी तारीख, समय और मेहमानों की संख्या बताएं। आप कितने लोग आ रहे हैं?`,
      `🍲 হ্যাঁ, আমাদের কাছে টেবিল বসার চমৎকার ব্যবস্থা আছে! ${feeText} টেবিল বুক করতে অনুগ্রহ করে আপনার তারিখ, সময় এবং অতিথির সংখ্যা জানান। আপনি কতজন আসতে চান?`
    );
  }

  // 2. Check Order Status Inquiry
  if (lowercaseMsg.includes('order') || lowercaseMsg.includes('delivered') || lowercaseMsg.includes('preparing') || lowercaseMsg.includes('status') || lowercaseMsg.includes('where')) {
    // Search context for order entries
    const match = context.match(/Order #\d+: Status="[^"]+", Total="₹\d+"[^,\n]*/g);
    if (match && match.length) {
      const latestOrder = match[0];
      return reply(
        `🛵 I found your latest order context in our system:\n👉 **${latestOrder}**\nOur kitchen staff is working hard to prepare it fresh for you!`,
        `🛵 मुझे सिस्टम में आपका ऑर्डर मिला:\n👉 **${latestOrder}**\nहमारी रसोई टीम इसे ताज़ा तैयार करने में जुटी है!`,
        `🛵 আমি আপনার অর্ডারটি খুঁজে পেয়েছি:\n👉 **${latestOrder}**\nআমাদের কিচেন স্টাফ এটি খুব তাড়াতাড়ি তৈরি করছে!`
      );
    } else {
      return reply(
        `🔍 I couldn't find any recent active orders under your phone number in our database. Could you please double-check your order number or let me place a new one?`,
        `🔍 मुझे आपके इस फ़ोन नंबर पर कोई हालिया सक्रिय ऑर्डर नहीं मिला। क्या आप कृपया अपना ऑर्डर नंबर जांच सकते हैं?`,
        `🔍 দুঃখিত, আমি আপনার এই নম্বরে কোনো সাম্প্রতিক অর্ডার খুঁজে পাচ্ছি না। দয়া করে আপনার অর্ডার নম্বরটি চেক করবেন কি?`
      );
    }
  }

  // 3. Menu / Specials Inquiry
  if (lowercaseMsg.includes('menu') || lowercaseMsg.includes('special') || lowercaseMsg.includes('eat') || lowercaseMsg.includes('food') || lowercaseMsg.includes('item') || lowercaseMsg.includes('biryani') || lowercaseMsg.includes('chicken')) {
    const menuDocs = kb.filter(d => d.category === 'menu');
    let menuListText = '';
    if (menuDocs.length) {
      menuListText = menuDocs.map(d => `🍛 **${d.title}** - ${d.content.split('Description:')[0].trim()}`).join('\n');
    } else {
      menuListText = `🍛 **Limra Special Mutton Biryani** (₹280)\n🍛 **Chicken Tikka Butter Masala** (₹240)\n🍛 **Tandoori Roti** (₹30)`;
    }

    return reply(
      `📋 Here are our highly recommended specialties from the Limra kitchen:\n\n${menuListText}\n\nWhat would you like to order today?`,
      `📋 लीमरा रसोई से हमारे विशेष पकवानों की सूची यहाँ है:\n\n${menuListText}\n\nआज आप क्या आर्डर करना पसंद करेंगे?`,
      `📋 লিমরা কিচেনের বিশেষ খাবারের তালিকা এখানে রয়েছে:\n\n${menuListText}\n\nআজ আপনি কি অর্ডার করতে চান?`
    );
  }

  // 4. Delivery inquiry
  if (lowercaseMsg.includes('delivery') || lowercaseMsg.includes('charge') || lowercaseMsg.includes('km') || lowercaseMsg.includes('price')) {
    const delDoc = kb.find(d => d.category === 'delivery');
    const delContent = delDoc ? delDoc.content : 'We deliver up to 10 km. Standard delivery is ₹30 for local delivery and ₹10/km for distance.';
    return reply(
      `🛵 **Delivery Information**:\n${delContent}\nLet me know your address to calculate the delivery charge!`,
      `🛵 **डिलीवरी की जानकारी**:\n${delContent}\nडिलीवरी शुल्क की गणना के लिए कृपया अपना पता बताएं!`,
      `🛵 **ডেলিভারি তথ্য**:\n${delContent}\nডেলিভারি চার্জ হিসেব করার জন্য দয়া করে আপনার ঠিকানাটি বলুন!`
    );
  }

  // Default Fallback
  return reply(
    `👋 Hello from LIMRA Restaurant! I am your AI Assistant. I can help you check order statuses, show you our delicious specials menu, book an indoor table (₹50 slot preference fee), and estimate delivery rates. How can I serve you today?`,
    `👋 लीमरा रेस्टोरेंट में आपका स्वागत है! मैं आपका एआई सहायक हूँ। मैं आपको आर्डर स्टेटस बताने, स्वादिष्ट मेनू दिखाने, टेबल बुक करने और डिलीवरी चार्ज बताने में मदद कर सकता हूँ। आज मैं आपकी क्या सेवा करूँ?`,
    `👋 লিমরা রেস্তোরাঁতে আপনাকে স্বাগত! আমি আপনার এআই সহকারী। আমি আপনাকে অর্ডার ট্র্যাকিং, মেনু কার্ড দেখা, টেবিল বুকিং করতে সাহায্য করতে পারি। আজ আমি আপনাকে কীভাবে সাহায্য করতে পারি?`
  );
}

export const geminiService = {
  /**
   * Main responder entry-point.
   * Feeds the context directly into Gemini 2.5 Flash on OpenRouter or returns the rich fallback logic.
   */
  generateResponse: async (phone, userMessage) => {
    // If OpenRouter is available, execute model call
    if (openai) {
      try {
        const fullSystemPrompt = await buildPromptContext(phone);
        
        // Fetch past conversation messages to keep brief context history
        const recentMessages = db.messages.listByPhone(phone).slice(-8);
        const formatHistory = recentMessages.map(m => ({
          role: m.sender === 'customer' ? 'user' : 'assistant',
          content: m.body
        }));
        
        const completion = await openai.chat.completions.create({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: fullSystemPrompt },
            ...formatHistory,
            { role: 'user', content: userMessage }
          ],
          temperature: 0.7,
          max_tokens: 400
        });
        
        const answer = completion.choices[0]?.message?.content;
        if (answer) {
          return answer.trim();
        }
      } catch (err) {
        console.error('❌ [Gemini Service] OpenRouter model call failed. Invoking Fallback Engine:', err.message || err);
      }
    }
    
    // Execute High-Fidelity local simulation fallback
    return await generateFallbackResponse(phone, userMessage);
  }
};
