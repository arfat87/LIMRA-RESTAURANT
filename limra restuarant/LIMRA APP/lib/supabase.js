import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vrjrxhgihjsabwlipklw.supabase.co';
const supabaseAnonKey = 'sb_publishable_jk081SDmnzO4DtbeZmZ3Kg_5N1dgzVJ';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Authentication wrappers
export async function signUpWithEmail(email, password, name) {
  const emailLower = email.toLowerCase().trim();
  const { data, error } = await supabase.auth.signUp({
    email: emailLower,
    password,
    options: {
      data: { name }
    }
  });
  if (error) throw error;
  
  const user = data.user;
  // Write profile to users table
  const { error: dbError } = await supabase
    .from('users')
    .insert([{
      uid: user.id,
      name,
      email: user.email,
      phone: '9876543210',
      created_at: new Date().toISOString()
    }]);
  if (dbError) console.error('Failed to create user profile in users table:', dbError.message);

  return { user: { name, email: user.email, phone: '9876543210' }, requireEmailVerification: false };
}

export async function signInWithEmail(email, password) {
  const emailLower = email.toLowerCase().trim();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: emailLower,
    password
  });
  if (error) throw error;
  
  const user = data.user;
  // Fetch user profile
  const { data: profile } = await supabase
    .from('users')
    .select('name, phone')
    .eq('uid', user.id)
    .single();
    
  let phone = '9876543210';
  let name = user.user_metadata?.name || user.email.split('@')[0];
  if (profile) {
    phone = profile.phone || phone;
    name = profile.name || name;
  }
  
  return { user: { name, email: user.email, phone } };
}

export async function signInWithGoogle() {
  const googleUser = { 
    name: 'Salim Arfat', 
    email: 'salim.arfat@gmail.com', 
    phone: '7384789886' 
  };
  
  const dummyEmail = 'salim.arfat@gmail.com';
  const dummyPassword = 'GoogleUserSecret123!';
  let authUser;

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: dummyEmail,
      password: dummyPassword
    });
    if (error) {
      if (error.message.includes('Invalid login credentials') || error.status === 400) {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: dummyEmail,
          password: dummyPassword,
          options: {
            data: { name: googleUser.name }
          }
        });
        if (signUpError) throw signUpError;
        authUser = signUpData.user;
      } else {
        throw error;
      }
    } else {
      authUser = data.user;
    }
  } catch (err) {
    console.error('Failed to establish Supabase Google session:', err.message);
  }

  const userId = authUser ? authUser.id : '73847898-86ac-4f01-9c8e-db81d6f1a8de';
  
  // Upsert Google user profile in users table
  const { error: dbError } = await supabase
    .from('users')
    .upsert([{
      uid: userId,
      name: googleUser.name,
      email: googleUser.email,
      phone: googleUser.phone,
      created_at: new Date().toISOString()
    }]);
  if (dbError) console.error('Failed to upsert Google user profile:', dbError.message);
  
  return { user: googleUser };
}

// Memory store for active mock OTPs (phone -> data)
const mockOtps = new Map();

export async function signInWithPhoneSendOtp(phone, name) {
  const phoneClean = phone.trim();
  if (!phoneClean || phoneClean.length < 10) {
    throw new Error('Please enter a valid 10-digit phone number');
  }
  
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  mockOtps.set(phoneClean, { otpCode, name, expiresAt: Date.now() + 5 * 60 * 1000 });
  
  console.log(`[SMS OTP SIMULATION] Phone: ${phoneClean}, Code: ${otpCode}`);
  return { success: true, mockCode: otpCode };
}

export async function verifyPhoneOtp(phone, code, name) {
  const phoneClean = phone.trim();
  const otpData = mockOtps.get(phoneClean);
  
  if (!otpData) {
    throw new Error('OTP has expired or was not requested. Please try again.');
  }
  
  if (otpData.expiresAt < Date.now()) {
    mockOtps.delete(phoneClean);
    throw new Error('OTP has expired. Please request a new one.');
  }
  
  if (otpData.otpCode !== code.trim()) {
    throw new Error('Invalid verification code. Please check and try again.');
  }
  
  mockOtps.delete(phoneClean);
  
  const userEmail = `${phoneClean}@limra.app`;
  const userPassword = `PhoneOTPSecretKey_${phoneClean}!`;
  let authUser;

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: userEmail,
      password: userPassword
    });
    if (error) {
      if (error.message.includes('Invalid login credentials') || error.status === 400) {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: userEmail,
          password: userPassword,
          options: {
            data: { name: name || 'Limra User' }
          }
        });
        if (signUpError) throw signUpError;
        authUser = signUpData.user;
      } else {
        throw error;
      }
    } else {
      authUser = data.user;
    }
  } catch (err) {
    console.error('Failed to establish Supabase Phone OTP session:', err.message);
  }

  const userId = authUser ? authUser.id : `phone_user_${phoneClean}`;
  const finalName = name || otpData.name || 'Limra User';

  const { error: dbError } = await supabase
    .from('users')
    .upsert([{
      uid: userId,
      name: finalName,
      email: userEmail,
      phone: phoneClean,
      created_at: new Date().toISOString()
    }]);
  if (dbError) console.error('Failed to save profile in users table:', dbError.message);

  return {
    user: {
      name: finalName,
      email: userEmail,
      phone: phoneClean
    }
  };
}

