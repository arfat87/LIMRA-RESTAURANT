import dotenv from 'dotenv';
import path from 'path';

import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

export const config = {
  insforgeUrl: process.env.VITE_INSFORGE_URL || 'https://vb9ucr22.us-east.insforge.app',
  insforgeAnonKey: process.env.VITE_INSFORGE_ANON_KEY || 'ik_799af068e8f4fb05944d04497229fe7d',
  insforgeAdminKey: process.env.INSFORGE_ADMIN_KEY || 'ik_799af068e8f4fb05944d04497229fe7d',
  whatsappProvider: process.env.WHATSAPP_PROVIDER || 'mock',
  twilioSid: process.env.TWILIO_ACCOUNT_SID || '',
  twilioToken: process.env.TWILIO_AUTH_TOKEN || '',
  twilioPhone: process.env.TWILIO_WHATSAPP_PHONE || 'whatsapp:+14155238886',
  metaToken: process.env.META_WHATSAPP_TOKEN || '',
  metaPhoneId: process.env.META_WHATSAPP_PHONE_ID || ''
};
