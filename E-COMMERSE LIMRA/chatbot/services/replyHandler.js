import { createAdminClient } from '@insforge/sdk';
import { config } from '../config.js';
import { sendWhatsAppMessage } from '../providers/whatsappMock.js';

const insforge = createAdminClient({ baseUrl: config.insforgeUrl, apiKey: config.insforgeAdminKey });

/**
  * Interactive 2-Way Autoreply Router.
  * Handles incoming WhatsApp messages from clients and replies with an engaging menu.
  */
export async function handleIncomingWhatsAppMessage(fromPhone, userMessage) {
  const text = String(userMessage).trim().toLowerCase();
  const phoneDigits = fromPhone.replace(/\D/g, '');
  
  console.log(`💬 [WhatsApp Webhook] Received from +${phoneDigits}: "${userMessage}"`);
  
  const mainMenuText = 
    `👋 *Welcome to the LIMRA Restaurant Chatbot!*\n` +
    `How can we serve you today? 🍛 We have hot and fresh tandoori, biryani, and desserts ready.\n\n` +
    `🔢 *Reply with a number below to query our assistant:*\n` +
    `*1* ➔ Check my active orders status 🛒\n` +
    `*2* ➔ View today's menu & specials 🍽\n` +
    `*3* ➔ Reserve a table / Party event 📅\n` +
    `*4* ➔ Contact SK Arif (Manager support) 📞`;

  let responseText = '';

  switch (text) {
    case '1':
      try {
        // Query the database for matching active customer orders
        const { data: orders, error } = await insforge.database
          .from('orders')
          .select('order_number, total_amount, status, created_at')
          .eq('customer_phone', fromPhone)
          .order('created_at', { ascending: false })
          .limit(3);
          
        if (error) throw error;
        
        if (!orders || orders.length === 0) {
          responseText = `🔍 We couldn't find any recent orders associated with your number (+${phoneDigits}) in our database.\n\nType *3* to book a table or *4* to call our helpdesk!`;
        } else {
          responseText = `🛒 *Your Recent Orders:*\n----------------------------------------\n`;
          orders.forEach(o => {
            const dateStr = new Date(o.created_at).toLocaleDateString('en-IN');
            const statusLabel = o.status.toUpperCase();
            responseText += `• *Order #${o.order_number}* (Placed: ${dateStr})\n  Grand Total: ₹${o.total_amount}\n  Status: *${statusLabel}* 📍\n\n`;
          });
          responseText += `Reply *4* to connect directly with manager support.`;
        }
      } catch (err) {
        console.error('Webhook order status query failed:', err);
        responseText = `⚠️ Sorry, we encountered a database synchronization issue. Please try again later or call support.`;
      }
      break;
      
    case '2':
      responseText = 
        `🍽️ *Today's Specials at LIMRA Restaurant:*\n----------------------------------------\n` +
        `🔥 *Starters:* Special Tandoori Chicken, Paneer Tikka (₹160)\n` +
        `🍛 *Mains:* SK Arif's Special Handi Mutton Biryani (₹240)\n` +
        `🥤 *Desserts:* Sweet Badam Milk, Special Mango Lassi\n\n` +
        `🛒 *Order Online:* https://vb9ucr22.insforge.site/#order`;
      break;
      
    case '3':
      responseText = 
        `📅 *Table Bookings & Catering Reservations:*\n----------------------------------------\n` +
        `Planning a party or booking a table? Indoor tables have a small ₹50 fee.\n\n` +
        `📍 *Reserve Online:* https://vb9ucr22.insforge.site/#booking\n` +
        `We cater birthdays, anniversaries, corporate events, and wedding parties!`;
      break;
      
    case '4':
      responseText = 
        `📞 *Connect with LIMRA Management:*\n----------------------------------------\n` +
        `Manager: SK Arif\n` +
        `📞 *Call:* +91 97390 83418\n` +
        `✉️ *Email:* limrarestaurant99@gmail.com\n\n` +
        `Give us a call and we'll resolve any issues immediately! 🙏`;
      break;
      
    default:
      // Fallback greeting displays the main interactive menu
      responseText = mainMenuText;
  }
  
  await sendWhatsAppMessage(fromPhone, responseText);
}