export async function signOutUser() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  return true;
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  
  const { data: profile } = await supabase
    .from('users')
    .select('name, phone')
    .eq('uid', user.id)
    .single();
    
  let phone = '9876543210';
  let name = user.user_metadata?.name || user.email.split('@')[0];
  if (profile) {
    phone = profile.phone || phone;
    name = profile.name || name;
  }
  
  return { name, email: user.email, phone };
}

// Database & RPC wrappers
export async function placeOrder({
  customerName,
  customerPhone,
  items,
  notes = '',
  latitude = null,
  longitude = null,
  orderType = 'delivery',
  tableNumber = null,
  txnRef = null
}) {
  const orderItems = items.map(item => ({
    menu_item_id: item.id,
    item_name: item.name,
    quantity: item.quantity,
    unit_price: item.price,
    line_total: item.price * item.quantity
  }));

  const orderData = {
    customer_name: customerName,
    customer_phone: customerPhone,
    notes,
    items: orderItems,
    latitude,
    longitude,
    order_type: orderType,
    table_number: tableNumber,
    txn_ref: txnRef || 'Cash on Delivery',
    status: 'pending',
    payment_status: 'unpaid',
    created_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('orders')
    .insert([orderData])
    .select()
    .single();
    
  if (error) throw error;
  return data;
}

export async function getCustomerOrders(phone) {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('customer_phone', phone)
    .order('created_at', { ascending: false });
    
  if (error) throw error;
  return normalizeOrders(data || []);
}

export async function fetchAllOrders() {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });
    
  if (error) throw error;
  return normalizeOrders(data || []);
}

export async function updateOrderStatus(orderId, newStatus) {
  const { error } = await supabase
    .from('orders')
    .update({ status: newStatus.toLowerCase() })
    .eq('id', orderId);
    
  if (error) throw error;
  return true;
}

export async function updateOrderPayment(orderId, {
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
  paymentStatus = 'paid'
}) {
  const { error } = await supabase
    .from('orders')
    .update({
      razorpay_order_id: razorpayOrderId || '',
      razorpay_payment_id: razorpayPaymentId || '',
      razorpay_signature: razorpaySignature || '',
      payment_status: paymentStatus,
      txn_ref: razorpayPaymentId || ''
    })
    .eq('id', orderId);
    
  if (error) throw error;
  return true;
}

export async function getCustomerAddresses(phone) {
  const { data, error } = await supabase
    .from('addresses')
    .select('*')
    .eq('customer_phone', phone);
    
  if (error) throw error;
  return data || [];
}

export async function addCustomerAddress({ customerPhone, label, addressText, latitude = null, longitude = null, isDefault = false }) {
  if (isDefault) {
    const { error: clearError } = await supabase
      .from('addresses')
      .update({ is_default: false })
      .eq('customer_phone', customerPhone);
    if (clearError) console.error('Failed to clear default addresses:', clearError.message);
  }

  const { error } = await supabase
    .from('addresses')
    .insert([{
      customer_phone: customerPhone,
      label,
      address_text: addressText,
      latitude,
      longitude,
      is_default: isDefault
    }]);
    
  if (error) throw error;
  return true;
}

export async function deleteCustomerAddress(id) {
  const { error } = await supabase
    .from('addresses')
    .delete()
    .eq('id', id);
    
  if (error) throw error;
  return true;
}

export async function setDefaultAddress(id, phone) {
  const { error: clearError } = await supabase
    .from('addresses')
    .update({ is_default: false })
    .eq('customer_phone', phone);
  if (clearError) throw clearError;

  const { error } = await supabase
    .from('addresses')
    .update({ is_default: true })
    .eq('id', id);
    
  if (error) throw error;
  return true;
}

