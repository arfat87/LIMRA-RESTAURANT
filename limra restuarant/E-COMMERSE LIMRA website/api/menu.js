import { getCollection } from "./lib/mongodb.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const menuCol = await getCollection("menu_items");

    // GET: Retrieve Menu Items
    if (req.method === "GET") {
      const { category, available } = req.query || {};
      const query = {};

      if (category) query.category = category;
      if (available !== undefined) query.available = available === "true";

      const items = await menuCol
        .find(query)
        .sort({ id: 1 })
        .toArray();

      return res.status(200).json({
        success: true,
        count: items.length,
        data: items
      });
    }

    // POST: Insert or Upsert Menu Item
    if (req.method === "POST") {
      const { id, name, price, category, emoji, image, available = true, description = "" } = req.body || {};

      if (!name || price === undefined) {
        return res.status(400).json({ error: "Name and price are required." });
      }

      const numId = Number(id) || Date.now();
      const itemDoc = {
        id: numId,
        name: String(name).trim(),
        price: Number(price),
        category: category || "general",
        emoji: emoji || "🍽️",
        image: image || "",
        available: Boolean(available),
        description: String(description || ""),
        updated_at: new Date()
      };

      await menuCol.updateOne(
        { id: numId },
        { $set: itemDoc },
        { upsert: true }
      );

      return res.status(200).json({
        success: true,
        data: itemDoc
      });
    }

    // PATCH: Toggle availability or update stock/price
    if (req.method === "PATCH") {
      const { id, available, price } = req.body || {};

      if (!id) {
        return res.status(400).json({ error: "Item id is required." });
      }

      const updateFields = { updated_at: new Date() };
      if (available !== undefined) updateFields.available = Boolean(available);
      if (price !== undefined) updateFields.price = Number(price);

      const result = await menuCol.updateOne(
        { id: Number(id) },
        { $set: updateFields }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({ error: "Menu item not found." });
      }

      return res.status(200).json({
        success: true,
        message: "Menu item updated successfully"
      });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("MongoDB Menu API Error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error"
    });
  }
}
