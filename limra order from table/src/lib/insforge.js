// ================================================================
// LIMRA RMS — InsForge SDK Client
// ================================================================
import { createClient } from '@insforge/sdk'

const INSFORGE_URL = import.meta.env.VITE_INSFORGE_URL
const INSFORGE_KEY = import.meta.env.VITE_INSFORGE_KEY

if (!INSFORGE_URL || !INSFORGE_KEY) {
  console.error('Missing InsForge credentials in .env.local')
}

export const db = createClient(INSFORGE_URL, INSFORGE_KEY)

// ── Auth helpers ──────────────────────────────────────────────────
export const auth = {
  /** Sign in with email + password */
  async signIn(email, password) {
    const { data, error } = await db.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  },

  /** Sign out */
  async signOut() {
    await db.auth.signOut()
  },

  /** Get current session user */
  async getUser() {
    const { data: { user } } = await db.auth.getUser()
    return user
  },

  /** Get current user's role(s) */
  async getUserRoles(userId) {
    const { data, error } = await db
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
    if (error) throw error
    return data.map(r => r.role)
  },

  /** Subscribe to auth state changes */
  onAuthStateChange(callback) {
    return db.auth.onAuthStateChange(callback)
  }
}

// ── Menu helpers ──────────────────────────────────────────────────
export const menu = {
  /** Get all active categories with items */
  async getCategories() {
    const { data, error } = await db
      .from('menu_categories')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')
    if (error) throw error
    return data
  },

  /** Get all available menu items */
  async getItems(categoryId = null) {
    let query = db
      .from('menu_items')
      .select('*, menu_categories(name)')
      .eq('is_available', true)
      .order('name')
    if (categoryId) query = query.eq('category_id', categoryId)
    const { data, error } = await query
    if (error) throw error
    return data
  },

  /** Get featured items */
  async getFeatured() {
    const { data, error } = await db
      .from('menu_items')
      .select('*, menu_categories(name)')
      .eq('is_available', true)
      .eq('is_featured', true)
      .order('name')
    if (error) throw error
    return data
  }
}

// ── Tables helpers ────────────────────────────────────────────────
export const tables = {
  /** Get table by number */
  async getByNumber(tableNumber) {
    const { data, error } = await db
      .from('restaurant_tables')
      .select('*, floor_areas(name)')
      .eq('table_number', tableNumber)
      .eq('is_active', true)
      .single()
    if (error) throw error
    return data
  },

  /** Get all tables with area info */
  async getAll() {
    const { data, error } = await db
      .from('restaurant_tables')
      .select('*, floor_areas(name)')
      .order('table_number')
    if (error) throw error
    return data
  },

  /** Update table status */
  async updateStatus(tableId, status) {
    const { data, error } = await db
      .from('restaurant_tables')
      .update({ status })
      .eq('id', tableId)
      .select()
      .single()
    if (error) throw error
    return data
  }
}

