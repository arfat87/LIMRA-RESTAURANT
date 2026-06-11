import { createClient } from '@insforge/sdk';

const baseUrl = import.meta.env.VITE_INSFORGE_URL || '';
const anonKey = import.meta.env.VITE_INSFORGE_ANON_KEY || '';

if (!baseUrl || !anonKey) {
  console.warn('InsForge env vars missing. Set VITE_INSFORGE_URL and VITE_INSFORGE_ANON_KEY in .env');
}

export const insforge = createClient({ 
  baseUrl: baseUrl || 'https://placeholder-app.region.insforge.app', 
  anonKey: anonKey || 'placeholder-anon-key' 
});

function formatInsforgeError(error) {
  if (!error) return 'Unknown error';
  return error.message || error.details || error.hint || JSON.stringify(error);
}

/** Place order via RPC */
export async function saveOrder({
  customerName,
  customerPhone,
  items,
  notes = '',
  latitude = null,
  longitude = null,
  landmark = null,
  deliveryNotes = null,
  locationVerified = false,
  orderType = 'delivery',
  tableNumber = null,
  tableZone = null,
  txnRef = null
}) {
  if (!items || !items.length) {
    throw new Error('Your cart is empty');
  }

  const p_items = items.map(function(item) {
    return {
      menu_item_id: Number(item.id),
      item_name: String(item.name),
      quantity: Math.max(1, Number(item.qty || item.quantity) || 1),
      unit_price: Number(item.price) || 0,
      line_total: (Number(item.price) || 0) * (Number(item.qty || item.quantity) || 1),
    };
  });

  const result = await insforge.database.rpc('place_order', {
    p_customer_name: customerName.trim(),
    p_customer_phone: customerPhone.trim(),
    p_notes: notes ? notes.trim() : '',
    p_items: p_items,
    p_latitude: latitude,
    p_longitude: longitude,
    p_landmark: landmark,
    p_delivery_notes: deliveryNotes,
    p_location_verified: locationVerified,
    p_order_type: orderType,
    p_table_number: tableNumber,
    p_table_zone: tableZone,
    p_txn_ref: txnRef
  });

  if (!result.error) return result.data;

  throw new Error(formatInsforgeError(result.error));
}

/** Save booking via RPC */
export async function saveBooking(booking) {
  if (!booking.customer_name || !booking.customer_phone) {
    throw new Error('Name and phone are required');
  }

  const result = await insforge.database.rpc('place_booking', {
    p_type: booking.type,
    p_customer_name: booking.customer_name,
    p_customer_phone: booking.customer_phone,
    p_booking_date: booking.booking_date || null,
    p_booking_time: booking.booking_time || null,
    p_guests: booking.guests !== undefined ? booking.guests : null,
    p_preference: booking.preference || null,
    p_seat_label: booking.seat_label || null,
    p_event_type: booking.event_type || null,
    p_budget: booking.budget || null,
    p_catering: booking.catering || null,
    p_venue: booking.venue || null,
    p_message: booking.message || null,
    p_notes: booking.notes || null,
  });

  if (!result.error) return result.data;

  throw new Error(formatInsforgeError(result.error));
}

function normalizeRpcList(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (typeof data === 'string') {
    try {
      var parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }
  return [data];
}

export async function getCustomerBookings(phone) {
  const result = await insforge.database.rpc('get_customer_bookings', {
    p_phone: String(phone).trim(),
  });
  if (result.error) throw new Error(formatInsforgeError(result.error));
  return normalizeRpcList(result.data);
}

export async function getCustomerOrders(phone) {
  const result = await insforge.database.rpc('get_customer_orders', {
    p_phone: String(phone).trim(),
  });
  if (result.error) throw new Error(formatInsforgeError(result.error));
  return normalizeRpcList(result.data);
}
