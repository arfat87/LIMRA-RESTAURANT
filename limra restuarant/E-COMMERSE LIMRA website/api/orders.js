import { getCollection } from "./lib/mongodb.js";
import { ObjectId } from "mongodb";

function generateOrderNumber() {
  const d = new Date();
  const dateStr = d.toISOString().slice(0,10).replace(/-/g, "");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return "ORD-" + dateStr + "-" + rand;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const ordersCol = await getCollection("orders");

    // POST: Create Order
    if (req.method === "POST") {
      const {
        customerName,
        customerPhone,
        items,
        notes = "",
        latitude = null,
        longitude = null,
        landmark = null,
        deliveryNotes = null,
        orderType = "delivery",
        tableNumber = null,
        tableZone = null,
        paymentMethod = "cod",
        paymentStatus = "pending",
        txnRef = null,
        roundNumber = 1
      } = req.body || {};

      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Order must contain at least one item." });
      }

      if (!customerName || !customerPhone) {
        return res.status(400).json({ error: "Customer name and phone are required." });
      }

      const orderItems = items.map(function(item) {
        const qty = Math.max(1, Number(item.quantity || item.qty) || 1);
        const price = Number(item.price || item.unit_price) || 0;
        return {
          id: item.id || null,
          name: String(item.name || "Item"),
          quantity: qty,
          unit_price: price,
          line_total: qty * price
        };
      });

      const subtotal = orderItems.reduce((acc, it) => acc + it.line_total, 0);
      const totalAmount = subtotal;
      const orderNumber = generateOrderNumber();

      const newOrder = {
        order_number: orderNumber,
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        order_type: orderType,
        table_number: tableNumber ? parseInt(tableNumber, 10) : null,
        table_zone: tableZone || null,
        round_number: Number(roundNumber) || 1,
        items: orderItems,
        subtotal: subtotal,
        total_amount: totalAmount,
        notes: notes ? notes.trim() : "",
        location: {
          latitude,
          longitude,
          landmark,
          delivery_notes: deliveryNotes
        },
        payment: {
          method: paymentMethod,
          status: paymentStatus,
          txn_ref: txnRef
        },
        status: "pending",
        created_at: new Date(),
        updated_at: new Date()
      };

      const result = await ordersCol.insertOne(newOrder);

      return res.status(201).json({
        success: true,
        data: {
          id: result.insertedId,
          order_number: orderNumber,
          total_amount: totalAmount,
          status: "pending",
          ...newOrder
        }
      });
    }

    // GET: Retrieve Orders
    if (req.method === "GET") {
      const { status, orderType, tableNumber, limit = 100 } = req.query || {};
      const query = {};

      if (status) query.status = status;
      if (orderType) query.order_type = orderType;
      if (tableNumber) query.table_number = parseInt(tableNumber, 10);

      const orders = await ordersCol
        .find(query)
        .sort({ created_at: -1 })
        .limit(Math.min(parseInt(limit, 10) || 100, 500))
        .toArray();

      return res.status(200).json({
        success: true,
        count: orders.length,
        data: orders
      });
    }

    // PATCH / PUT: Update Order Status
    if (req.method === "PATCH" || req.method === "PUT") {
      const { id, order_number, status, payment_status, notes } = req.body || {};

      if (!id && !order_number) {
        return res.status(400).json({ error: "Order id or order_number is required for update." });
      }

      const filter = id ? { _id: new ObjectId(id) } : { order_number: order_number };
      const updateDoc = {
        $set: {
          updated_at: new Date()
        }
      };

      if (status) updateDoc.$set.status = status;
      if (payment_status) updateDoc.$set["payment.status"] = payment_status;
      if (notes !== undefined) updateDoc.$set.notes = notes;

      const updateResult = await ordersCol.updateOne(filter, updateDoc);

      if (updateResult.matchedCount === 0) {
        return res.status(404).json({ error: "Order not found." });
      }

      const updatedOrder = await ordersCol.findOne(filter);
      return res.status(200).json({
        success: true,
        data: updatedOrder
      });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("MongoDB Orders API Error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error"
    });
  }
}
