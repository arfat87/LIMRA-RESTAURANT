import { getCollection, getDb } from "./lib/mongodb.js";
import { ObjectId } from "mongodb";

function generateOrderNumber() {
  const d = new Date();
  const dateStr = d.toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return "ORD-" + dateStr + "-" + rand;
}

export default async function handler(req, res) {
  if (res.setHeader) {
    res.setHeader("Access-Control-Allow-Credentials", true);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization"
    );
  }

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const { action, table, collection, query, filter, data, updates, options, rpc, params, auth } = req.body || {};
    const targetCollection = collection || table;

    // --- RPC DISPATCHER ---
    if (action === "rpc" || rpc) {
      const rpcName = rpc || req.body.name;
      const rpcParams = params || req.body.params || {};

      // 1. place_order
      if (rpcName === "place_order") {
        const {
          p_customer_name,
          p_customer_phone,
          p_notes = "",
          p_items = [],
          p_latitude = null,
          p_longitude = null,
          p_landmark = null,
          p_delivery_notes = null,
          p_location_verified = false,
          p_order_type = "delivery",
          p_table_number = null,
          p_table_zone = null,
          p_txn_ref = null
        } = rpcParams;

        const ordersCol = await getCollection("orders");
        const orderItemsCol = await getCollection("order_items");
        const notifCol = await getCollection("notifications");

        const orderItems = (p_items || []).map((it) => {
          const qty = Math.max(1, Number(it.quantity || it.qty) || 1);
          const price = Number(it.unit_price || it.price) || 0;
          return {
            menu_item_id: it.menu_item_id || it.id || null,
            item_name: String(it.item_name || it.name || "Item"),
            quantity: qty,
            unit_price: price,
            line_total: qty * price
          };
        });

        const subtotal = orderItems.reduce((acc, it) => acc + it.line_total, 0);
        const orderNumber = generateOrderNumber();
        const numTable = p_table_number ? parseInt(p_table_number, 10) : null;

        const newOrder = {
          order_number: orderNumber,
          customer_name: (p_customer_name || "").trim(),
          customer_phone: (p_customer_phone || "").trim(),
          order_type: p_order_type || "delivery",
          table_number: numTable,
          table_zone: p_table_zone || null,
          round_number: 1,
          items: orderItems,
          subtotal: subtotal,
          total_amount: subtotal,
          notes: p_notes ? p_notes.trim() : "",
          latitude: p_latitude,
          longitude: p_longitude,
          landmark: p_landmark,
          delivery_notes: p_delivery_notes,
          location_verified: Boolean(p_location_verified),
          status: "pending",
          payment_status: "pending",
          txn_ref: p_txn_ref,
          created_at: new Date(),
          updated_at: new Date()
        };

        const result = await ordersCol.insertOne(newOrder);
        newOrder.id = result.insertedId.toString();

        // Insert individual order items
        if (orderItems.length > 0) {
          const itemDocs = orderItems.map((it) => ({
            ...it,
            order_id: newOrder.id,
            created_at: new Date()
          }));
          await orderItemsCol.insertMany(itemDocs);
        }

        // Notification for dine-in or new order
        try {
          const notifMsg = numTable
            ? "Table " + numTable + " placed Order #" + orderNumber + " (" + orderItems.length + " items)"
            : "New Order #" + orderNumber + " from " + newOrder.customer_name;
          await notifCol.insertOne({
            type: "order",
            title: numTable ? "🍽️ Table " + numTable + " - New Order" : "🛒 New Order #" + orderNumber,
            message: notifMsg,
            description: notifMsg,
            order_id: newOrder.id,
            customer_phone: newOrder.customer_phone,
            is_read: false,
            created_at: new Date()
          });
        } catch (e) {}

        return res.status(200).json({ data: newOrder, error: null });
      }

      // 2. place_table_round
      if (rpcName === "place_table_round") {
        const {
          p_table_number,
          p_table_zone = "indoor",
          p_customer_name,
          p_customer_phone,
          p_items = [],
          p_notes = ""
        } = rpcParams;

        const numTable = parseInt(p_table_number, 10);
        const ordersCol = await getCollection("orders");
        const orderItemsCol = await getCollection("order_items");
        const notifCol = await getCollection("notifications");

        // Find existing active session for this table
        const activeOrder = await ordersCol.findOne(
          {
            table_number: numTable,
            order_type: "table",
            status: { $nin: ["completed", "delivered", "cancelled"] }
          },
          { sort: { created_at: -1 } }
        );

        const orderItems = (p_items || []).map((it) => {
          const qty = Math.max(1, Number(it.quantity || it.qty) || 1);
          const price = Number(it.unit_price || it.price) || 0;
          return {
            menu_item_id: it.menu_item_id || it.id || null,
            item_name: String(it.item_name || it.name || "Item"),
            quantity: qty,
            unit_price: price,
            line_total: qty * price
          };
        });

        const roundTotal = orderItems.reduce((acc, it) => acc + it.line_total, 0);

        if (!activeOrder) {
          // No active session -> throw NO_ACTIVE_SESSION so caller falls back to place_order
          return res.status(200).json({ data: null, error: { message: "NO_ACTIVE_SESSION" } });
        }

        const roundNumber = (activeOrder.round_number || 1) + 1;
        const newOrderNumber = generateOrderNumber();

        const roundOrder = {
          order_number: newOrderNumber,
          parent_order_id: activeOrder._id ? activeOrder._id.toString() : activeOrder.id,
          customer_name: (p_customer_name || activeOrder.customer_name || "").trim(),
          customer_phone: (p_customer_phone || activeOrder.customer_phone || "").trim(),
          order_type: "table",
          table_number: numTable,
          table_zone: p_table_zone || activeOrder.table_zone || "indoor",
          round_number: roundNumber,
          is_subsequent_round: true,
          items: orderItems,
          subtotal: roundTotal,
          total_amount: roundTotal,
          notes: "[ROUND: " + roundNumber + "] [TABLE: " + numTable + "] " + (p_notes ? p_notes.trim() : ""),
          status: "pending",
          payment_status: "pending",
          created_at: new Date(),
          updated_at: new Date()
        };

        const result = await ordersCol.insertOne(roundOrder);
        roundOrder.id = result.insertedId.toString();

        if (orderItems.length > 0) {
          const itemDocs = orderItems.map((it) => ({
            ...it,
            order_id: roundOrder.id,
            created_at: new Date()
          }));
          await orderItemsCol.insertMany(itemDocs);
        }

        try {
          const notifMsg = "Table " + numTable + " added Round " + roundNumber + " (" + orderItems.length + " items)";
          await notifCol.insertOne({
            type: "order",
            title: "🍽️ Table " + numTable + " - Round " + roundNumber,
            message: notifMsg,
            description: notifMsg,
            order_id: roundOrder.id,
            customer_phone: roundOrder.customer_phone,
            is_read: false,
            created_at: new Date()
          });
        } catch (e) {}

        return res.status(200).json({ data: roundOrder, error: null });
      }

      // 3. place_booking
      if (rpcName === "place_booking") {
        const bookingsCol = await getCollection("bookings");
        const notifCol = await getCollection("notifications");
        const bookingDoc = {
          ...rpcParams,
          customer_name: (rpcParams.p_customer_name || "").trim(),
          customer_phone: (rpcParams.p_customer_phone || "").trim(),
          type: rpcParams.p_type || "table",
          booking_date: rpcParams.p_booking_date || null,
          booking_time: rpcParams.p_booking_time || null,
          guests: rpcParams.p_guests || null,
          preference: rpcParams.p_preference || null,
          status: "pending",
          created_at: new Date(),
          updated_at: new Date()
        };

        const result = await bookingsCol.insertOne(bookingDoc);
        bookingDoc.id = result.insertedId.toString();

        try {
          const msg = "New Booking from " + bookingDoc.customer_name + " for " + (bookingDoc.booking_date || "date");
          await notifCol.insertOne({
            type: "booking",
            title: "📅 New Table Booking",
            message: msg,
            customer_phone: bookingDoc.customer_phone,
            is_read: false,
            created_at: new Date()
          });
        } catch (e) {}

        return res.status(200).json({ data: bookingDoc, error: null });
      }

      // 4. get_customer_orders
      if (rpcName === "get_customer_orders") {
        const phone = String(rpcParams.p_phone || "").trim();
        const ordersCol = await getCollection("orders");
        const orders = await ordersCol
          .find({ customer_phone: phone })
          .sort({ created_at: -1 })
          .limit(50)
          .toArray();
        return res.status(200).json({ data: orders, error: null });
      }

      // 5. get_customer_bookings
      if (rpcName === "get_customer_bookings") {
        const phone = String(rpcParams.p_phone || "").trim();
        const bookingsCol = await getCollection("bookings");
        const bookings = await bookingsCol
          .find({ customer_phone: phone })
          .sort({ created_at: -1 })
          .limit(50)
          .toArray();
        return res.status(200).json({ data: bookings, error: null });
      }

      // 6. Notification RPCs
      if (rpcName === "create_notification") {
        const notifCol = await getCollection("notifications");
        const doc = {
          ...rpcParams,
          is_read: false,
          created_at: new Date()
        };
        const result = await notifCol.insertOne(doc);
        return res.status(200).json({ data: { id: result.insertedId, ...doc }, error: null });
      }

      if (rpcName === "mark_notification_as_read") {
        const notifCol = await getCollection("notifications");
        const id = rpcParams.p_notification_id || rpcParams.id;
        const filter = id ? (ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { id: id }) : {};
        await notifCol.updateOne(filter, { $set: { is_read: true, updated_at: new Date() } });
        return res.status(200).json({ data: true, error: null });
      }

      if (rpcName === "mark_all_notifications_as_read") {
        const notifCol = await getCollection("notifications");
        const phone = rpcParams.p_phone || rpcParams.customer_phone;
        const filter = phone ? { customer_phone: String(phone).trim() } : {};
        await notifCol.updateMany(filter, { $set: { is_read: true, updated_at: new Date() } });
        return res.status(200).json({ data: true, error: null });
      }

      if (rpcName === "get_customer_notifications") {
        const notifCol = await getCollection("notifications");
        const phone = String(rpcParams.p_phone || "").trim();
        const notifs = await notifCol
          .find({ customer_phone: phone })
          .sort({ created_at: -1 })
          .limit(50)
          .toArray();
        return res.status(200).json({ data: notifs, error: null });
      }

      if (rpcName === "update_order_payment_status") {
        const ordersCol = await getCollection("orders");
        const orderId = rpcParams.p_order_id;
        const status = rpcParams.p_payment_status;
        const notes = rpcParams.p_notes;

        const filter = ObjectId.isValid(orderId) ? { $or: [{ id: orderId }, { _id: new ObjectId(orderId) }] } : { id: orderId };
        const updateDoc = {
          $set: {
            payment_status: status,
            updated_at: new Date()
          }
        };
        if (notes) updateDoc.$set["payment.notes"] = notes;

        await ordersCol.updateOne(filter, updateDoc);
        const updated = await ordersCol.findOne(filter);
        return res.status(200).json({ data: updated, error: null });
      }

      if (rpcName === "verify_upi_payment") {
        const paymentsCol = await getCollection("verified_payments");
        const utr = rpcParams.p_utr || rpcParams.utr;
        const amount = rpcParams.p_amount || rpcParams.amount;

        await paymentsCol.updateOne(
          { utr: String(utr) },
          {
            $set: {
              utr: String(utr),
              amount: Number(amount) || 0,
              status: "success",
              updated_at: new Date()
            },
            $setOnInsert: { created_at: new Date() }
          },
          { upsert: true }
        );
        return res.status(200).json({ data: { success: true }, error: null });
      }

      // Default RPC fallback
      return res.status(200).json({ data: null, error: null });
    }

    // --- AUTH DISPATCHER ---
    if (action === "auth" || auth) {
      const authType = (auth && auth.type) || req.body.authType;
      const adminCol = await getCollection("admin_users");
      const authUsersCol = await getCollection("auth_users");

      if (authType === "signInWithPassword" || authType === "login" || authType === "signUp" || authType === "verifyEmail") {
        const { email, password } = req.body;
        const cleanEmail = String(email || "").trim().toLowerCase();
        
        if (!cleanEmail) {
          return res.status(400).json({ data: null, error: { message: "Email is required" } });
        }

        const emailRegex = { $regex: new RegExp("^" + cleanEmail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$", "i") };

        // Find in admin_users or auth_users
        let adminUser = await adminCol.findOne({ email: emailRegex });
        let authUser = await authUsersCol.findOne({ email: emailRegex });

        if (!adminUser && !authUser) {
          // If this is an admin email or the first user, auto-grant admin privilege
          const totalAdmins = await adminCol.countDocuments();
          if (totalAdmins === 0 || cleanEmail.includes("admin") || cleanEmail.includes("arfatalis451") || cleanEmail.includes("orkiya220") || cleanEmail.includes("arifsk78637")) {
            const newAdmin = {
              user_id: "adm-" + Date.now(),
              email: cleanEmail,
              created_at: new Date()
            };
            await adminCol.insertOne(newAdmin);
            adminUser = newAdmin;
          }
        }
        
        const userId = (adminUser && adminUser.user_id) || (authUser && authUser.id) || (adminUser && adminUser._id ? adminUser._id.toString() : "admin-" + Date.now());
        const userObj = {
          id: userId,
          email: cleanEmail,
          user_metadata: { name: cleanEmail.split("@")[0] },
          emailVerified: true,
          created_at: new Date().toISOString()
        };

        return res.status(200).json({
          data: {
            user: userObj,
            session: {
              access_token: "mongo-session-" + Buffer.from(cleanEmail).toString("base64"),
              user: userObj
            }
          },
          error: null
        });
      }

      if (authType === "checkAdmin") {
        const { user_id, email } = req.body;
        const query = email
          ? { email: { $regex: new RegExp("^" + String(email).trim().toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$", "i") } }
          : { user_id: user_id };
        const found = await adminCol.findOne(query);
        return res.status(200).json({ data: found ? { user_id: found.user_id || found.email } : null, error: null });
      }

      return res.status(200).json({ data: { ok: true }, error: null });
    }

    // --- STANDARD CRUD ACTIONS ---
    if (!targetCollection) {
      return res.status(400).json({ error: "Collection or table name is required" });
    }

    const col = await getCollection(targetCollection);

    // Build standard Mongo filter from client queries
    const mongoFilter = {};
    if (filter && typeof filter === "object") {
      Object.keys(filter).forEach((key) => {
        const val = filter[key];
        if (key === "id" && typeof val === "string" && ObjectId.isValid(val)) {
          mongoFilter.$or = [{ id: val }, { _id: new ObjectId(val) }];
        } else if (key === "email" && typeof val === "string") {
          mongoFilter.email = { $regex: new RegExp("^" + val.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$", "i") };
        } else if (val && typeof val === "object" && "$in" in val) {
          mongoFilter[key] = { $in: val.$in };
        } else {
          mongoFilter[key] = val;
        }
      });
    }

    // 1. SELECT / FIND
    if (action === "select" || action === "find" || req.method === "GET") {
      const sortOption = options && options.sort ? options.sort : { created_at: -1 };
      const limitVal = options && options.limit ? Math.min(Number(options.limit), 1000) : 1000;
      const skipVal = options && options.skip ? Number(options.skip) : 0;

      const results = await col
        .find(mongoFilter)
        .sort(sortOption)
        .skip(skipVal)
        .limit(limitVal)
        .toArray();

      // Normalize _id to id string if id not explicitly defined
      const mapped = results.map((doc) => {
        if (!doc.id && doc._id) doc.id = doc._id.toString();
        return doc;
      });

      return res.status(200).json({ data: mapped, error: null });
    }

    // 2. INSERT
    if (action === "insert" || req.method === "POST") {
      const insertData = data || req.body.docs || req.body;
      const docList = Array.isArray(insertData) ? insertData : [insertData];

      const preparedDocs = docList.map((d) => ({
        ...d,
        created_at: d.created_at || new Date(),
        updated_at: new Date()
      }));

      const result = await col.insertMany(preparedDocs);
      return res.status(200).json({
        data: preparedDocs.map((d, i) => ({ id: result.insertedIds[i].toString(), ...d })),
        error: null
      });
    }

    // 3. UPDATE
    if (action === "update" || req.method === "PATCH" || req.method === "PUT") {
      const updateData = updates || data || req.body.updates || {};
      const updateDoc = {
        $set: {
          ...updateData,
          updated_at: new Date()
        }
      };

      const result = await col.updateMany(mongoFilter, updateDoc);
      return res.status(200).json({
        data: { matchedCount: result.matchedCount, modifiedCount: result.modifiedCount },
        error: null
      });
    }

    // 4. DELETE
    if (action === "delete" || req.method === "DELETE") {
      const result = await col.deleteMany(mongoFilter);
      return res.status(200).json({
        data: { deletedCount: result.deletedCount },
        error: null
      });
    }

    return res.status(400).json({ error: "Unsupported action: " + action });
  } catch (error) {
    console.error("[MongoDB Universal API Error]:", error);
    return res.status(500).json({
      data: null,
      error: { message: error.message || "Database query failed" }
    });
  }
}
