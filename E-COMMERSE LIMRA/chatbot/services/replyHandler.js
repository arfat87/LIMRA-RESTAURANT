import { db } from './dbService.js';
import { geminiService } from './geminiService.js';
import { sendWhatsAppMessage } from '../providers/whatsappMock.js';

/**
 * 2-Way Autoreply Router & Switchboard.
 * Handles incoming customer messages:
 * 1. Logs message history in the database.
 * 2. Checks if Human Mode is active (suppressing auto-replies) or AI Mode is active.
 * 3. Triggers the Gemini AI engine context-aware response when in AI Mode.
 */
export async function handleIncomingWhatsAppMessage(fromPhone, userMessage) {
  const cleanPhone = String(fromPhone).trim();
  const bodyText = String(userMessage).trim();
  
  if (!cleanPhone || !bodyText) return;
  
  console.log(`📥 [WhatsApp Webhook] Incoming from ${cleanPhone}: "${bodyText}"`);
  
  // 1. Ensure conversation exists and register the client message
  let convo = db.conversations.getByPhone(cleanPhone);
  if (!convo) {
    // Attempt to match or add customer profile
    let customer = db.customers.getByPhone(cleanPhone);
    const name = customer ? customer.name : 'Client';
    
    convo = db.conversations.upsert(cleanPhone, {
      customer_name: name,
      mode: 'ai',
      status: 'active',
      last_message: bodyText,
      unread_count: 1
    });
  }
  
  // Add message to timeline history
  db.messages.add(cleanPhone, 'customer', bodyText);
  
  // Refresh conversation details in memory
  convo = db.conversations.getByPhone(cleanPhone);
  const currentMode = convo.mode || 'ai';
  
  // 2. Route message based on active mode
  if (currentMode === 'human') {
    // Human Mode active: do not auto-reply. Set status to pending to flag human takeover in dashboard
    console.log(`👨‍💼 [WhatsApp Switchboard] Chat +${cleanPhone} is in HUMAN Mode. Silently queuing for agent...`);
    db.conversations.upsert(cleanPhone, {
      status: 'pending',
      last_message: bodyText
    });
    return;
  }
  
  // 3. AI Mode active: trigger Gemini 2.5 Flash automation
  console.log(`🤖 [WhatsApp Switchboard] Chat +${cleanPhone} is in AI Mode. Triggering Gemini AI responder...`);
  
  try {
    const aiResponse = await geminiService.generateResponse(cleanPhone, bodyText);
    
    // Save AI response to database
    db.messages.add(cleanPhone, 'ai', aiResponse);
    
    // Reset unread count since AI resolved the chat
    db.conversations.upsert(cleanPhone, {
      status: 'active',
      unread_count: 0
    });
    
    // Send response via WhatsApp provider (mock log or live API)
    await sendWhatsAppMessage(cleanPhone, aiResponse);
    console.log(`🤖 [WhatsApp Switchboard] Auto-replied successfully to +${cleanPhone}.`);
    
  } catch (err) {
    console.error(`❌ [WhatsApp Switchboard] Error generating AI response for +${cleanPhone}:`, err.message || err);
  }
}
