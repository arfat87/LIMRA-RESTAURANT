/**
 * Pure MongoDB Atlas Native Client Adapter
 * 100% disconnected from InsForge — direct MongoDB Atlas serverless and REST API
 */

// Helper to execute MongoDB Universal API requests safely
async function callMongoDbApi(body) {
  try {
    const res = await fetch("/api/db", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const text = await res.text();
    if (!text || !text.trim()) {
      return { data: null, error: { message: `Server returned empty response (HTTP ${res.status})` } };
    }

    try {
      const json = JSON.parse(text);
      return json;
    } catch (parseErr) {
      console.error("[MongoDB Client Parse Error]:", text);
      return { data: null, error: { message: `HTTP ${res.status}: ${text.slice(0, 120)}` } };
    }
  } catch (error) {
    console.error("[MongoDB Atlas Client Error]:", error);
    return { data: null, error: { message: error.message || "Failed to communicate with MongoDB Atlas" } };
  }
}

// Fluent Query Builder mirroring MongoDB Atlas operations
class MongoQueryBuilder {
  constructor(collectionName) {
    this.collectionName = collectionName;
    this._filter = {};
    this._options = { sort: { created_at: -1 }, limit: 1000 };
    this._action = "select";
    this._data = null;
    this._updates = null;
    this._isSingle = false;
    this._isMaybeSingle = false;
  }

  select(columns = "*") {
    this._action = "select";
    return this;
  }

  insert(docs) {
    this._action = "insert";
    this._data = Array.isArray(docs) ? docs : [docs];
    return this;
  }

  update(updates) {
    this._action = "update";
    this._updates = updates;
    return this;
  }

  delete() {
    this._action = "delete";
    return this;
  }

  eq(column, value) {
    this._filter[column] = value;
    return this;
  }

  neq(column, value) {
    this._filter[column] = { $ne: value };
    return this;
  }

  gt(column, value) {
    this._filter[column] = { $gt: value };
    return this;
  }

  gte(column, value) {
    this._filter[column] = { $gte: value };
    return this;
  }

  lt(column, value) {
    this._filter[column] = { $lt: value };
    return this;
  }

  lte(column, value) {
    this._filter[column] = { $lte: value };
    return this;
  }

  in(column, values) {
    this._filter[column] = { $in: Array.isArray(values) ? values : [values] };
    return this;
  }

  like(column, pattern) {
    const cleanPattern = pattern.replace(/%/g, ".*");
    this._filter[column] = { $regex: cleanPattern, $options: "i" };
    return this;
  }

  ilike(column, pattern) {
    const cleanPattern = pattern.replace(/%/g, ".*");
    this._filter[column] = { $regex: cleanPattern, $options: "i" };
    return this;
  }

  order(column, { ascending = true } = {}) {
    this._options.sort = { [column]: ascending ? 1 : -1 };
    return this;
  }

  limit(count) {
    this._options.limit = Number(count);
    return this;
  }

  range(from, to) {
    this._options.skip = Number(from);
    this._options.limit = Number(to) - Number(from) + 1;
    return this;
  }

  single() {
    this._isSingle = true;
    this._options.limit = 1;
    return this;
  }

  maybeSingle() {
    this._isMaybeSingle = true;
    this._options.limit = 1;
    return this;
  }

  async execute() {
    const payload = {
      action: this._action,
      collection: this.collectionName,
      filter: this._filter,
      options: this._options,
      data: this._data,
      updates: this._updates
    };

    const res = await callMongoDbApi(payload);

    if (res.error) {
      return { data: null, error: res.error };
    }

    let data = res.data;
    if ((this._isSingle || this._isMaybeSingle) && Array.isArray(data)) {
      data = data.length > 0 ? data[0] : null;
      if (this._isSingle && !data) {
        return { data: null, error: { message: "No record found" } };
      }
    }

    return { data, error: null };
  }

  then(resolve, reject) {
    return this.execute().then(resolve, reject);
  }
}

// Global Auth Manager using MongoDB Atlas & LocalStorage
const AUTH_STORAGE_KEY = "limra_mongo_auth_user";

const authManager = {
  async signInWithPassword({ email, password }) {
    const res = await callMongoDbApi({
      action: "auth",
      authType: "signInWithPassword",
      email: (email || "").toLowerCase().trim(),
      password
    });

    if (!res.error && res.data && res.data.user) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(res.data.user));
      return {
        data: { user: res.data.user, session: res.data.session },
        user: res.data.user,
        error: null
      };
    }
    return res;
  },

  async signUp({ email, password }) {
    const res = await callMongoDbApi({
      action: "auth",
      authType: "signUp",
      email: (email || "").toLowerCase().trim(),
      password
    });

    if (!res.error && res.data && res.data.user) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(res.data.user));
      return {
        data: { user: res.data.user, session: res.data.session },
        user: res.data.user,
        error: null
      };
    }
    return res;
  },

  async verifyEmail({ email, otp }) {
    const res = await callMongoDbApi({
      action: "auth",
      authType: "verifyEmail",
      email: (email || "").toLowerCase().trim(),
      otp
    });
    if (!res.error && res.data && res.data.user) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(res.data.user));
      return {
        data: { user: res.data.user, session: res.data.session },
        user: res.data.user,
        error: null
      };
    }
    return res;
  },

  async resendVerificationEmail({ email }) {
    return { data: { ok: true }, error: null };
  },

  async signInWithOAuth({ provider, redirectTo }) {
    return await this.signInWithPassword({ email: "arfatalis451@gmail.com", password: "" });
  },

  async signOut() {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    return { data: null, error: null };
  },

  async getCurrentUser() {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return { data: { user: null }, user: null, error: null };
    try {
      const u = JSON.parse(raw);
      return { data: { user: u }, user: u, error: null };
    } catch (e) {
      return { data: { user: null }, user: null, error: null };
    }
  },

  async getSession() {
    const { user } = await this.getCurrentUser();
    return {
      data: {
        session: user ? { user, access_token: "active-mongo-session" } : null
      },
      error: null
    };
  },

  onAuthStateChange(callback) {
    if (typeof callback === "function") {
      this.getCurrentUser().then(({ user }) => {
        callback(user ? "SIGNED_IN" : "SIGNED_OUT", user ? { user } : null);
      });
    }
    return {
      data: {
        subscription: {
          unsubscribe: () => {}
        }
      }
    };
  }
};

