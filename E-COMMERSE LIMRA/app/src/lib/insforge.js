import { createClient } from '@insforge/sdk';

const baseUrl = import.meta.env.VITE_INSFORGE_URL || 'https://vb9ucr22.us-east.insforge.app';
const anonKey = import.meta.env.VITE_INSFORGE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3OC0xMjM0LTU2NzgtOTBhYi1jZGVmMTIzNDU2NzgiLCJlbWFpbCI6ImFub25AaW5zZm9yZ2UuY29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwNzQ3MjZ9.CORVtgdxoKKq0AhdUN0RY8s1h3jHMUF3ZOB0CpmnoYk';

export const insforge = createClient({ baseUrl, anonKey });

function formatError(error) {
  if (!error) return 'Unknown error';
  return error.message || error.details || error.hint || JSON.stringify(error);
}

// ─────────────────────────────────────────────────────────────────────────
// AUTH & CUSTOMER PROFILE FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────

/** Fetch active user profile from database */
export async function getCustomerProfile(userId) {
  const result = await insforge.database
    .from('customer_profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (result.error && result.error.code !== 'PGRST116') {
    // PGRST116 is code for "no rows returned", which is normal if profile doesn't exist yet
    throw new Error(formatError(result.error));
  }
  return result.data || null;
}

/** Insert or update customer profile */
export async function saveCustomerProfile(profile) {
  if (!profile.id) throw new Error('User ID is required to save profile');

  const result = await insforge.database
    .from('customer_profiles')
    .upsert({
      id: profile.id,
      name: profile.name,
      phone: profile.phone,
      email: profile.email,
      address: profile.address, // Expected to be stringified JSON or plain text
      updated_at: new Date().toISOString()
    });

  if (result.error) throw new Error(formatError(result.error));
  return result.data;
}

// ─────────────────────────────────────────────────────────────────────────
// ORDER & BOOKING ACTIONS (Synchronized with website)
// ─────────────────────────────────────────────────────────────────────────

/** Submit new order using security-definer place_order RPC */
export async function saveOrder({ customerName, customerPhone, items, notes = '' }) {
  if (!items || !items.length) {
    throw new Error('Your cart is empty');
  }

  const p_items = items.map(item => ({
    menu_item_id: Number(item.id),
    item_name: String(item.name),
    quantity: Math.max(1, Number(item.qty) || 1),
    unit_price: Number(item.price) || 0,
    line_total: (Number(item.price) || 0) * (Number(item.qty) || 1),
  }));

  const result = await insforge.database.rpc('place_order', {
    p_customer_name: customerName.trim(),
    p_customer_phone: customerPhone.trim(),
    p_notes: notes ? notes.trim() : '',
    p_items: p_items,
  });

  if (result.error) throw new Error(formatError(result.error));
  return result.data;
}

/** Get list of customer orders from RPC */
export async function getCustomerOrders(phone) {
  const result = await insforge.database.rpc('get_customer_orders', {
    p_phone: String(phone).trim(),
  });
  if (result.error) throw new Error(formatError(result.error));
  return normalizeRpcList(result.data);
}

/** Submit new booking using security-definer place_booking RPC */
export async function saveBooking(booking) {
  if (!booking.customer_name || !booking.customer_phone) {
    throw new Error('Name and phone are required');
  }

  const result = await insforge.database.rpc('place_booking', {
    p_type: booking.type || 'table',
    p_customer_name: booking.customer_name,
    p_customer_phone: booking.customer_phone,
    p_booking_date: booking.booking_date || null,
    p_booking_time: booking.booking_time || null,
    p_guests: booking.guests !== undefined ? Number(booking.guests) : null,
    p_preference: booking.preference || null,
    p_seat_label: booking.seat_label || null,
    p_event_type: booking.event_type || null,
    p_budget: booking.budget || null,
    p_catering: booking.catering || null,
    p_venue: booking.venue || null,
    p_message: booking.message || null,
    p_notes: booking.notes || null,
  });

  if (result.error) throw new Error(formatError(result.error));
  return result.data;
}

/** Get list of customer bookings from RPC */
export async function getCustomerBookings(phone) {
  const result = await insforge.database.rpc('get_customer_bookings', {
    p_phone: String(phone).trim(),
  });
  if (result.error) throw new Error(formatError(result.error));
  return normalizeRpcList(result.data);
}

// ─────────────────────────────────────────────────────────────────────────
// NOTIFICATIONS SYSTEM
// ─────────────────────────────────────────────────────────────────────────

/** Fetch notifications list for admin dashboard or client order updates */
export async function getNotifications() {
  const result = await insforge.database
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (result.error) throw new Error(formatError(result.error));
  return result.data || [];
}

/** Mark notification as read */
export async function markNotificationAsRead(id) {
  const result = await insforge.database
    .from('notifications')
    .update({ is_read: true })
    .eq('id', id);

  if (result.error) throw new Error(formatError(result.error));
  return result.data;
}

// ─────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────

function normalizeRpcList(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }
  return [data];
}
