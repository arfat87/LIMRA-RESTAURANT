/**
  * Dynamic, highly engaging, beautifully formatted Indian restaurant templates.
  * Implements rich emojis and structured layouts.
  */
export const TEMPLATES = {
  orderPlaced: (name, orderNum, total) => 
    `🛒 *LIMRA Restaurant - Order Placed!*\n\n` +
    `Hi *${name}*,\n\n` +
    `We have successfully received your order *#${orderNum}*! 🎉\n` +
    `• *Grand Total:* ₹${Number(total).toLocaleString('en-IN')}\n` +
    `• *Payment Status:* VERIFIED (UPI)\n\n` +
    `Our kitchen team is starting to prepare your delicious meal with care. 🍳 We will update you once your order is confirmed!`,
    
  orderConfirmed: (name, orderNum) => 
    `🍽️ *LIMRA Restaurant - Order Confirmed!*\n\n` +
    `Excellent news, *${name}*!\n\n` +
    `Your order *#${orderNum}* has been confirmed by SK Arif. 👨‍🍳 We are packing it up hot and fresh!`,
    
  orderCompleted: (name, orderNum) =>
    `🔥 *LIMRA Restaurant - Prepared & Ready!*\n\n` +
    `Hi *${name}*,\n\n` +
    `Your order *#${orderNum}* is completed and prepared. 📦 It's fresh off the tandoor and on its way to you!`,
    
  orderDelivered: (name, orderNum) =>
    `🛵 *LIMRA Restaurant - Order Delivered!*\n\n` +
    `Hi *${name}*,\n\n` +
    `Your order *#${orderNum}* has been successfully delivered! 🎉 We hope you enjoy every single bite. Thank you for choosing us! 🙏`,
    
  reviewRequest: (name) =>
    `⭐ *LIMRA Restaurant - We Value Your Feedback!*\n\n` +
    `Hi *${name}*,\n\n` +
    `We hope you loved your meal today! Would you take 30 seconds to support SK Arif and our local business? 📍 Write a review here:\n` +
    `👉 https://g.page/r/limra-restaurant/review\n\n` +
    `Show your review on your next visit to get *₹50 off* your bill! 🎁`,
    
  weeklyPromo: (name) =>
    `🍗 *Weekend Special Biryani Blast at LIMRA Restaurant!*\n\n` +
    `Hi *${name}*!\n\n` +
    `Thinking of a delicious weekend feast? SK Arif is preparing our legendary *LIMRA special Handi Mutton Biryani* tomorrow! 🔥 Made with tender meat, premium long-grain Basmati rice, and secret spices.\n\n` +
    `🎁 *Exclusive Offer:* Present this message tomorrow to get *10% OFF* your total bill or a free special Mango Lassi!\n\n` +
    `📅 *Visit Tomorrow:* 10 AM - 11 PM\n` +
    `📍 Egra, West Bengal\n` +
    `📞 Table Bookings / Orders: 097390 83418\n\n` +
    `We can't wait to serve you! 🙏`
};
