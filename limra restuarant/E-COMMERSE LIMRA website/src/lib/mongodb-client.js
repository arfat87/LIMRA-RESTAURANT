/**
 * MongoDB Atlas API Client
 * Provides frontend helpers to interact with serverless MongoDB endpoints (/api/...)
 */

const API_BASE = "";

/**
 * Check MongoDB Atlas connection status and collection statistics
 */
export async function checkMongoDbStatus() {
  try {
    const res = await fetch(`${API_BASE}/api/db-status`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Status check failed with code ${res.status}`);
    }
    return await res.json();
  } catch (error) {
    console.error("[MongoDB Client] Status error:", error);
    throw error;
  }
}

/**
 * Place a new order into MongoDB Atlas
 */
export async function createMongoOrder(orderPayload) {
  try {
    const res = await fetch(`${API_BASE}/api/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(orderPayload)
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || "Failed to create order in MongoDB Atlas");
    }
    return data.data;
  } catch (error) {
    console.error("[MongoDB Client] Create order error:", error);
    throw error;
  }
}

/**
 * Fetch orders from MongoDB Atlas (Admin)
 */
export async function fetchMongoOrders(params = {}) {
  try {
    const query = new URLSearchParams();
    if (params.status) query.set("status", params.status);
    if (params.orderType) query.set("orderType", params.orderType);
    if (params.tableNumber) query.set("tableNumber", params.tableNumber);
    if (params.limit) query.set("limit", params.limit);

    const res = await fetch(`${API_BASE}/api/orders?${query.toString()}`);
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || "Failed to fetch orders from MongoDB Atlas");
    }
    return data.data;
  } catch (error) {
    console.error("[MongoDB Client] Fetch orders error:", error);
    throw error;
  }
}

/**
 * Update order status or payment in MongoDB Atlas
 */
export async function updateMongoOrderStatus({ id, order_number, status, payment_status, notes }) {
  try {
    const res = await fetch(`${API_BASE}/api/orders`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ id, order_number, status, payment_status, notes })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || "Failed to update order status");
    }
    return data.data;
  } catch (error) {
    console.error("[MongoDB Client] Update order error:", error);
    throw error;
  }
}

/**
 * Fetch menu items from MongoDB Atlas
 */
export async function fetchMongoMenuItems(category = null) {
  try {
    const url = category ? `${API_BASE}/api/menu?category=${encodeURIComponent(category)}` : `${API_BASE}/api/menu`;
    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || "Failed to fetch menu items from MongoDB Atlas");
    }
    return data.data;
  } catch (error) {
    console.error("[MongoDB Client] Fetch menu error:", error);
    throw error;
  }
}