// ── Orders helpers ────────────────────────────────────────────────
export const orders = {
  /** Place a new order */
  async placeOrder({ tableId, areaId, items, notes }) {
    // Build totals
    const subtotal = items.reduce((s, i) => s + (i.price * i.qty), 0)
    const gst = parseFloat(import.meta.env.VITE_GST_RATE || '0.05')
    const tax = Math.round(subtotal * gst * 100) / 100
    const grandTotal = subtotal + tax

    // Generate order number client-side (backup; DB will override)
    const year = new Date().getFullYear()
    const rand = String(Date.now()).slice(-4)
    const orderNumber = `LIM-${year}-${rand}`

    // Insert order
    const { data: order, error: orderErr } = await db
      .from('orders')
      .insert([{
        order_number: orderNumber,
        table_id: tableId,
        area_id: areaId,
        subtotal,
        tax,
        discount: 0,
        grand_total: grandTotal,
        status: 'pending',
        payment_status: 'unpaid',
        notes: notes || null
      }])
      .select()
      .single()
    if (orderErr) throw orderErr

    // Insert order items
    const orderItems = items.map(item => ({
      order_id: order.id,
      menu_item_id: item.id,
      quantity: item.qty,
      unit_price: item.price,
      total_price: item.price * item.qty,
      special_instruction: item.note || null
    }))
    const { error: itemsErr } = await db.from('order_items').insert(orderItems)
    if (itemsErr) throw itemsErr

    // Update table status to 'ordering'
    await tables.updateStatus(tableId, 'ordering')

    return order
  },

  /** Get order with items by ID */
  async getById(orderId) {
    const { data, error } = await db
      .from('orders')
      .select(`*, restaurant_tables(table_number, floor_areas(name)), order_items(*, menu_items(name, image_url))`)
      .eq('id', orderId)
      .single()
    if (error) throw error
    return data
  },

  /** Get orders by table */
  async getByTable(tableId) {
    const { data, error } = await db
      .from('orders')
      .select(`*, order_items(*, menu_items(name))`)
      .eq('table_id', tableId)
      .not('status', 'in', '("completed","cancelled")')
      .order('created_at', { ascending: false })
    if (error) throw error
    return data
  },

  /** Get all active orders (for admin/kitchen) */
  async getActive() {
    const { data, error } = await db
      .from('orders')
      .select(`*, restaurant_tables(table_number, floor_areas(name)), order_items(*, menu_items(name, image_url))`)
      .not('status', 'in', '("completed","cancelled")')
      .order('created_at', { ascending: true })
    if (error) throw error
    return data
  },

  /** Update order status */
  async updateStatus(orderId, status) {
    const { data, error } = await db
      .from('orders')
      .update({ status })
      .eq('id', orderId)
      .select()
      .single()
    if (error) throw error
    return data
  },

  /** Mark order as paid */
  async markPaid(orderId, paymentMethod) {
    const { data: order } = await db.from('orders').select('grand_total').eq('id', orderId).single()
    const { error: payErr } = await db.from('payments').insert([{
      order_id: orderId,
      payment_method: paymentMethod,
      amount: order.grand_total,
      status: 'completed'
    }])
    if (payErr) throw payErr
    await db.from('orders').update({ payment_status: 'paid', status: 'completed' }).eq('id', orderId)
  }
}

// ── Waiter / Bill helpers ─────────────────────────────────────────
export const alerts = {
  async callWaiter(tableId) {
    const { data, error } = await db
      .from('waiter_calls')
      .insert([{ table_id: tableId, status: 'pending' }])
      .select().single()
    if (error) throw error
    return data
  },

  async requestBill(tableId, orderId) {
    const { data, error } = await db
      .from('bill_requests')
      .insert([{ table_id: tableId, order_id: orderId, status: 'pending' }])
      .select().single()
    if (error) throw error
    // Update table status
    await tables.updateStatus(tableId, 'billing_requested')
    return data
  }
}

// ── Realtime helpers ──────────────────────────────────────────────
export const realtime = {
  /** Subscribe to new/updated orders (kitchen/admin) */
  onOrders(callback) {
    return db.realtime
      .channel('orders-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, callback)
      .subscribe()
  },

  /** Subscribe to waiter calls */
  onWaiterCalls(callback) {
    return db.realtime
      .channel('waiter-calls-channel')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'waiter_calls' }, callback)
      .subscribe()
  },

  /** Subscribe to bill requests */
  onBillRequests(callback) {
    return db.realtime
      .channel('bill-requests-channel')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bill_requests' }, callback)
      .subscribe()
  },

  /** Subscribe to table status changes */
  onTables(callback) {
    return db.realtime
      .channel('tables-channel')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'restaurant_tables' }, callback)
      .subscribe()
  },

  /** Subscribe to a specific order status */
  onOrderStatus(orderId, callback) {
    return db.realtime
      .channel(`order-${orderId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
        filter: `id=eq.${orderId}`
      }, callback)
      .subscribe()
  },

  /** Unsubscribe */
  remove(channel) {
    db.realtime.removeChannel(channel)
  }
}

// ── Reports helpers ────────────────────────────────────────────────
export const reports = {
  async getDailyRevenue(date) {
    const start = date + 'T00:00:00Z'
    const end   = date + 'T23:59:59Z'
    const { data, error } = await db
      .from('orders')
      .select('grand_total, created_at, area_id')
      .eq('payment_status', 'paid')
      .gte('created_at', start)
      .lte('created_at', end)
    if (error) throw error
    return data
  },

  async getTopItems(limit = 10) {
    const { data, error } = await db
      .from('order_items')
      .select('menu_item_id, quantity, menu_items(name)')
      .order('quantity', { ascending: false })
      .limit(limit * 5) // over-fetch since we group client-side
    if (error) throw error
    // Group by menu item
    const grouped = {}
    data.forEach(row => {
      const key = row.menu_item_id
      if (!grouped[key]) grouped[key] = { name: row.menu_items?.name, qty: 0 }
      grouped[key].qty += row.quantity
    })
    return Object.values(grouped).sort((a,b) => b.qty - a.qty).slice(0, limit)
  }
}