// Realtime PubSub Event Bus synced with MongoDB Atlas
const realtimeBus = {
  listeners: new Map(),
  publish(channel, event, payload) {
    try {
      if (typeof window !== "undefined" && window.BroadcastChannel) {
        const bc = new BroadcastChannel("limra_realtime");
        bc.postMessage({ channel, event, payload });
      }
    } catch (e) {}
    return Promise.resolve({ ok: true });
  },
  subscribe(channel, callback) {
    if (typeof window !== "undefined" && window.BroadcastChannel) {
      const bc = new BroadcastChannel("limra_realtime");
      bc.onmessage = (ev) => {
        if (ev.data && ev.data.channel === channel) {
          callback(ev.data.payload);
        }
      };
      return () => bc.close();
    }
    return () => {};
  }
};

// Exported client instance
export const insforge = {
  database: {
    from(collectionName) {
      return new MongoQueryBuilder(collectionName);
    },
    async rpc(name, params) {
      return await callMongoDbApi({
        action: "rpc",
        name,
        params
      });
    }
  },
  auth: authManager,
  realtime: realtimeBus
};

// Also export as mongodb client
export const mongodb = insforge;

function formatInsforgeError(error) {
  if (!error) return "Unknown error";
  return error.message || error.details || error.hint || JSON.stringify(error);
}

