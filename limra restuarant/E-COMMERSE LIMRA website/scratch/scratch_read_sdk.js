import { createAdminClient } from '@insforge/sdk';

const BASE_URL = 'https://vb9ucr22.us-east.insforge.app';
const API_KEY  = 'ik_799af068e8f4fb05944d04497229fe7d';

const admin = createAdminClient({ baseUrl: BASE_URL, apiKey: API_KEY });

console.log('Admin Client Keys:', Object.keys(admin));
if (admin.database) {
  console.log('Admin Database Keys:', Object.keys(admin.database));
  console.log('Admin Database prototype Keys:', Object.getOwnPropertyNames(Object.getPrototypeOf(admin.database)));
}
