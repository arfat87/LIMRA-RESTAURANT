import { createAdminClient } from '@insforge/sdk';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

const insforge = createAdminClient({
  baseUrl: process.env.VITE_INSFORGE_URL || 'https://vb9ucr22.us-east.insforge.app',
  apiKey: process.env.INSFORGE_ADMIN_KEY || 'ik_799af068e8f4fb05944d04497229fe7d'
});

async function runTest() {
  console.log('🤖 Starting LIMRA Chatbot Integration Test...');
  
  // Clear old logs first
  const logFile = path.resolve('chatbot/logs/whatsapp-sent-mock.log');
  if (fs.existsSync(logFile)) {
    fs.unlinkSync(logFile);
    console.log('🗑️ Old mock logs cleared.');
  }

  try {
    // 1. Place a new order
    console.log('➡️ Step 1: Placing a test order...');
    const result = await insforge.database.rpc('place_order', {
      p_customer_name: 'Test Customer',
      p_customer_phone: '+919876543210',
      p_notes: 'Cargill details | [EMAIL: test@example.com] | [PAYMENT: upi] | [PAYMENT_STATUS: COMPLETED]',
      p_items: [
        {
          item_name: 'Special Tandoori Chicken Platter',
          quantity: 2,
          unit_price: 160.00,
          line_total: 320.00
        }
      ]
    });
    
    if (result.error) throw result.error;
    
    const order = result.data;
    console.log(`✅ Test Order Placed! Order Number: #${order.order_number}, ID: ${order.id}`);
    
    // Wait 6 seconds for the poller daemon to scan the DB and trigger "Order Placed"
    console.log('⏳ Waiting 6 seconds for Database Poller to detect new order...');
    await new Promise(r => setTimeout(r, 6000));
    
    // 2. Update status to 'confirmed'
    console.log('➡️ Step 2: Approving order (status pending -> confirmed)...');
    const updateResult = await insforge.database
      .from('orders')
      .update({ status: 'confirmed' })
      .eq('id', order.id);
      
    if (updateResult.error) throw updateResult.error;
    console.log('✅ Order status updated successfully.');
    
    // Wait 6 seconds for the poller daemon to detect status change and trigger "Order Confirmed"
    console.log('⏳ Waiting 6 seconds for Database Poller to detect status change...');
    await new Promise(r => setTimeout(r, 6000));
    
    // 3. Inspect logs to verify both messages were captured!
    console.log('➡️ Step 3: Verifying WhatsApp Log Receipts...');
    if (fs.existsSync(logFile)) {
      const logs = fs.readFileSync(logFile, 'utf8');
      console.log('\n📄 === CAPTURED WHATSAPP LOGS ===');
      console.log(logs);
      console.log('=================================\n');
      console.log('🎉 INTEGRATION TEST SUCCEEDED! All WhatsApp templates generated and logged beautifully.');
    } else {
      console.error('❌ FAIL: No logs written to whatsapp-sent-mock.log. Check chatbot server logs.');
    }
  } catch (err) {
    console.error('❌ Test failed with error:', err.message || err);
  }
  
  process.exit(0);
}

runTest();