export async function submitOrderReview({ orderId, customerPhone, ratingStars, foodRating = null, deliveryRating = null, packagingRating = null, comment = '' }) {
  const { error } = await supabase
    .from('reviews')
    .insert([{
      order_id: orderId,
      customer_phone: customerPhone,
      rating_stars: ratingStars,
      food_rating: foodRating,
      delivery_rating: deliveryRating,
      packaging_rating: packagingRating,
      comment,
      created_at: new Date().toISOString()
    }]);
    
  if (error) throw error;
  return true;
}

export async function getCustomerWallet(phone) {
  let { data: wallet, error: walletError } = await supabase
    .from('wallets')
    .select('balance')
    .eq('customer_phone', phone)
    .single();
    
  if (walletError && walletError.code === 'PGRST116') {
    const { data: newWallet, error: initError } = await supabase
      .from('wallets')
      .insert([{ customer_phone: phone, balance: 0.0 }])
      .select()
      .single();
    if (initError) throw initError;
    wallet = newWallet;
  } else if (walletError) {
    throw walletError;
  }
  
  const balance = wallet ? wallet.balance : 0.0;
  
  const { data: transactions, error: txError } = await supabase
    .from('wallet_transactions')
    .select('*')
    .eq('customer_phone', phone)
    .order('created_at', { ascending: false });
    
  if (txError) throw txError;
  
  return { balance, transactions: transactions || [] };
}

export async function transactWallet({ customerPhone, amount, txType, referenceId = '' }) {
  let { data: wallet } = await supabase
    .from('wallets')
    .select('balance')
    .eq('customer_phone', customerPhone)
    .single();
    
  const currentBalance = wallet ? wallet.balance : 0.0;
  const newBalance = currentBalance + amount;
  
  const { error: walletError } = await supabase
    .from('wallets')
    .upsert([{ customer_phone: customerPhone, balance: newBalance }]);
  if (walletError) throw walletError;

  const { error: txError } = await supabase
    .from('wallet_transactions')
    .insert([{
      customer_phone: customerPhone,
      amount,
      tx_type: txType,
      reference_id: referenceId,
      created_at: new Date().toISOString()
    }]);
  if (txError) throw txError;

  return true;
}

export async function getCustomerFavorites(phone) {
  const { data, error } = await supabase
    .from('favorites')
    .select('*')
    .eq('customer_phone', phone);
    
  if (error) throw error;
  return data || [];
}

export async function addCustomerFavorite(phone, menuItemId) {
  const { data: existing } = await supabase
    .from('favorites')
    .select('id')
    .eq('customer_phone', phone)
    .eq('menu_item_id', menuItemId);
    
  if (!existing || existing.length === 0) {
    const { error } = await supabase
      .from('favorites')
      .insert([{
        customer_phone: phone,
        menu_item_id: menuItemId
      }]);
    if (error) throw error;
  }
  return true;
}

export async function deleteCustomerFavorite(phone, menuItemId) {
  const { error } = await supabase
    .from('favorites')
    .delete()
    .eq('customer_phone', phone)
    .eq('menu_item_id', menuItemId);
    
  if (error) throw error;
  return true;
}

export async function createRazorpayOrder(amount, receipt = '') {
  return {
    order_id: `rzp_order_${Math.random().toString(36).substring(2, 11)}`,
    amount,
    currency: 'INR'
  };
}

export async function verifyRazorpayPayment(orderId, paymentId, signature) {
  return { success: true };
}

export async function simulateRazorpaySignature(orderId, paymentId) {
  return { signature: 'mock_signature_handshake' };
}

function normalizeOrders(dbOrders) {
  return dbOrders.map(order => {
    let statusLabel = 'Received';
    const statusLower = String(order.status).toLowerCase();
    if (statusLower === 'preparing') statusLabel = 'Preparing';
    else if (statusLower === 'ready' || statusLower === 'out') statusLabel = 'Out';
    else if (statusLower === 'delivered' || statusLower === 'completed') statusLabel = 'Completed';

    return {
      id: order.id,
      items: order.items.map(item => ({
        id: item.menu_item_id,
        name: item.item_name,
        quantity: item.quantity,
        price: item.unit_price
      })),
      total: order.items.reduce((sum, item) => sum + item.line_total, 0),
      type: order.order_type || 'delivery',
      table: order.table_number || null,
      status: statusLabel,
      paymentTx: order.txn_ref || 'Cash on Delivery',
      date: order.created_at ? new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A',
      phone: order.customer_phone || '',
      address: order.address_text || order.address || '',
      area: '',
      deliveryCharge: 0,
      notes: order.notes || ''
    };
  });
}