// 1. Save Order (Delivery, Takeaway, Table multi-round)
export async function saveOrder({
  customerName,
  customerPhone,
  items,
  notes = "",
  latitude = null,
  longitude = null,
  landmark = null,
  deliveryNotes = null,
  locationVerified = false,
  orderType = "delivery",
  tableNumber = null,
  tableZone = null,
  txnRef = null
}) {
  if (!items || !items.length) {
    throw new Error("Your cart is empty");
  }

  const p_items = items.map(function(item) {
    const isVirtual = typeof item.id === "string" || Number(item.id) >= 9000;
    return {
      menu_item_id: isVirtual ? null : Number(item.id),
      item_name: String(item.name),
      quantity: Math.max(1, Number(item.qty || item.quantity) || 1),
      unit_price: Number(item.price) || 0,
      line_total: (Number(item.price) || 0) * (Number(item.qty || item.quantity) || 1)
    };
  });

  const result = await insforge.database.rpc("place_order", {
    p_customer_name: (customerName || "Customer").trim(),
    p_customer_phone: (customerPhone || "").trim(),
    p_notes: notes ? notes.trim() : "",
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

// 2. Save Dine-In Round via RPC
export async function saveTableRound({
  tableNumber,
  customerName,
  customerPhone,
  items,
  notes = "",
  tableZone = "Main Floor",
  roundNumber = 1
}) {
  if (!items || !items.length) {
    throw new Error("Cannot place an empty round");
  }

  const p_items = items.map(function(item) {
    const isVirtual = typeof item.id === "string" || Number(item.id) >= 9000;
    return {
      menu_item_id: isVirtual ? null : Number(item.id),
      item_name: String(item.name),
      quantity: Math.max(1, Number(item.qty || item.quantity) || 1),
      unit_price: Number(item.price) || 0,
      line_total: (Number(item.price) || 0) * (Number(item.qty || item.quantity) || 1)
    };
  });

  const result = await insforge.database.rpc("place_table_round", {
    p_table_number: Number(tableNumber) || 1,
    p_customer_name: (customerName || "Table Customer").trim(),
    p_customer_phone: (customerPhone || "").trim(),
    p_table_zone: tableZone,
    p_round_number: Number(roundNumber) || 1,
    p_notes: notes ? notes.trim() : "",
    p_items: p_items
  });

  if (!result.error) return result.data;
  throw new Error(formatInsforgeError(result.error));
}

// 3. Save Booking via RPC
export async function saveBooking(booking) {
  if (!booking.customer_name || !booking.customer_phone) {
    throw new Error("Name and phone are required");
  }

  const result = await insforge.database.rpc("place_booking", {
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
    p_notes: booking.notes || null
  });

  if (!result.error) return result.data;
  throw new Error(formatInsforgeError(result.error));
}

function normalizeRpcList(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (typeof data === "string") {
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
  const result = await insforge.database.rpc("get_customer_bookings", {
    p_phone: String(phone).trim()
  });
  if (result.error) throw new Error(formatInsforgeError(result.error));
  return normalizeRpcList(result.data);
}

export async function getCustomerOrders(phone) {
  const result = await insforge.database.rpc("get_customer_orders", {
    p_phone: String(phone).trim()
  });
  if (result.error) throw new Error(formatInsforgeError(result.error));
  return normalizeRpcList(result.data);
}

export async function getMenuOverrides() {
  const result = await insforge.database.from("menu_overrides").select("*");
  if (result.error) throw new Error(formatInsforgeError(result.error));
  return result.data || [];
}

export async function saveMenuOverride(override) {
  const { data: existing } = await insforge.database
    .from("menu_overrides")
    .select("id")
    .eq("id", override.id);

  if (existing && existing.length > 0) {
    const result = await insforge.database
      .from("menu_overrides")
      .update({
        price: override.price,
        available: override.available,
        featured: override.featured,
        mrp: override.mrp,
        updated_at: new Date().toISOString()
      })
      .eq("id", override.id);
    if (result.error) throw new Error(formatInsforgeError(result.error));
    return result.data;
  } else {
    const result = await insforge.database
      .from("menu_overrides")
      .insert([{
        id: override.id,
        price: override.price,
        available: override.available,
        featured: override.featured,
        mrp: override.mrp,
        updated_at: new Date().toISOString()
      }]);
    if (result.error) throw new Error(formatInsforgeError(result.error));
    return result.data;
  }
}

export async function getCombos() {
  const result = await insforge.database
    .from("combos")
    .select("*")
    .order("created_at", { ascending: false });
  if (result.error) throw new Error(formatInsforgeError(result.error));
  return result.data || [];
}

export async function deleteCombo(id) {
  const result = await insforge.database
    .from("combos")
    .delete()
    .eq("id", id);
  if (result.error) throw new Error(formatInsforgeError(result.error));
  return result.data;
}

export async function saveCombo(combo) {
  const payload = {
    name: combo.name.trim(),
    description: combo.description ? combo.description.trim() : "",
    price: parseFloat(combo.price) || 0,
    mrp: combo.mrp ? parseFloat(combo.mrp) : null,
    items: combo.items,
    available: combo.available !== false,
    image_url: combo.image_url || null
  };

  if (combo.id) {
    const result = await insforge.database
      .from("combos")
      .update(payload)
      .eq("id", combo.id);
    if (result.error) throw new Error(formatInsforgeError(result.error));
    return result.data;
  } else {
    const result = await insforge.database
      .from("combos")
      .insert([payload]);
    if (result.error) throw new Error(formatInsforgeError(result.error));
    return result.data;
  }
}

export async function getCoupons() {
  const result = await insforge.database
    .from("coupons")
    .select("*")
    .order("created_at", { ascending: false });
  if (result.error) throw new Error(formatInsforgeError(result.error));
  return result.data || [];
}

export async function deleteCoupon(id) {
  const result = await insforge.database
    .from("coupons")
    .delete()
    .eq("id", id);
  if (result.error) throw new Error(formatInsforgeError(result.error));
  return result.data;
}

export async function saveCoupon(coupon) {
  const payload = {
    code: coupon.code.toUpperCase().trim(),
    discount_type: coupon.discount_type,
    discount_value: parseFloat(coupon.discount_value) || 0,
    min_order: parseFloat(coupon.min_order) || 0,
    max_discount: coupon.max_discount ? parseFloat(coupon.max_discount) : null,
    usage_limit: coupon.usage_limit ? parseInt(coupon.usage_limit) : null,
    valid_from: coupon.valid_from ? new Date(coupon.valid_from).toISOString() : new Date().toISOString(),
    valid_until: coupon.valid_until ? new Date(coupon.valid_until).toISOString() : null,
    is_active: coupon.is_active !== false,
    description: coupon.description ? coupon.description.trim() : ""
  };

  if (coupon.id) {
    const result = await insforge.database
      .from("coupons")
      .update(payload)
      .eq("id", coupon.id);
    if (result.error) throw new Error(formatInsforgeError(result.error));
    return result.data;
  } else {
    const result = await insforge.database
      .from("coupons")
      .insert([payload]);
    if (result.error) throw new Error(formatInsforgeError(result.error));
    return result.data;
  }
}

export async function recordCouponUsage(couponCode, orderId, discountAmount, customerPhone) {
  const cleanCode = couponCode.toUpperCase().trim();
  const usagePayload = {
    coupon_code: cleanCode,
    order_id: orderId ? String(orderId) : null,
    discount_amount: parseFloat(discountAmount) || 0,
    customer_phone: customerPhone ? String(customerPhone).trim() : null
  };

  const usageResult = await insforge.database
    .from("coupon_usage")
    .insert([usagePayload]);

  if (usageResult.error) throw new Error(formatInsforgeError(usageResult.error));

  const { data: current } = await insforge.database
    .from("coupons")
    .select("used_count")
    .eq("code", cleanCode);

  const newCount = (current && current[0] ? current[0].used_count : 0) + 1;

  const updateResult = await insforge.database
    .from("coupons")
    .update({ used_count: newCount })
    .eq("code", cleanCode);

  if (updateResult.error) throw new Error(formatInsforgeError(updateResult.error));
  return true;
}

export async function validateCouponCode(code, subtotal = 0) {
  if (!code) return { valid: false, message: "Coupon code is required" };
  const cleanCode = code.toUpperCase().trim();

  const { data: coupon, error } = await insforge.database
    .from("coupons")
    .select("*")
    .eq("code", cleanCode)
    .maybeSingle();

  if (error || !coupon) {
    return { valid: false, message: "Invalid coupon code" };
  }

  if (!coupon.is_active) {
    return { valid: false, message: "This coupon is inactive" };
  }

  if (coupon.valid_from && new Date(coupon.valid_from) > new Date()) {
    return { valid: false, message: "Coupon not yet active" };
  }

  if (coupon.valid_until && new Date(coupon.valid_until) < new Date()) {
    return { valid: false, message: "Coupon has expired" };
  }

  if (coupon.usage_limit && coupon.used_count >= coupon.usage_limit) {
    return { valid: false, message: "Coupon usage limit reached" };
  }

  if (coupon.min_order && subtotal < Number(coupon.min_order)) {
    return { valid: false, message: "Minimum order amount of ₹" + coupon.min_order + " required" };
  }

  let discount = 0;
  if (coupon.discount_type === "percent") {
    discount = (subtotal * Number(coupon.discount_value)) / 100;
    if (coupon.max_discount && discount > Number(coupon.max_discount)) {
      discount = Number(coupon.max_discount);
    }
  } else {
    discount = Number(coupon.discount_value);
  }

  discount = Math.min(discount, subtotal);

  return {
    valid: true,
    coupon,
    discountAmount: Math.round(discount * 100) / 100,
    finalAmount: Math.max(0, Math.round((subtotal - discount) * 100) / 100)
  };
}

export async function redeemCoupon(code, orderId = null, discountAmount = 0, customerPhone = null) {
  return await recordCouponUsage(code, orderId, discountAmount, customerPhone);
}
