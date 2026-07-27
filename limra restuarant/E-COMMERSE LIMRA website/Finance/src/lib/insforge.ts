import { createClient } from '@insforge/sdk';

const baseUrl = import.meta.env.VITE_INSFORGE_URL || 'https://vb9ucr22.us-east.insforge.app';
const anonKey = import.meta.env.VITE_INSFORGE_ANON_KEY || '';

export const insforge = createClient({
  baseUrl,
  anonKey
});
