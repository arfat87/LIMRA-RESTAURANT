import { createClient } from '@insforge/sdk';
import { config } from '../config.js';
import { TEMPLATES } from '../templates/messages.js';
import { sendWhatsAppMessage } from '../providers/whatsappMock.js';

const insforge = createClient({ baseUrl: config.insforgeUrl, anonKey: config.insforgeAnonKey });

/**
  * Listens to real-time updates inside PostgreSQL database via InsForge Realtime.
  * Captures insertions (Order Placed) and updates (Order Status Confirmed / Completed / Delivered).
  */
export function initRealtimeListener() {
  console.log('📡 Subscribing to InsForge Real-Time Orders table triggers...');
  
  // 1. Listen to Order Insertions (New Order Placed)
  insforge.database
    .from('orders')
    .on('INSERT', async (payload) => {
      const order = payload.new;
      console.log(`📥 [Realtime INSERT] New Order Captured: #${order.order_number}`);
      
      const phone = order.customer_phone || '';
      const text = TEMPLATES.orderPlaced(order.customer_name, order.order_number, order.total_amount);
      await sendWhatsAppMessage(phone, text);
    })
    .subscribe();
    
  // 2. Listen to Order Updates (Status Changes)
  insforge.database
    .from('orders')
    .on('UPDATE', async (payload) => {
      const oldOrder = payload.old;
      const newOrder = payload.new;
      
      if (oldOrder.status !== newOrder.status) {
        console.log(`🔄 [Realtime UPDATE] Order #${newOrder.order_number} status transition: ${oldOrder.status} -> ${newOrder.status}`);
        
        let messageText = '';
        const name = newOrder.customer_name;
        const num = newOrder.order_number;
        const phone = newOrder.customer_phone || '';
        
        switch (newOrder.status) {
          case 'confirmed':
            messageText = TEMPLATES.orderConfirmed(name, num);
            break;
          case 'completed':
            messageText = TEMPLATES.orderCompleted(name, num);
            break;
          case 'delivered':
            messageText = TEMPLATES.orderDelivered(name, num);
            break;
        }
        
        if (messageText) {
          await sendWhatsAppMessage(phone, messageText);
          
          // Queue a Review follow-up message 1 hour later if status is 'delivered'
          if (newOrder.status === 'delivered') {
            console.log(`⏳ Queueing Review request follow-up for order #${num} in 1 hour...`);
            setTimeout(async () => {
              const reviewText = TEMPLATES.reviewRequest(name);
              await sendWhatsAppMessage(phone, reviewText);
            }, 3600 * 1000); // 1 hour
          }
        }
      }
    })
    .subscribe();
}
