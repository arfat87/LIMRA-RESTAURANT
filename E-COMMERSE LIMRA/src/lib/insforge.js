import { createClient } from '@insforge/sdk';

const DEFAULT_URL = 'https://vb9ucr22.us-east.insforge.app';
const DEFAULT_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3OC0xMjM0LTU2NzgtOTBhYi1jZGVmMTIzNDU2NzgiLCJlbWFpbCI6ImFub25AaW5zZm9yZ2UuY29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwNzQ3MjZ9.CORVtgdxoKKq0AhdUN0RY8s1h3jHMUF3ZOB0CpmnoYk';

const baseUrl = (import.meta.env.VITE_INSFORGE_URL && import.meta.env.VITE_INSFORGE_URL !== 'undefined')
  ? import.meta.env.VITE_INSFORGE_URL
  : DEFAULT_URL;

const anonKey = (import.meta.env.VITE_INSFORGE_ANON_KEY && import.meta.env.VITE_INSFORGE_ANON_KEY !== 'undefined')
  ? import.meta.env.VITE_INSFORGE_ANON_KEY
  : DEFAULT_ANON_KEY;

export const insforge = createClient({ 
  baseUrl: baseUrl, 
  anonKey: anonKey 
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
    const isVirtual = typeof item.id === 'string' || Number(item.id) >= 9000;
    return {
      menu_item_id: isVirtual ? null : Number(item.id),
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

export async function getMenuOverrides() {
  const result = await insforge.database.from('menu_overrides').select('*');
  if (result.error) throw new Error(formatInsforgeError(result.error));
  return result.data || [];
}

export async function saveMenuOverride(override) {
  const { data: existing } = await insforge.database
    .from('menu_overrides')
    .select('id')
    .eq('id', override.id);
    
  if (existing && existing.length > 0) {
    const result = await insforge.database
      .from('menu_overrides')
      .update({
        price: override.price,
        available: override.available,
        featured: override.featured,
        mrp: override.mrp,
        description: override.description,
        updated_at: new Date().toISOString()
      })
      .eq('id', override.id);
    if (result.error) throw new Error(formatInsforgeError(result.error));
    return result.data;
  } else {
    const result = await insforge.database
      .from('menu_overrides')
      .insert([{
        id: override.id,
        price: override.price,
        available: override.available,
        featured: override.featured,
        mrp: override.mrp,
        description: override.description,
        updated_at: new Date().toISOString()
      }]);
    if (result.error) throw new Error(formatInsforgeError(result.error));
    return result.data;
  }
}

export async function getCoupons() {
  const result = await insforge.database
    .from('coupons')
    .select('*')
    .order('created_at', { ascending: false });
  if (result.error) throw new Error(formatInsforgeError(result.error));
  return result.data || [];
}

export async function deleteCoupon(code) {
  const result = await insforge.database
    .from('coupons')
    .delete()
    .eq('code', String(code).trim().toUpperCase());
  if (result.error) throw new Error(formatInsforgeError(result.error));
  return result.data;
}

export async function saveCoupon(coupon) {
  const cleanCode = String(coupon.code).trim().toUpperCase();
  
  if (coupon.is_auto_send) {
    await insforge.database
      .from('coupons')
      .update({ is_auto_send: false })
      .eq('is_auto_send', true);
  }
  
  const { data: existing } = await insforge.database
    .from('coupons')
    .select('code')
    .eq('code', cleanCode);
    
  const payload = {
    code: cleanCode,
    discount_pct: parseInt(coupon.discount_pct, 10),
    max_uses: parseInt(coupon.max_uses, 10) || 100,
    expiry_date: coupon.expiry_date,
    min_bill: parseFloat(coupon.min_bill) || 0,
    active: coupon.active !== false,
    is_auto_send: coupon.is_auto_send === true
  };
  
  if (existing && existing.length > 0) {
    const result = await insforge.database
      .from('coupons')
      .update(payload)
      .eq('code', cleanCode);
    if (result.error) throw new Error(formatInsforgeError(result.error));
    return result.data;
  } else {
    payload.used_count = 0;
    const result = await insforge.database
      .from('coupons')
      .insert([payload]);
    if (result.error) throw new Error(formatInsforgeError(result.error));
    return result.data;
  }
}

export async function validateCouponCode(code, subtotal, phone) {
  const cleanCode = String(code).trim().toUpperCase();
  
  const { data: list, error } = await insforge.database
    .from('coupons')
    .select('*')
    .eq('code', cleanCode)
    .eq('active', true);
    
  if (error) throw new Error(formatInsforgeError(error));
  if (!list || list.length === 0) {
    throw new Error('Invalid or inactive coupon code');
  }
  
  const coupon = list[0];
  
  if (new Date(coupon.expiry_date) < new Date()) {
    throw new Error('Coupon code has expired');
  }
  
  if (coupon.used_count >= coupon.max_uses) {
    throw new Error('Coupon usage limit reached');
  }
  
  if (subtotal < parseFloat(coupon.min_bill)) {
    throw new Error(`Minimum bill of ₹${parseFloat(coupon.min_bill).toFixed(2)} required`);
  }
  
  if (phone && String(phone).trim()) {
    const cleanPhone = String(phone).trim();
    const { data: usage, error: usageErr } = await insforge.database
      .from('coupon_usage')
      .select('id')
      .eq('coupon_code', cleanCode)
      .eq('customer_phone', cleanPhone);
      
    if (usageErr) throw new Error(formatInsforgeError(usageErr));
    if (usage && usage.length > 0) {
      throw new Error('You have already used this coupon');
    }
  }
  
  return coupon;
}

export async function redeemCoupon(code, phone, orderId) {
  const cleanCode = String(code).trim().toUpperCase();
  const cleanPhone = String(phone).trim();
  
  const usageResult = await insforge.database
    .from('coupon_usage')
    .insert([{
      coupon_code: cleanCode,
      customer_phone: cleanPhone,
      order_id: orderId || null
    }]);
    
  if (usageResult.error) throw new Error(formatInsforgeError(usageResult.error));
  
  const { data: current } = await insforge.database
    .from('coupons')
    .select('used_count')
    .eq('code', cleanCode);
    
  const newCount = (current && current[0] ? current[0].used_count : 0) + 1;
  
  const updateResult = await insforge.database
    .from('coupons')
    .update({ used_count: newCount })
    .eq('code', cleanCode);
    
  if (updateResult.error) throw new Error(formatInsforgeError(updateResult.error));
  return true;
}

export async function getCombos() {
  const result = await insforge.database
    .from('combos')
    .select('*')
    .order('created_at', { ascending: false });
  if (result.error) throw new Error(formatInsforgeError(result.error));
  return result.data || [];
}

export async function deleteCombo(id) {
  const result = await insforge.database
    .from('combos')
    .delete()
    .eq('id', id);
  if (result.error) throw new Error(formatInsforgeError(result.error));
  return result.data;
}

export async function saveCombo(combo) {
  const payload = {
    name: combo.name.trim(),
    description: combo.description ? combo.description.trim() : '',
    price: parseFloat(combo.price) || 0,
    mrp: combo.mrp ? parseFloat(combo.mrp) : null,
    items: combo.items,
    available: combo.available !== false,
    image_url: combo.image_url || null
  };
  
  if (combo.id) {
    const result = await insforge.database
      .from('combos')
      .update(payload)
      .eq('id', combo.id);
    if (result.error) throw new Error(formatInsforgeError(result.error));
    return result.data;
  } else {
    const result = await insforge.database
      .from('combos')
      .insert([payload]);
    if (result.error) throw new Error(formatInsforgeError(result.error));
    return result.data;
  }
}
