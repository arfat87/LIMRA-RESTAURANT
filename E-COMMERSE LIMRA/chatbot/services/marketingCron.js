import cron from 'node-cron';
import { createAdminClient } from '@insforge/sdk';
import { config } from '../config.js';
import { TEMPLATES } from '../templates/messages.js';
import { sendWhatsAppMessage } from '../providers/whatsappMock.js';

const insforge = createAdminClient({ baseUrl: config.insforgeUrl, apiKey: config.insforgeAdminKey });

/**
  * Weekly Marketing Automation.
  * Cron schedule runs every Saturday at 11:00 AM.
  * Queries unique past customer names and phone numbers to send Sunday visit reminders.
  */
export function initMarketingScheduler() {
  console.log('⏰ Initializing Saturday 11 AM Weekly Marketing Scheduler...');
  
  // Weekly Saturday 11:00 AM Cron expression: '0 11 * * 6'
  cron.schedule('0 11 * * 6', async () => {
    console.log('📢 Executing Saturday Weekly Marketing Blast Pipeline...');
    try {
      // Query recent orders to fetch customer names & numbers
      const { data: orders, error } = await insforge.database
        .from('orders')
        .select('customer_name, customer_phone')
        .order('created_at', { ascending: false });
        
      if (error) {
        throw error;
      }
      
      const uniqueSubscribers = [];
      const seenPhones = new Set();
      
      for (const order of orders || []) {
        const rawPhone = order.customer_phone || '';
        const cleanPhone = rawPhone.replace(/\D/g, '');
        
        if (cleanPhone.length >= 10 && !seenPhones.has(cleanPhone)) {
          seenPhones.add(cleanPhone);
          uniqueSubscribers.push({
            name: order.customer_name,
            phone: rawPhone
          });
        }
      }
      
      console.log(`📣 Sending marketing blast notifications to ${uniqueSubscribers.length} unique subscribers...`);
      
      for (const sub of uniqueSubscribers) {
        const text = TEMPLATES.weeklyPromo(sub.name);
        await sendWhatsAppMessage(sub.phone, text);
        // Delay 1.2s to prevent throttling / spam markers
        await new Promise(r => setTimeout(r, 1200));
      }
    } catch (err) {
      console.error('❌ Weekly marketing blast failed:', err);
    }
  });
}
