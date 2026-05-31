import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
  * Beautiful WhatsApp Mock Provider Sandbox.
  * Simulates secure messaging, appends rich records to logs/whatsapp-sent-mock.log,
  * and outputs stylized notifications to standard out.
  */
export async function sendWhatsAppMessage(toPhone, messageText) {
  const formattedPhone = toPhone.replace(/\D/g, '');
  const timestamp = new Date().toLocaleString('en-IN');
  
  // Set logs directory robustly relative to this file
  const logDir = path.resolve(__dirname, '../logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  
  const logFile = path.join(logDir, 'whatsapp-sent-mock.log');
  const logEntry = `[${timestamp}] To: +${formattedPhone}\nMessage:\n${messageText}\n-------------------------------------------\n`;
  fs.appendFileSync(logFile, logEntry);
  
  console.log('\n======================================================');
  console.log(`🟢 [WhatsApp MOCK SEND] To: +${formattedPhone} (Logged in logs/whatsapp-sent-mock.log)`);
  console.log(`💬 Message:\n${messageText}`);
  console.log('======================================================\n');
  
  return { success: true, messageId: `mock_${Date.now()}` };
}
