import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  FlatList, 
  ScrollView, 
  SafeAreaView, 
  Modal, 
  Alert,
  Linking,
  ActivityIndicator,
  Dimensions,
  Image,
  Platform,
  Clipboard
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import Svg, { Path } from 'react-native-svg';
import { 
  ShoppingBag, 
  Search, 
  QrCode, 
  Clock, 
  MapPin, 
  Plus, 
  Minus, 
  Trash2, 
  Check, 
  Smartphone,
  User,
  CreditCard,
  CheckCircle,
  X,
  Lock,
  Compass,
  ArrowRight,
  TrendingUp,
  Receipt
} from 'lucide-react-native';

// Import local menu database
import { menuItems, categoryTabOrder, categoryLabels, categoryEmojis } from './data/menu.js';
import { itemImages } from './data/imageMap.js';
import * as supabaseBackend from './lib/supabase.js';

const { width } = Dimensions.get('window');

const AREA_DELIVERY_CHARGES = {
  'jerthan': 20,
  'kudi': 40,
  'egra': 100,
  'qiya': 20,
  'alangiri': 40,
  'dobandhi': 50,
  'mohanpur': 80,
  'kasba gola': 80,
  'rajnagar': 100,
  'atla': 150,
  'boita': 50,
  'custom': 0
};

const AREA_LABELS = {
  'jerthan': 'Jerthan',
  'kudi': 'Kudi',
  'egra': 'Egra',
  'qiya': 'Qiya',
  'alangiri': 'Alangiri',
  'dobandhi': 'Dobandhi',
  'mohanpur': 'Mohanpur',
  'kasba gola': 'Kasba Gola',
  'rajnagar': 'Rajnagar',
  'atla': 'Atla',
  'boita': 'Boita',
  'custom': 'Other / Custom Location'
};

const isAdminEmail = (email) => {
  if (!email) return false;
  const normalized = email.toLowerCase().trim();
  return normalized === 'admin@limra.com' || normalized.endsWith('@limra.com') || normalized === 'salim@limra.com';
};

const showAlert = (title, message) => {
  if (Platform.OS === 'web') {
    alert(`${title}: ${message}`);
  } else {
    Alert.alert(title, message);
  }
};

export default function App() {
  // Navigation tabs: 'home', 'scanner', 'cart', 'orders', 'profile'
  const [activeTab, setActiveTab] = useState('home');

  // Premium features: onboarding, splash, theme, wallet, favorites, review, razorpay
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [showSplash, setShowSplash] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [onboardingIndex, setOnboardingIndex] = useState(0);
  const [customerFavorites, setCustomerFavorites] = useState([]);
  const [walletBalance, setWalletBalance] = useState(0);
  const [walletTransactions, setWalletTransactions] = useState([]);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [walletDepositAmount, setWalletDepositAmount] = useState('');
  
  // Real Razorpay integration modal states
  const [showRazorpayModal, setShowRazorpayModal] = useState(false);
  const [razorpayOrderId, setRazorpayOrderId] = useState('');
  const [razorpayPaymentId, setRazorpayPaymentId] = useState('');
  const [razorpaySignature, setRazorpaySignature] = useState('');
  const [razorpayCardNumber, setRazorpayCardNumber] = useState('');
  const [razorpayCardExpiry, setRazorpayCardExpiry] = useState('');
  const [razorpayCardCvv, setRazorpayCardCvv] = useState('');
  const [razorpayUpiId, setRazorpayUpiId] = useState('');
  const [razorpayPaymentMethod, setRazorpayPaymentMethod] = useState('card'); // 'card', 'upi', 'netbanking'
  const [isRazorpayProcessing, setIsRazorpayProcessing] = useState(false);
  const [pendingRazorpayOrder, setPendingRazorpayOrder] = useState(null);
  
  // Detailed feedback states
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewOrderId, setReviewOrderId] = useState('');
  const [ratingStars, setRatingStars] = useState(5);
  const [foodRating, setFoodRating] = useState(5);
  const [deliveryRating, setDeliveryRating] = useState(5);
  const [packagingRating, setPackagingRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');

  // Premium HSL-aligned color palette
  const colors = {
    primary: isDarkMode ? '#ff7f50' : '#ff6b35',
    secondary: isDarkMode ? '#007a8c' : '#004e64',
    accent: isDarkMode ? '#ffc300' : '#ffb703',
    background: isDarkMode ? '#0f172a' : '#faf9f6',
    surface: isDarkMode ? '#1e293b' : '#ffffff',
    textPrimary: isDarkMode ? '#f8fafc' : '#1e293b',
    textSecondary: isDarkMode ? '#94a3b8' : '#64748b',
    success: isDarkMode ? '#34d399' : '#10b981',
    error: isDarkMode ? '#f87171' : '#ef4444',
    border: isDarkMode ? '#334155' : '#e2e8f0',
  };
  
  // State variables
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [cart, setCart] = useState([]);
  const [tableNumber, setTableNumber] = useState(null);
  const [orderType, setOrderType] = useState('takeaway'); // 'takeaway', 'delivery', 'dinein'
  
  // Checkout Info
  const [phoneNumber, setPhoneNumber] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [gpsCoordinates, setGpsCoordinates] = useState(null);
  const [fetchingGps, setFetchingGps] = useState(false);
  const [cookingNote, setCookingNote] = useState('');
  const [selectedDeliveryArea, setSelectedDeliveryArea] = useState('');
  const [showAreaModal, setShowAreaModal] = useState(false);
  
  // Custom Menu & Addresses List State
  const [menuList, setMenuList] = useState(menuItems);
  const [savedAddresses, setSavedAddresses] = useState([
    { id: '1', label: 'Home', text: 'Egra, Purba Medinipur', isDefault: true }
  ]);
  const [adminTab, setAdminTab] = useState('orders'); // 'orders' or 'menu'
  
  // Add Address Input Form state
  const [newAddressLabel, setNewAddressLabel] = useState('');
  const [newAddressText, setNewAddressText] = useState('');
  const [newAddressDefault, setNewAddressDefault] = useState(false);
  
  // Add Menu Item Input Form state
  const [newDishName, setNewDishName] = useState('');
  const [newDishPrice, setNewDishPrice] = useState('');
  const [newDishCategory, setNewDishCategory] = useState('soup');
  const [newDishEmoji, setNewDishEmoji] = useState('🍛');

  // Modals Toggles
  const [selectedDish, setSelectedDish] = useState(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);

  // Phone OTP Flow states
  const [authTab, setAuthTab] = useState('google'); // 'google' | 'phone'
  const [otpPhone, setOtpPhone] = useState('');
  const [otpName, setOtpName] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);

  // Auto-populate active address from default saved address
  useEffect(() => {
    const def = savedAddresses.find(a => a.isDefault);
    if (def) {
      setDeliveryAddress(def.text);
    }
  }, [savedAddresses]);
  
  // Login / OTP Flow state
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'
  const [registeredUsers, setRegisteredUsers] = useState([
    { name: 'Admin Staff', email: 'admin@limra.com', phone: '9876543210', address: 'LIMRA Head Office', password: 'admin' },
    { name: 'Salim Arfat', email: 'salim@limra.com', phone: '7384789886', address: 'Egra, Purba Medinipur', password: 'password' }
  ]);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [socialLoginType, setSocialLoginType] = useState(null);
  const [loginPhone, setLoginPhone] = useState('');
  const [loginName, setLoginName] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [userProfile, setUserProfile] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    isLoggedIn: false
  });
  
  // Mock Payment state
  const [paymentType, setPaymentType] = useState('cod'); // 'cod', 'upi', 'card'
  const [upiApp, setUpiApp] = useState('gpay'); // 'gpay', 'phonepe', 'paytm'
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [isPaying, setIsPaying] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [lastTxId, setLastTxId] = useState('');
  const [upiTxRef, setUpiTxRef] = useState('');

  const copyToClipboard = (text) => {
    if (Platform.OS === 'web') {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text);
        showAlert('Copied', 'UPI Address copied to clipboard!');
      } else {
        showAlert('Error', 'Clipboard not available on this browser.');
      }
    } else {
      Clipboard.setString(text);
      showAlert('Copied', 'UPI Address copied to clipboard!');
    }
  };

  // Active Orders (Shared state synced between customers and staff dashboard)
  const [activeOrders, setActiveOrders] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Staff Admin view state
  const [isStaffMode, setIsStaffMode] = useState(false);
  const [passcodeInput, setPasscodeInput] = useState('');

  // Splash Screen Timeout
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  // Rehydrate backend session on mount
  useEffect(() => {
    async function rehydrateSession() {
      try {
        const user = await supabaseBackend.getCurrentUser();
        if (user) {
          setUserProfile({
            name: user.name || user.email.split('@')[0],
            phone: user.phone || '9876543210',
            email: user.email,
            address: '',
            isLoggedIn: true
          });
          setPhoneNumber(user.phone || '9876543210');
        }
      } catch (err) {
        console.log('No active session rehydrated:', err.message);
      }
    }
    rehydrateSession();
  }, []);

  // Sync customer wallet, addresses, and favorites
  const syncCustomerData = async () => {
    if (!userProfile.phone) return;
    try {
      const addresses = await supabaseBackend.getCustomerAddresses(userProfile.phone);
      if (addresses && Array.isArray(addresses)) {
        const mapped = addresses.map(addr => ({
          id: addr.id,
          label: addr.label,
          text: addr.address_text,
          isDefault: addr.is_default,
          latitude: addr.latitude,
          longitude: addr.longitude
        }));
        setSavedAddresses(mapped);
      }
    } catch (e) {
      console.log('Failed to fetch addresses:', e);
    }

    try {
      const wallet = await supabaseBackend.getCustomerWallet(userProfile.phone);
      setWalletBalance(Number(wallet.balance) || 0);
      setWalletTransactions(wallet.transactions || []);
    } catch (e) {
      console.log('Failed to fetch wallet:', e);
    }

    try {
      const favs = await supabaseBackend.getCustomerFavorites(userProfile.phone);
      if (favs && Array.isArray(favs)) {
        setCustomerFavorites(favs.map(f => f.menu_item_id));
      }
    } catch (e) {
      console.log('Failed to fetch favorites:', e);
    }
  };

  useEffect(() => {
    if (userProfile.isLoggedIn && userProfile.phone) {
      syncCustomerData();
    }
  }, [userProfile.isLoggedIn, userProfile.phone]);

  // Sync operations
  const syncCustomerOrders = async () => {
    if (!userProfile.phone) return;
    setIsSyncing(true);
    try {
      const dbOrders = await supabaseBackend.getCustomerOrders(userProfile.phone);
      setActiveOrders(dbOrders);
    } catch (error) {
      showAlert('Sync Failed', error.message || 'Could not fetch your orders.');
    } finally {
      setIsSyncing(false);
    }
  };

  const syncAdminOrders = async () => {
    setIsSyncing(true);
    try {
      const dbOrders = await supabaseBackend.fetchAllOrders();
      setActiveOrders(dbOrders);
    } catch (error) {
      showAlert('Sync Failed', error.message || 'Could not fetch active orders.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Auto-sync customer orders on login
  useEffect(() => {
    if (userProfile.isLoggedIn && userProfile.phone) {
      syncCustomerOrders();
    } else if (!userProfile.isLoggedIn) {
      setActiveOrders([]);
    }
  }, [userProfile.isLoggedIn, userProfile.phone]);

  // Auto-sync admin orders when entering Staff Mode
  useEffect(() => {
    if (isStaffMode) {
      syncAdminOrders();
    } else {
      if (userProfile.isLoggedIn && userProfile.phone) {
        syncCustomerOrders();
      } else {
        setActiveOrders([]);
      }
    }
  }, [isStaffMode]);
  
  // Camera permissions
  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    setSelectedCategory('all');
  }, []);

  // Sync GPS Coordinates
  const fetchCurrentLocation = async () => {
    try {
      setFetchingGps(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        showAlert('Permission Denied', 'GPS access is required for pinning delivery address.');
        setFetchingGps(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      setGpsCoordinates({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude
      });
      setDeliveryAddress(`GPS Pins: ${loc.coords.latitude.toFixed(5)}, ${loc.coords.longitude.toFixed(5)}`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      showAlert('Error', 'Unable to fetch current GPS coordinates.');
    } finally {
      setFetchingGps(false);
    }
  };

  // Cart operations
  const addToCart = (dish) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const existing = cart.find(item => item.id === dish.id);
    if (existing) {
      setCart(cart.map(item => item.id === dish.id ? { ...item, quantity: item.quantity + 1 } : item));
    } else {
      setCart([...cart, { ...dish, quantity: 1 }]);
    }
  };

  const removeFromCart = (dishId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const existing = cart.find(item => item.id === dishId);
    if (!existing) return;
    if (existing.quantity === 1) {
      setCart(cart.filter(item => item.id !== dishId));
    } else {
      setCart(cart.map(item => item.id === dishId ? { ...item, quantity: item.quantity - 1 } : item));
    }
  };

  const deleteFromCart = (dishId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setCart(cart.filter(item => item.id !== dishId));
  };

  // QR Barcode scan handler
  const handleBarcodeScanned = ({ data }) => {
    try {
      const url = new URL(data);
      const tableVal = url.searchParams.get('table') || url.searchParams.get('t');
      if (tableVal) {
        setTableNumber(parseInt(tableVal, 10));
        setOrderType('dinein');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showAlert('Table Synced', `Successfully locked to Dine-in Table ${tableVal}!`);
        setActiveTab('home');
      }
    } catch (e) {
      if (/^\d+$/.test(data)) {
        setTableNumber(parseInt(data, 10));
        setOrderType('dinein');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showAlert('Table Synced', `Locked to Table ${data}!`);
        setActiveTab('home');
      } else {
        showAlert('Invalid QR Code', 'Please scan a valid LIMRA table QR code.');
      }
    }
  };

  // Password Sign In & Registration handlers (Backend-integrated)
  const handlePasswordSignIn = async () => {
    if (!loginUsername.trim()) {
      showAlert('Error', 'Please enter your phone number or email.');
      return;
    }
    if (!loginPassword) {
      showAlert('Error', 'Please enter your password.');
      return;
    }

    setIsSyncing(true);
    try {
      const data = await supabaseBackend.signInWithEmail(loginUsername.trim(), loginPassword);
      setUserProfile({
        name: data.user.name || data.user.email.split('@')[0],
        phone: data.user.phone || '9876543210',
        email: data.user.email,
        address: '',
        isLoggedIn: true
      });
      setPhoneNumber(data.user.phone || '9876543210');
      setShowLoginModal(false);
      setLoginUsername('');
      setLoginPassword('');
      setSocialLoginType(null);
      await syncCustomerData();
      await syncCustomerOrders();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showAlert('Welcome Back', `Successfully signed in as ${data.user.email}!`);
    } catch (err) {
      showAlert('Sign In Failed', err.message || 'Incorrect email or password.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePasswordRegister = async () => {
    if (!loginName.trim()) {
      showAlert('Error', 'Please enter your name.');
      return;
    }
    if (!loginPhone.trim() || loginPhone.length < 10) {
      showAlert('Error', 'Please enter a valid 10-digit phone number.');
      return;
    }
    if (!loginEmail.trim() || !loginEmail.includes('@')) {
      showAlert('Error', 'Please enter a valid email.');
      return;
    }
    if (!loginPassword || loginPassword.length < 4) {
      showAlert('Error', 'Password must be at least 4 characters.');
      return;
    }

    setIsSyncing(true);
    try {
      const data = await supabaseBackend.signUpWithEmail(loginEmail.trim(), loginPassword, loginName.trim());
      if (data?.requireEmailVerification) {
        showAlert('Verification Emailed', 'Please check your email inbox to verify your account.');
      } else {
        setUserProfile({
          name: loginName,
          phone: loginPhone,
          email: loginEmail,
          address: '',
          isLoggedIn: true
        });
        setPhoneNumber(loginPhone);
        setShowLoginModal(false);
        setLoginName('');
        setLoginPhone('');
        setLoginEmail('');
        setLoginPassword('');
        setLoginUsername('');
        setSocialLoginType(null);
        await syncCustomerData();
        await syncCustomerOrders();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showAlert('Registration Success', `Successfully registered as ${loginName}!`);
      }
    } catch (err) {
      showAlert('Registration Failed', err.message || 'Could not complete registration.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSocialSignIn = async () => {
    setIsSyncing(true);
    try {
      const data = await supabaseBackend.signInWithGoogle();
      setUserProfile({
        name: data.user.name,
        phone: data.user.phone,
        email: data.user.email,
        address: '',
        isLoggedIn: true
      });
      setPhoneNumber(data.user.phone);
      setShowLoginModal(false);
      setSocialLoginType(null);
      await syncCustomerData();
      await syncCustomerOrders();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showAlert('Sign In Success', `Welcome to Limra, ${data.user.name}!`);
    } catch (err) {
      showAlert('Sign In Failed', err.message || 'Could not connect to Google.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSendOtp = async () => {
    const cleanPhone = otpPhone.trim();
    if (!cleanPhone || cleanPhone.length < 10) {
      showAlert('Validation Error', 'Please enter a valid 10-digit mobile number.');
      return;
    }
    setIsSyncing(true);
    try {
      const res = await supabaseBackend.signInWithPhoneSendOtp(cleanPhone, otpName.trim());
      if (res.success) {
        setIsOtpSent(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showAlert('OTP Sent', `Verification code sent! (Mock code for testing: ${res.mockCode})`);
      }
    } catch (err) {
      showAlert('Failed to Send OTP', err.message || 'Verification system offline.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleVerifyOtp = async () => {
    const cleanCode = otpCode.trim();
    if (!cleanCode || cleanCode.length < 4) {
      showAlert('Validation Error', 'Please enter the verification code.');
      return;
    }
    setIsSyncing(true);
    try {
      const res = await supabaseBackend.verifyPhoneOtp(otpPhone, cleanCode, otpName.trim());
      setUserProfile({
        name: res.user.name,
        phone: res.user.phone,
        email: res.user.email,
        address: '',
        isLoggedIn: true
      });
      setPhoneNumber(res.user.phone);
      setShowLoginModal(false);
      setAuthTab('google');
      setIsOtpSent(false);
      setOtpPhone('');
      setOtpName('');
      setOtpCode('');
      await syncCustomerData();
      await syncCustomerOrders();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showAlert('Sign In Success', `Welcome to Limra, ${res.user.name}!`);
    } catch (err) {
      showAlert('Verification Failed', err.message || 'Invalid code.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSignOut = async () => {
    setIsSyncing(true);
    try {
      await supabaseBackend.signOutUser();
      setUserProfile({ name: '', phone: '', email: '', address: '', isLoggedIn: false });
      setCart([]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showAlert('Signed Out', 'You have been successfully logged out.');
    } catch (err) {
      showAlert('Sign Out Failed', err.message || 'Could not complete sign out.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Profile Login Flow
  const triggerLoginSendOtp = () => {
    if (!loginEmail || !loginEmail.includes('@')) {
      showAlert('Email Required', 'Please enter a valid email address.');
      return;
    }

    if (authMode === 'register') {
      if (!loginName) {
        showAlert('Name Required', 'Please input your name.');
        return;
      }
      if (!loginPhone || loginPhone.length < 10) {
        showAlert('Invalid Number', 'Please enter a valid 10-digit mobile number.');
        return;
      }
      
      const userExists = registeredUsers.find(u => u.email.toLowerCase().trim() === loginEmail.toLowerCase().trim());
      if (userExists) {
        showAlert('Already Registered', 'This email is already registered. Switch to "Sign In" tab.');
        return;
      }
    } else {
      // Sign In mode
      const userExists = registeredUsers.find(u => u.email.toLowerCase().trim() === loginEmail.toLowerCase().trim());
      if (!userExists) {
        showAlert('Not Found', 'This email is not registered. Please sign up in the "Register" tab first.');
        return;
      }
    }

    const mockCode = Math.floor(1000 + Math.random() * 9000).toString();
    setOtpCode(mockCode);
    setIsOtpSent(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

    // Trigger real email sending via FormSubmit API
    fetch(`https://formsubmit.co/ajax/${loginEmail.trim()}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        name: "LIMRA Restaurant App",
        message: `Your verification code is: ${mockCode}. Enter this code in the app to log in.`,
        _subject: "LIMRA App OTP Verification"
      })
    })
    .then(res => res.json())
    .then(data => {
      console.log('[Email OTP] FormSubmit response:', data);
    })
    .catch(err => {
      console.warn('[Email OTP] FormSubmit failed to send:', err);
    });

    showAlert(
      'OTP Verification Code Sent', 
      `Your code is: ${mockCode}.\n\nWe sent a copy of this code to your email ${loginEmail}. If this is your first time using this email, please click the "Activate Form" link sent to your inbox to enable instant deliveries.`
    );
  };

  const verifyOtpCode = () => {
    if (otpInput === otpCode) {
      if (authMode === 'login') {
        const user = registeredUsers.find(u => u.email.toLowerCase().trim() === loginEmail.toLowerCase().trim());
        setUserProfile({
          name: user.name,
          phone: user.phone,
          email: user.email,
          address: user.address || '',
          isLoggedIn: true
        });
        setPhoneNumber(user.phone);
        if (user.address) setDeliveryAddress(user.address);
        showAlert('Welcome Back', `Logged in successfully as ${user.name}!`);
      } else {
        const newUser = {
          name: loginName,
          phone: loginPhone,
          email: loginEmail,
          address: deliveryAddress || ''
        };
        setRegisteredUsers([...registeredUsers, newUser]);
        setUserProfile({
          ...newUser,
          isLoggedIn: true
        });
        setPhoneNumber(loginPhone);
        showAlert('Registration Success', `Welcome to LIMRA, ${loginName}!`);
      }
      setIsOtpSent(false);
      setShowLoginModal(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      showAlert('Verification Failed', 'Incorrect OTP code. Please check and try again.');
    }
  };

  // Favorites toggle handler
  const handleToggleFavorite = async (menuItemId) => {
    if (!userProfile.phone) {
      showAlert('Login Required', 'Please log in to add items to your favorites.');
      return;
    }
    const isFav = customerFavorites.includes(menuItemId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      if (isFav) {
        await supabaseBackend.deleteCustomerFavorite(userProfile.phone, menuItemId);
        setCustomerFavorites(customerFavorites.filter(id => id !== menuItemId));
      } else {
        await supabaseBackend.addCustomerFavorite(userProfile.phone, menuItemId);
        setCustomerFavorites([...customerFavorites, menuItemId]);
      }
    } catch (e) {
      showAlert('Error', 'Failed to update favorites in database.');
    }
  };

  // Wallet deposits handler
  const handleWalletDeposit = async () => {
    if (!userProfile.phone) {
      showAlert('Login Required', 'Please log in to use the wallet.');
      return;
    }
    const amt = parseFloat(walletDepositAmount);
    if (isNaN(amt) || amt <= 0) {
      showAlert('Invalid Amount', 'Please enter a valid deposit amount.');
      return;
    }

    setIsSyncing(true);
    try {
      await supabaseBackend.transactWallet({
        customerPhone: userProfile.phone,
        amount: amt,
        txType: 'deposit',
        referenceId: `DEP-${Math.floor(100000 + Math.random() * 900000)}`
      });
      setWalletDepositAmount('');
      await syncCustomerData();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showAlert('Deposit Successful', `₹${amt} has been successfully added to your wallet!`);
    } catch (err) {
      showAlert('Deposit Failed', err.message || 'Could not complete deposit.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Execute wallet checkout payment
  const executeWalletPayment = async () => {
    setIsSyncing(true);
    try {
      const txnRef = `WAL-${Math.floor(100000 + Math.random() * 900000)}`;
      
      // Deduct from wallet
      await supabaseBackend.transactWallet({
        customerPhone: userProfile.phone,
        amount: -grandTotal,
        txType: 'payment',
        referenceId: txnRef
      });
      
      // Place order
      await supabaseBackend.placeOrder({
        customerName: userProfile.name || 'Anonymous Customer',
        customerPhone: phoneNumber,
        items: cart,
        notes: cookingNote,
        latitude: gpsCoordinates ? gpsCoordinates.latitude : null,
        longitude: gpsCoordinates ? gpsCoordinates.longitude : null,
        orderType: orderType,
        tableNumber: tableNumber,
        txnRef: txnRef
      });

      setCart([]);
      setCookingNote('');
      await syncCustomerData();
      await syncCustomerOrders();
      setShowPaymentModal(false);
      setActiveTab('orders');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showAlert('Success', 'Order successfully placed using wallet balance!');
    } catch (err) {
      showAlert('Checkout Failed', err.message || 'Could not process wallet checkout.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Trigger Razorpay Checkout
  const triggerRazorpayCheckout = async () => {
    setIsSyncing(true);
    try {
      // 1. Create a pending order in the database first to obtain a database order reference UUID
      const pOrder = await supabaseBackend.placeOrder({
        customerName: userProfile.name || 'Anonymous Customer',
        customerPhone: phoneNumber,
        items: cart,
        notes: cookingNote,
        latitude: gpsCoordinates ? gpsCoordinates.latitude : null,
        longitude: gpsCoordinates ? gpsCoordinates.longitude : null,
        orderType: orderType,
        tableNumber: tableNumber,
        txnRef: 'Razorpay Pending'
      });

      // 2. Call Razorpay backend Edge Function to create a Razorpay Order
      const amountInPaise = grandTotal * 100;
      const razorpayOrder = await supabaseBackend.createRazorpayOrder(amountInPaise, pOrder.id);
      
      // 3. Store pending order details and open standard Razorpay Checkout Modal
      setPendingRazorpayOrder({
        dbOrderId: pOrder.id,
        amount: grandTotal,
        razorpayOrderId: razorpayOrder.order_id
      });
      setRazorpayOrderId(razorpayOrder.order_id);
      setRazorpayCardNumber('');
      setRazorpayCardExpiry('');
      setRazorpayCardCvv('');
      setRazorpayUpiId('');
      setRazorpayPaymentMethod('card');
      
      setShowPaymentModal(false);
      setShowRazorpayModal(true);
    } catch (err) {
      showAlert('Payment Failed', err.message || 'Could not initialize Razorpay checkout.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Handle simulated checkout submission and signature verification
  const handleExecuteRazorpayPayment = async () => {
    if (razorpayPaymentMethod === 'card') {
      if (!razorpayCardNumber || !razorpayCardExpiry || !razorpayCardCvv) {
        showAlert('Error', 'Please enter card details.');
        return;
      }
    } else if (razorpayPaymentMethod === 'upi') {
      if (!razorpayUpiId || !razorpayUpiId.includes('@')) {
        showAlert('Error', 'Please enter a valid UPI ID (e.g. name@upi).');
        return;
      }
    }

    setIsRazorpayProcessing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    setTimeout(async () => {
      try {
        const mockPaymentId = `pay_${Math.random().toString(36).substring(2, 15)}`;
        
        // 1. Securely calculate HMAC-SHA256 signature on backend
        const sigRes = await supabaseBackend.simulateRazorpaySignature(razorpayOrderId, mockPaymentId);
        const mockSignature = sigRes.signature;

        // 2. Verify signature on backend
        const verifyRes = await supabaseBackend.verifyRazorpayPayment(razorpayOrderId, mockPaymentId, mockSignature);
        
        if (verifyRes.success) {
          // 3. Patch order with token metadata and mark paid
          await supabaseBackend.updateOrderPayment(pendingRazorpayOrder.dbOrderId, {
            razorpayOrderId: razorpayOrderId,
            razorpayPaymentId: mockPaymentId,
            razorpaySignature: mockSignature,
            paymentStatus: 'paid'
          });

          setShowRazorpayModal(false);
          setCart([]);
          setCookingNote('');
          await syncCustomerOrders();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          showAlert('Payment Successful', 'Transaction approved! Your order has been placed successfully.');
          setActiveTab('orders');
        } else {
          showAlert('Verification Failed', 'Razorpay signature could not be verified.');
        }
      } catch (err) {
        showAlert('Payment Error', err.message || 'Could not verify payment.');
      } finally {
        setIsRazorpayProcessing(false);
      }
    }, 2000);
  };

  // Feedback Review Modal Handlers
  const handleOpenReview = (orderId) => {
    setReviewOrderId(orderId);
    setRatingStars(5);
    setFoodRating(5);
    setDeliveryRating(5);
    setPackagingRating(5);
    setReviewComment('');
    setShowReviewModal(true);
  };

  const handleSubmitReview = async () => {
    if (!userProfile.phone) return;
    setIsSyncing(true);
    try {
      await supabaseBackend.submitOrderReview({
        orderId: reviewOrderId,
        customerPhone: userProfile.phone,
        ratingStars,
        foodRating,
        deliveryRating,
        packagingRating,
        comment: reviewComment
      });
      setShowReviewModal(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      if (ratingStars === 5) {
        Alert.alert(
          'Thank You!',
          'Would you like to support us by sharing your feedback on Google as well?',
          [
            { text: 'Later', style: 'cancel' },
            { 
              text: 'Write Review', 
              onPress: () => Linking.openURL('https://g.page/r/Cdf17db77bc2df55/review') 
            }
          ]
        );
      } else {
        showAlert('Thank You', 'Your feedback has been successfully registered!');
      }
    } catch (e) {
      showAlert('Failed', 'Could not submit review. Please try again.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Checkout Payment Confirmation
  const startPaymentCheckout = () => {
    if (cart.length === 0) {
      showAlert('Empty Basket', 'Add items to checkout.');
      return;
    }
    if (orderType === 'dinein' && !tableNumber) {
      showAlert('Table Required', 'Scan a table QR on the scanner tab first.');
      return;
    }
    if (orderType !== 'dinein' && !phoneNumber) {
      showAlert('Details Required', 'Please enter a contact phone number.');
      return;
    }
    if (orderType === 'delivery' && !selectedDeliveryArea) {
      showAlert('Delivery Area Required', 'Please select a delivery area.');
      return;
    }

    if (paymentType === 'cod') {
      finalizeOrderPlacement(false);
    } else if (paymentType === 'wallet') {
      if (walletBalance < grandTotal) {
        showAlert('Insufficient Funds', 'Your wallet balance is insufficient. Please deposit funds or choose a different payment method.');
        return;
      }
      executeWalletPayment();
    } else {
      triggerRazorpayCheckout();
    }
  };

  const executeMockPayment = () => {
    if (paymentType === 'upi') {
      if (!upiTxRef.trim()) {
        showAlert('UTR Required', 'Please enter the 12-digit UPI transaction reference number (UTR) to confirm your payment.');
        return;
      }
      if (upiTxRef.trim().length !== 12 || isNaN(Number(upiTxRef.trim()))) {
        showAlert('Invalid UTR', 'Please enter a valid 12-digit numeric UPI transaction reference number.');
        return;
      }
      setIsPaying(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setTimeout(() => {
        setIsPaying(false);
        setPaymentSuccess(true);
        setLastTxId(upiTxRef.trim());
        setUpiTxRef(''); // Reset for next checkout
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }, 1500);
    } else {
      if (paymentType === 'card' && (!cardNumber || !cardExpiry || !cardCvv)) {
        showAlert('Card Details Incomplete', 'Fill in card fields to complete checkout.');
        return;
      }
      setIsPaying(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      setTimeout(() => {
        setIsPaying(false);
        setPaymentSuccess(true);
        const tx = `TXN-${Math.floor(100000 + Math.random() * 900000)}`;
        setLastTxId(tx);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }, 2000);
    }
  };

  const finalizeOrderPlacement = async (viaWhatsApp = false) => {
    const itemsSummary = cart.map(i => `${i.name} x${i.quantity} (₹${i.price * i.quantity})`).join('\n');
    const subtotal = cart.reduce((acc, i) => acc + (i.price * i.quantity), 0);
    const tax = Math.round(subtotal * 0.05);
    const packagingFee = orderType !== 'dinein' ? 15 : 0;
    const deliveryCharge = orderType === 'delivery' ? (AREA_DELIVERY_CHARGES[selectedDeliveryArea] || 0) : 0;
    const total = subtotal + tax + packagingFee + deliveryCharge;

    const txnRef = lastTxId || 'Cash on Delivery';

    setIsSyncing(true);
    try {
      await supabaseBackend.placeOrder({
        customerName: userProfile.name || 'Anonymous Customer',
        customerPhone: phoneNumber,
        items: cart,
        notes: cookingNote,
        latitude: gpsCoordinates ? gpsCoordinates.latitude : null,
        longitude: gpsCoordinates ? gpsCoordinates.longitude : null,
        orderType: orderType,
        tableNumber: tableNumber,
        txnRef: txnRef
      });
      // Refresh customer orders to reflect DB details
      if (phoneNumber) {
        const dbOrders = await supabaseBackend.getCustomerOrders(phoneNumber);
        setActiveOrders(dbOrders);
      }
      showAlert('Success', 'Order placed and synced with backend database successfully.');
    } catch (err) {
      console.warn('Failed to place order on backend database, falling back:', err);
      const fallbackOrder = {
        id: `LMR-${Math.floor(1000 + Math.random() * 9000)}`,
        items: [...cart],
        total,
        type: orderType,
        table: tableNumber,
        status: 'Received',
        paymentTx: txnRef,
        date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        phone: phoneNumber,
        address: deliveryAddress,
        area: selectedDeliveryArea,
        deliveryCharge,
        notes: cookingNote
      };
      setActiveOrders([fallbackOrder, ...activeOrders]);
      showAlert('Offline Checkout', 'Order registered locally. Database connection offline.');
    } finally {
      setIsSyncing(false);
    }

    if (viaWhatsApp) {
      const typeLabel = orderType === 'dinein' ? `Dine-In Table ${tableNumber}` : orderType === 'delivery' ? `Delivery` : 'Takeaway';
      const areaLabelStr = orderType === 'delivery' && selectedDeliveryArea ? `\n*Delivery Area:* ${AREA_LABELS[selectedDeliveryArea]} (₹${deliveryCharge})` : '';
      const text = `*New Order - LIMRA Restaurant*\n-------------------------\n*Type:* ${typeLabel}${areaLabelStr}\n*Phone:* ${phoneNumber || 'N/A'}\n*TxID:* ${txnRef}\n*Notes:* ${cookingNote || 'None'}\n\n*Items:*\n${itemsSummary}\n-------------------------\n*Subtotal:* ₹${subtotal}\n*Tax (GST):* ₹${tax}\n*Pack Charge:* ₹${packagingFee}${orderType === 'delivery' ? `\n*Delivery Charge:* ₹${deliveryCharge}` : ''}\n*Total amount:* ₹${total}\n\nThank you!`;
      const waUrl = `https://wa.me/917384789886?text=${encodeURIComponent(text)}`;
      Linking.openURL(waUrl);
    }

    setCart([]);
    setCookingNote('');
    setLastTxId('');
    setPaymentSuccess(false);
    setShowPaymentModal(false);
    setActiveTab('orders');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  // Staff order preparing management
  const updateOrderStatus = async (orderId, nextStatus) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsSyncing(true);
    try {
      await supabaseBackend.updateOrderStatus(orderId, nextStatus);
      setActiveOrders(prevOrders => 
        prevOrders.map(order => 
          order.id === orderId ? { ...order, status: nextStatus } : order
        )
      );
    } catch (err) {
      console.warn('Failed to update status on backend, updating locally:', err);
      setActiveOrders(prevOrders => 
        prevOrders.map(order => 
          order.id === orderId ? { ...order, status: nextStatus } : order
        )
      );
      showAlert('Offline Update', 'Could not sync status update with database. Saved locally.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAdminAuth = () => {
    if (passcodeInput === '1234') {
      setIsStaffMode(true);
      setShowAdminModal(false);
      setPasscodeInput('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showAlert('Access Granted', 'Entered Staff Order Manager view.');
    } else {
      showAlert('Access Denied', 'Invalid Admin passcode.');
    }
  };

  // Address management helpers
  const handleAddAddress = async () => {
    if (!newAddressLabel.trim() || !newAddressText.trim()) {
      showAlert('Error', 'Please fill in both label and address details.');
      return;
    }

    const label = newAddressLabel.trim();
    const text = newAddressText.trim();
    const isDefault = newAddressDefault || savedAddresses.length === 0;

    if (userProfile.isLoggedIn && userProfile.phone) {
      setIsSyncing(true);
      try {
        await supabaseBackend.addCustomerAddress({
          customerPhone: userProfile.phone,
          label: label,
          addressText: text,
          latitude: gpsCoordinates ? gpsCoordinates.latitude : null,
          longitude: gpsCoordinates ? gpsCoordinates.longitude : null,
          isDefault: isDefault
        });
        await syncCustomerData();
        setNewAddressLabel('');
        setNewAddressText('');
        setNewAddressDefault(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showAlert('Success', 'Address successfully saved to backend!');
      } catch (err) {
        showAlert('Save Failed', err.message || 'Could not save address to database.');
      } finally {
        setIsSyncing(false);
      }
    } else {
      const newAddr = {
        id: Math.random().toString(),
        label: label,
        text: text,
        isDefault: isDefault
      };

      let updated = [...savedAddresses];
      if (newAddr.isDefault) {
        updated = updated.map(a => ({ ...a, isDefault: false }));
      }
      updated.push(newAddr);

      setSavedAddresses(updated);
      setNewAddressLabel('');
      setNewAddressText('');
      setNewAddressDefault(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showAlert('Success', 'New address saved locally!');
    }
  };

  const handleDeleteAddress = async (id) => {
    if (userProfile.isLoggedIn && userProfile.phone && String(id).includes('-')) {
      setIsSyncing(true);
      try {
        await supabaseBackend.deleteCustomerAddress(id);
        await syncCustomerData();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch (err) {
        showAlert('Delete Failed', err.message || 'Could not delete address.');
      } finally {
        setIsSyncing(false);
      }
    } else {
      const toDelete = savedAddresses.find(a => a.id === id);
      let updated = savedAddresses.filter(a => a.id !== id);
      if (toDelete?.isDefault && updated.length > 0) {
        updated[0].isDefault = true;
      }
      setSavedAddresses(updated);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  const handleSetDefaultAddress = async (id) => {
    if (userProfile.isLoggedIn && userProfile.phone && String(id).includes('-')) {
      setIsSyncing(true);
      try {
        await supabaseBackend.setDefaultAddress(id, userProfile.phone);
        await syncCustomerData();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (err) {
        showAlert('Default Failed', err.message || 'Could not set default address.');
      } finally {
        setIsSyncing(false);
      }
    } else {
      const updated = savedAddresses.map(a => ({
        ...a,
        isDefault: a.id === id
      }));
      setSavedAddresses(updated);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  // Menu management helpers
  const handleToggleSoldOut = (id) => {
    const updated = menuList.map(item => 
      item.id === id ? { ...item, soldOut: !item.soldOut } : item
    );
    setMenuList(updated);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleRemoveMenuItem = (id) => {
    const updated = menuList.filter(item => item.id !== id);
    setMenuList(updated);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showAlert('Removed', 'Menu item removed successfully.');
  };

  const handleAddMenuItem = () => {
    if (!newDishName.trim() || !newDishPrice.trim()) {
      showAlert('Error', 'Please enter dish name and price.');
      return;
    }
    const priceNum = parseInt(newDishPrice.trim(), 10);
    if (isNaN(priceNum) || priceNum <= 0) {
      showAlert('Error', 'Please enter a valid price.');
      return;
    }

    const newDish = {
      id: Math.max(...menuList.map(d => d.id), 0) + 1,
      name: newDishName.trim(),
      price: priceNum,
      category: newDishCategory,
      emoji: newDishEmoji || '🍛',
      soldOut: false
    };

    setMenuList([newDish, ...menuList]);
    setNewDishName('');
    setNewDishPrice('');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showAlert('Success', `${newDish.name} added to menu!`);
  };

  // Category and search logic
  const filteredDishes = menuList.filter(item => {
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    const matchesSearch = !searchQuery || item.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Calculate pricing at component level to prevent ReferenceErrors in JSX rendering
  const subtotal = cart.reduce((acc, i) => acc + (i.price * i.quantity), 0);
  const tax = Math.round(subtotal * 0.05);
  const packagingFee = orderType !== 'dinein' ? 15 : 0;
  const deliveryCharge = orderType === 'delivery' ? (AREA_DELIVERY_CHARGES[selectedDeliveryArea] || 0) : 0;
  const grandTotal = subtotal + tax + packagingFee + deliveryCharge;

  if (showSplash) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 36, fontWeight: 'bold', color: colors.primary, letterSpacing: 1.5 }}>LIMRA APP</Text>
          <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 8, textTransform: 'uppercase', letterSpacing: 2 }}>Flavors of Trust & Quality</Text>
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 32 }} />
        </View>
      </SafeAreaView>
    );
  }

  if (showOnboarding) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          {onboardingIndex === 0 && (
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 72, marginBottom: 24 }}>🍲</Text>
              <Text style={{ fontSize: 26, fontWeight: 'bold', color: colors.textPrimary, textAlign: 'center', marginBottom: 12 }}>Flavors of Trust & Quality</Text>
              <Text style={{ fontSize: 15, color: colors.textSecondary, textAlign: 'center', lineHeight: 24, paddingHorizontal: 12 }}>Explore our premium menu items cooked with clean, fresh ingredients and crafted with absolute quality.</Text>
            </View>
          )}
          {onboardingIndex === 1 && (
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 72, marginBottom: 24 }}>🚚</Text>
              <Text style={{ fontSize: 26, fontWeight: 'bold', color: colors.textPrimary, textAlign: 'center', marginBottom: 12 }}>Lightning Fast Deliveries</Text>
              <Text style={{ fontSize: 15, color: colors.textSecondary, textAlign: 'center', lineHeight: 24, paddingHorizontal: 12 }}>Get hot, delicious dishes delivered straight to your door step in minutes, tracked in real-time.</Text>
            </View>
          )}
          {onboardingIndex === 2 && (
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 72, marginBottom: 24 }}>💳</Text>
              <Text style={{ fontSize: 26, fontWeight: 'bold', color: colors.textPrimary, textAlign: 'center', marginBottom: 12 }}>Secure Online Checkouts</Text>
              <Text style={{ fontSize: 15, color: colors.textSecondary, textAlign: 'center', lineHeight: 24, paddingHorizontal: 12 }}>Seamless integration with Razorpay checkout or convenient payments using your client wallet balance.</Text>
            </View>
          )}

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 48, marginBottom: 48 }}>
            {[0, 1, 2].map((idx) => (
              <View key={idx} style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: onboardingIndex === idx ? colors.primary : colors.border }} />
            ))}
          </View>

          <View style={{ width: '100%', gap: 14 }}>
            <TouchableOpacity 
              style={{ backgroundColor: colors.primary, width: '100%', paddingVertical: 16, borderRadius: 32, alignItems: 'center', shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }}
              onPress={() => {
                if (onboardingIndex < 2) {
                  setOnboardingIndex(onboardingIndex + 1);
                } else {
                  setShowOnboarding(false);
                }
              }}
            >
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>
                {onboardingIndex === 2 ? 'Get Started' : 'Next'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={{ width: '100%', paddingVertical: 12, alignItems: 'center' }}
              onPress={() => setShowOnboarding(false)}
            >
              <Text style={{ color: colors.textSecondary, fontSize: 14, fontWeight: '600' }}>Skip Onboarding</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style="light" />
      
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>LIMRA RESTUARANT</Text>
          <Text style={styles.headerSub}>Egra, Purba Medinipur — Native App</Text>
        </View>
        
        <View style={styles.headerRow}>
          {userProfile.isLoggedIn && (
            <TouchableOpacity 
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDarkMode ? '#2d3748' : '#e2e8f0', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, marginRight: 8, borderWidth: 1, borderColor: colors.border }} 
              onPress={() => setShowWalletModal(true)}
            >
              <CreditCard size={14} color={colors.primary} style={{ marginRight: 4 }} />
              <Text style={{ fontSize: 13, fontWeight: 'bold', color: colors.textPrimary }}>₹${walletBalance.toFixed(0)}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity 
            style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: isDarkMode ? '#2d3748' : '#e2e8f0', justifyContent: 'center', alignItems: 'center', marginRight: 8, borderWidth: 1, borderColor: colors.border }} 
            onPress={() => {
              setIsDarkMode(!isDarkMode);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <Text style={{ fontSize: 14 }}>{isDarkMode ? '🌙' : '☀️'}</Text>
          </TouchableOpacity>
          {isStaffMode && (
            <TouchableOpacity style={styles.adminStatusBadge} onPress={() => setIsStaffMode(false)}>
              <Text style={styles.adminStatusText}>Staff Mode ✕</Text>
            </TouchableOpacity>
          )}
          {tableNumber && (
            <View style={styles.tableBadge}>
              <Text style={styles.tableBadgeText}>Table {tableNumber}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Main Viewport */}
      <View style={styles.content}>
        
        {/* VIEW 1: STAFF ADMIN */}
        {isStaffMode ? (
          <ScrollView contentContainerStyle={styles.adminWrapper}>
            <View style={styles.adminHeaderBox}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.adminTitle}>Staff Dashboard</Text>
                  <Text style={styles.adminSub}>Manage kitchen preparation states and menu items</Text>
                </View>
                <TouchableOpacity 
                  style={[styles.syncBtn, isSyncing && styles.syncBtnDisabled]} 
                  onPress={syncAdminOrders}
                  disabled={isSyncing}
                >
                  {isSyncing ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.syncBtnText}>🔄 Sync</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Admin Tabs */}
            <View style={styles.adminTabsRow}>
              <TouchableOpacity 
                style={[styles.adminTab, adminTab === 'orders' && styles.adminTabActive]}
                onPress={() => setAdminTab('orders')}
              >
                <Text style={[styles.adminTabText, adminTab === 'orders' && styles.adminTabTextActive]}>
                  Orders Fulfill ({activeOrders.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.adminTab, adminTab === 'menu' && styles.adminTabActive]}
                onPress={() => setAdminTab('menu')}
              >
                <Text style={[styles.adminTabText, adminTab === 'menu' && styles.adminTabTextActive]}>
                  Menu Manager ({menuList.length})
                </Text>
              </TouchableOpacity>
            </View>

            {/* Tab 1: Orders Fulfill */}
            {adminTab === 'orders' && (
              <View>
                {activeOrders.length === 0 ? (
                  <View style={styles.emptyCenter}>
                    <Clock size={48} color="#4b5563" />
                    <Text style={styles.emptyText}>No active client orders currently.</Text>
                    <Text style={styles.emptySub}>When customers order, they will appear immediately.</Text>
                  </View>
                ) : (
                  activeOrders.map(order => (
                    <View key={order.id} style={styles.adminOrderCard}>
                      <View style={styles.adminCardHeader}>
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <Text style={styles.adminOrderId}>Order ID: {order.id}</Text>
                          <Text style={styles.adminOrderType}>
                            Type: {order.type} {order.table ? `(Table #${order.table})` : ''}
                          </Text>
                        </View>
                        <Text style={[styles.statusText, 
                          order.status === 'Completed' ? styles.statusGreen : 
                          order.status === 'Received' ? styles.statusRed : styles.statusAmber
                        ]}>{order.status}</Text>
                      </View>

                      <View style={styles.adminOrderContactRow}>
                        <Text style={styles.adminContactText}>📞 Phone: {order.phone || 'N/A'}</Text>
                        {order.paymentTx && <Text style={styles.adminContactText}>💳 TxID: {order.paymentTx}</Text>}
                      </View>

                      {order.type === 'delivery' && (
                        <View style={styles.adminDeliveryDetailsBox}>
                          <Text style={styles.adminAddrText}>📍 Area: {order.area ? AREA_LABELS[order.area] : 'Custom'} (₹{order.deliveryCharge || 0})</Text>
                          <Text style={styles.adminAddrText}>🏠 Addr: {order.address || 'No address specified'}</Text>
                        </View>
                      )}

                      {order.notes ? (
                        <View style={styles.adminNotesBox}>
                          <Text style={styles.adminNotesText}>📝 Note: "{order.notes}"</Text>
                        </View>
                      ) : null}

                      <View style={styles.divider} />
                      {order.items.map(item => (
                        <Text key={item.id} style={styles.adminItemText}>
                          • {item.name} x{item.quantity} (₹{item.price * item.quantity})
                        </Text>
                      ))}
                      <View style={styles.divider} />
                      <Text style={styles.adminOrderTotalText}>Total Paid: ₹{order.total}</Text>
                      <View style={styles.divider} />

                      {/* Actions buttons */}
                      <View style={styles.adminActions}>
                        <TouchableOpacity 
                          style={[styles.adminActBtn, order.status === 'Preparing' && styles.adminActBtnActive]}
                          onPress={() => updateOrderStatus(order.id, 'Preparing')}
                        >
                          <Text style={styles.adminActText}>🍳 Kitchen</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={[styles.adminActBtn, order.status === 'Out' && styles.adminActBtnActive]}
                          onPress={() => updateOrderStatus(order.id, 'Out')}
                        >
                          <Text style={styles.adminActText}>🚚 Dispatch</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={[styles.adminActBtn, order.status === 'Completed' && styles.adminActBtnActive]}
                          onPress={() => updateOrderStatus(order.id, 'Completed')}
                        >
                          <Text style={styles.adminActText}>✓ Finish</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}

            {/* Tab 2: Menu Manager */}
            {adminTab === 'menu' && (
              <View style={styles.adminMenuManagerBox}>
                
                {/* Add New Item Form */}
                <View style={styles.adminAddDishCard}>
                  <Text style={styles.adminFormTitle}>Add New Menu Dish</Text>
                  <View style={styles.adminFormRow}>
                    <TextInput
                      style={[styles.textInput, styles.adminFormInput, { flex: 2, marginLeft: 0 }]}
                      placeholder="Dish Name"
                      placeholderTextColor="#9ca3af"
                      value={newDishName}
                      onChangeText={setNewDishName}
                    />
                    <TextInput
                      style={[styles.textInput, styles.adminFormInput, { flex: 1, marginLeft: 8 }]}
                      placeholder="Price (₹)"
                      placeholderTextColor="#9ca3af"
                      keyboardType="number-pad"
                      value={newDishPrice}
                      onChangeText={setNewDishPrice}
                    />
                  </View>
                  <View style={styles.adminFormRow}>
                    <Text style={[styles.inputLabel, { marginVertical: 4 }]}>Category:</Text>
                  </View>
                  <View style={styles.adminFormRow}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                      {categoryTabOrder.map(cat => (
                        <TouchableOpacity
                          key={cat}
                          style={[
                            styles.categoryChip, 
                            newDishCategory === cat && styles.categoryChipActive,
                            { paddingHorizontal: 12, paddingVertical: 6, marginRight: 6 }
                          ]}
                          onPress={() => setNewDishCategory(cat)}
                        >
                          <Text style={[styles.categoryChipText, { fontSize: 11 }]}>
                            {categoryEmojis[cat]} {categoryLabels[cat]}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>

                  <View style={styles.adminFormRow}>
                    <TextInput
                      style={[styles.textInput, styles.adminFormInput, { flex: 1, marginLeft: 0 }]}
                      placeholder="Emoji (e.g. 🍛)"
                      placeholderTextColor="#9ca3af"
                      value={newDishEmoji}
                      onChangeText={setNewDishEmoji}
                    />
                    <TouchableOpacity style={[styles.modalAddBtn, { flex: 2, height: 42, paddingVertical: 0, marginLeft: 8 }]} onPress={handleAddMenuItem}>
                      <Text style={styles.modalAddBtnText}>Add Item</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Search & List of Menu items */}
                <Text style={styles.subSectionTitle}>Active Menu List</Text>
                
                {menuList.length === 0 ? (
                  <Text style={styles.emptyTextMuted}>No menu items found.</Text>
                ) : (
                  menuList.map(item => (
                    <View key={item.id} style={styles.adminMenuItemCard}>
                      <View style={styles.adminMenuItemMeta}>
                        <Text style={styles.adminMenuEmoji}>{item.emoji || '🍛'}</Text>
                        <View style={{ marginLeft: 10, flex: 1 }}>
                          <Text style={styles.adminMenuName}>{item.name}</Text>
                          <Text style={styles.adminMenuCat}>{categoryLabels[item.category]} • ₹{item.price}</Text>
                        </View>
                        {item.soldOut && (
                          <View style={styles.soldOutBadgeInline}>
                            <Text style={styles.soldOutBadgeTextInline}>Sold Out</Text>
                          </View>
                        )}
                      </View>

                      <View style={styles.adminMenuItemActions}>
                        <TouchableOpacity 
                          style={[
                            styles.adminActBtn, 
                            item.soldOut ? styles.adminActBtnActiveRed : styles.adminActBtnActive
                          ]}
                          onPress={() => handleToggleSoldOut(item.id)}
                        >
                          <Text style={styles.adminActText}>
                            {item.soldOut ? '⚡ Make In-Stock' : '❌ Mark Sold Out'}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={[styles.adminActBtn, styles.deleteAddrBtn, { flex: 0.3 }]}
                          onPress={() => handleRemoveMenuItem(item.id)}
                        >
                          <Trash2 size={16} color="#ef4444" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}
          </ScrollView>
        ) : (
          /* VIEW 2: STANDARD CUSTOMER views */
          <View style={[styles.flexOne, { backgroundColor: colors.background }]}>
            {!userProfile.isLoggedIn ? (
              <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
                <View style={{ width: '100%', maxWidth: 360, backgroundColor: colors.surface, padding: 32, borderRadius: 24, borderWidth: 1, borderColor: colors.border, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 4 }}>
                  <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: isDarkMode ? '#2d1b15' : '#ffeae3', justifyContent: 'center', alignItems: 'center', marginBottom: 24 }}>
                    <Lock size={36} color={colors.primary} />
                  </View>
                  <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.textPrimary, textAlign: 'center', marginBottom: 12 }}>Welcome to Limra App</Text>
                  <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 32 }}>Please log in or register your mobile number to view our premium food catalog and order online.</Text>
                  
                  <TouchableOpacity 
                    style={{ backgroundColor: colors.primary, width: '100%', paddingVertical: 14, borderRadius: 28, alignItems: 'center', shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 }}
                    onPress={() => { setShowLoginModal(true); setAuthMode('login'); }}
                  >
                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Sign In / Register</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            ) : (
              <View style={styles.flexOne}>
            
            {/* TAB: EXPLORE MENU */}
            {activeTab === 'home' && (
              <View style={styles.flexOne}>
                <View style={styles.searchContainer}>
                  <Search size={18} color="#9ca3af" />
                  <TextInput 
                    style={styles.searchInput}
                    placeholder="Search dishes..."
                    placeholderTextColor="#6b7280"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                </View>

                {/* Categories */}
                <View style={styles.categoriesWrapper}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
                    <TouchableOpacity 
                      style={[styles.categoryChip, selectedCategory === 'all' && styles.categoryChipActive]}
                      onPress={() => setSelectedCategory('all')}
                    >
                      <Text style={styles.categoryChipText}>All Menu</Text>
                    </TouchableOpacity>
                    {categoryTabOrder.map(cat => (
                      <TouchableOpacity 
                        key={cat}
                        style={[styles.categoryChip, selectedCategory === cat && styles.categoryChipActive]}
                        onPress={() => setSelectedCategory(cat)}
                      >
                        <Text style={styles.categoryChipText}>
                          {categoryEmojis[cat] || '🍛'} {categoryLabels[cat] || cat}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                {/* FlatList of items */}
                <FlatList 
                  data={filteredDishes}
                  keyExtractor={item => item.id.toString()}
                  contentContainerStyle={styles.foodList}
                  renderItem={({ item }) => {
                    const cartQty = cart.find(c => c.id === item.id)?.quantity || 0;
                    return (
                      <TouchableOpacity 
                        style={[styles.foodCard, item.soldOut && styles.foodCardSoldOut]} 
                        onPress={() => setSelectedDish(item)}
                      >
                        <View style={styles.foodCardLeft}>
                          {itemImages[item.id] ? (
                            <Image source={itemImages[item.id]} style={styles.foodImage} />
                          ) : (
                            <View style={styles.emojiContainer}>
                              <Text style={styles.foodEmoji}>{item.emoji || '🍛'}</Text>
                            </View>
                          )}
                          <View style={styles.foodMeta}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'space-between', width: '92%' }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Text style={styles.foodName}>{item.name}</Text>
                              </View>
                              {userProfile.isLoggedIn && (
                                <TouchableOpacity onPress={(e) => { e.stopPropagation(); handleToggleFavorite(item.id); }} style={{ padding: 4 }}>
                                  <Text style={{ fontSize: 16 }}>{customerFavorites.includes(item.id) ? '❤️' : '🤍'}</Text>
                                </TouchableOpacity>
                              )}
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              {item.soldOut && (
                                <View style={styles.soldOutBadgeInline}>
                                  <Text style={styles.soldOutBadgeTextInline}>Sold Out</Text>
                                </View>
                              )}
                            </View>
                            <Text style={styles.foodCategory}>{categoryLabels[item.category] || item.category}</Text>
                            <Text style={styles.foodPrice}>₹{item.price}</Text>
                          </View>
                        </View>
                        
                        {/* Qty action controls */}
                        <View style={styles.actionContainer}>
                          {item.soldOut ? (
                            <View style={[styles.addButton, { backgroundColor: '#374151' }]}>
                              <Text style={[styles.addButtonText, { color: '#9ca3af' }]}>Sold Out</Text>
                            </View>
                          ) : cartQty === 0 ? (
                            <TouchableOpacity style={styles.addButton} onPress={() => addToCart(item)}>
                              <Text style={styles.addButtonText}>+ Add</Text>
                            </TouchableOpacity>
                          ) : (
                            <View style={styles.qtySelector}>
                              <TouchableOpacity style={styles.qtyBtn} onPress={() => removeFromCart(item.id)}>
                                <Minus size={14} color="#f9fafb" />
                              </TouchableOpacity>
                              <Text style={styles.qtyText}>{cartQty}</Text>
                              <TouchableOpacity style={styles.qtyBtn} onPress={() => addToCart(item)}>
                                <Plus size={14} color="#f9fafb" />
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  }}
                />
              </View>
            )}

            {/* TAB: CAMERA SCANNER */}
            {activeTab === 'scanner' && (
              <View style={styles.scannerWrapper}>
                {!permission ? (
                  <View style={styles.centered}>
                    <ActivityIndicator size="large" color="#f59e0b" />
                  </View>
                ) : !permission.granted ? (
                  <View style={styles.centered}>
                    <Text style={styles.infoText}>Camera access required to scan table QR codes</Text>
                    <TouchableOpacity style={styles.actionButton} onPress={requestPermission}>
                      <Text style={styles.actionButtonText}>Grant Camera Permission</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.flexOne}>
                    <Text style={styles.scannerTitle}>Scan Table QR Code</Text>
                    <Text style={styles.scannerSub}>Self-order locks automatically to your table</Text>
                    <View style={styles.cameraBox}>
                      <CameraView
                        style={StyleSheet.absoluteFillObject}
                        onBarcodeScanned={handleBarcodeScanned}
                      />
                    </View>
                    {tableNumber && (
                      <TouchableOpacity style={styles.clearTableBtn} onPress={() => setTableNumber(null)}>
                        <Text style={styles.clearTableText}>Clear Connected Table ({tableNumber})</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* TAB: BASKET & CHECKOUT */}
            {activeTab === 'cart' && (
              <ScrollView contentContainerStyle={styles.cartWrapper}>
                <Text style={styles.sectionTitle}>Shopping Basket</Text>

                {cart.length === 0 ? (
                  <View style={styles.emptyCart}>
                    <ShoppingBag size={48} color="#4b5563" />
                    <Text style={styles.emptyCartText}>Your basket is currently empty.</Text>
                    <TouchableOpacity style={styles.actionButton} onPress={() => setActiveTab('home')}>
                      <Text style={styles.actionButtonText}>Browse Menu</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View>
                    {/* Cart list items */}
                    {cart.map(item => (
                      <View key={item.id} style={styles.cartItemCard}>
                        <Text style={styles.cartItemEmoji}>{item.emoji || '🍛'}</Text>
                        <View style={styles.cartItemMeta}>
                          <Text style={styles.cartItemName}>{item.name}</Text>
                          <Text style={styles.cartItemPrice}>₹{item.price * item.quantity} (₹{item.price} each)</Text>
                        </View>
                        <View style={styles.cartItemActions}>
                          <TouchableOpacity style={styles.cartQtyBtn} onPress={() => removeFromCart(item.id)}>
                            <Minus size={12} color="#f9fafb" />
                          </TouchableOpacity>
                          <Text style={styles.cartQtyVal}>{item.quantity}</Text>
                          <TouchableOpacity style={styles.cartQtyBtn} onPress={() => addToCart(item)}>
                            <Plus size={12} color="#f9fafb" />
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.cartTrashBtn} onPress={() => deleteFromCart(item.id)}>
                            <Trash2 size={16} color="#ef4444" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}

                    {/* Order Mode selectors */}
                    <Text style={styles.subSectionTitle}>Delivery / Dining Mode</Text>
                    <View style={styles.typeSelectorWrapper}>
                      <TouchableOpacity 
                        style={[styles.typeOption, orderType === 'takeaway' && styles.typeOptionActive]}
                        onPress={() => setOrderType('takeaway')}
                      >
                        <Clock size={16} color={orderType === 'takeaway' ? '#111827' : '#9ca3af'} />
                        <Text style={[styles.typeOptionText, orderType === 'takeaway' && styles.typeOptionTextActive]}>Takeaway</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.typeOption, orderType === 'delivery' && styles.typeOptionActive]}
                        onPress={() => setOrderType('delivery')}
                      >
                        <MapPin size={16} color={orderType === 'delivery' ? '#111827' : '#9ca3af'} />
                        <Text style={[styles.typeOptionText, orderType === 'delivery' && styles.typeOptionTextActive]}>Delivery</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.typeOption, orderType === 'dinein' && styles.typeOptionActive]}
                        onPress={() => {
                          if (!tableNumber) {
                            showAlert('Table Synced Required', 'Scan table QR code in scanner tab first.');
                          } else {
                            setOrderType('dinein');
                          }
                        }}
                      >
                        <QrCode size={16} color={orderType === 'dinein' ? '#111827' : '#9ca3af'} />
                        <Text style={[styles.typeOptionText, orderType === 'dinein' && styles.typeOptionTextActive]}>
                          Dine-In {tableNumber ? `(#${tableNumber})` : ''}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Details input form */}
                    {orderType !== 'dinein' && (
                      <View style={styles.inputSection}>
                        <Text style={styles.inputLabel}>Mobile Phone Number</Text>
                        <View style={styles.inputFieldWrapper}>
                          <Smartphone size={16} color="#9ca3af" />
                          <TextInput 
                            style={styles.textInput}
                            placeholder="Enter 10-digit number"
                            placeholderTextColor="#4b5563"
                            keyboardType="phone-pad"
                            value={phoneNumber}
                            onChangeText={setPhoneNumber}
                          />
                        </View>
                      </View>
                    )}

                    {orderType === 'delivery' && (
                      <>
                        <View style={styles.inputSection}>
                          <Text style={styles.inputLabel}>Select Delivery Area</Text>
                          <TouchableOpacity 
                            style={styles.areaPickerSelector} 
                            onPress={() => setShowAreaModal(true)}
                          >
                            <View style={styles.areaPickerInner}>
                              <Compass size={16} color="#f59e0b" style={{ marginRight: 8 }} />
                              <Text style={styles.areaPickerText}>
                                {selectedDeliveryArea ? AREA_LABELS[selectedDeliveryArea] : 'Select Delivery Area'}
                              </Text>
                            </View>
                            <ArrowRight size={16} color="#9ca3af" />
                          </TouchableOpacity>
                        </View>

                        {/* Quick Saved Addresses Selection */}
                        {savedAddresses.length > 0 && (
                          <View style={styles.inputSection}>
                            <Text style={styles.inputLabel}>Choose from Saved Addresses</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.savedAddrScroll}>
                              {savedAddresses.map(addr => (
                                <TouchableOpacity 
                                  key={addr.id}
                                  style={[
                                    styles.addrChip,
                                    deliveryAddress === addr.text && styles.addrChipActive
                                  ]}
                                  onPress={() => {
                                    setDeliveryAddress(addr.text);
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                  }}
                                >
                                  <MapPin size={12} color={deliveryAddress === addr.text ? '#111827' : '#f59e0b'} style={{ marginRight: 4 }} />
                                  <Text style={[
                                    styles.addrChipText,
                                    deliveryAddress === addr.text && styles.addrChipTextActive
                                  ]}>
                                    {addr.label}
                                  </Text>
                                </TouchableOpacity>
                              ))}
                            </ScrollView>
                          </View>
                        )}

                        <View style={styles.inputSection}>
                          <Text style={styles.inputLabel}>Pin Delivery Address (or coordinates)</Text>
                          <View style={styles.inputFieldWrapper}>
                            <MapPin size={16} color="#9ca3af" />
                            <TextInput 
                              style={[styles.textInput, styles.flexOne]}
                              placeholder="Enter address or fetch current coordinates"
                              placeholderTextColor="#4b5563"
                              value={deliveryAddress}
                              onChangeText={setDeliveryAddress}
                            />
                            <TouchableOpacity style={styles.gpsFetchBtn} onPress={fetchCurrentLocation} disabled={fetchingGps}>
                              {fetchingGps ? <ActivityIndicator size="small" color="#f59e0b" /> : <Text style={styles.gpsBtnText}>📍 GPS</Text>}
                            </TouchableOpacity>
                          </View>
                        </View>
                      </>
                    )}

                    <View style={styles.inputSection}>
                      <Text style={styles.inputLabel}>Cooking Requests (Spicy, salt, etc.)</Text>
                      <TextInput 
                        style={[styles.textInputMultiline]}
                        placeholder="e.g. Less spicy, make it hot, double cheese..."
                        placeholderTextColor="#4b5563"
                        multiline
                        numberOfLines={3}
                        value={cookingNote}
                        onChangeText={setCookingNote}
                      />
                    </View>

                    {/* Pricing summary */}
                    <View style={styles.pricingCard}>
                      <View style={styles.priceRow}>
                        <Text style={styles.priceLabel}>Items Subtotal</Text>
                        <Text style={styles.priceVal}>₹{subtotal}</Text>
                      </View>
                      <View style={styles.priceRow}>
                        <Text style={styles.priceLabel}>GST (5%)</Text>
                        <Text style={styles.priceVal}>₹{tax}</Text>
                      </View>
                      {orderType !== 'dinein' && (
                        <View style={styles.priceRow}>
                          <Text style={styles.priceLabel}>Packaging Fee</Text>
                          <Text style={styles.priceVal}>₹15</Text>
                        </View>
                      )}
                      {orderType === 'delivery' && (
                        <View style={styles.priceRow}>
                          <Text style={styles.priceLabel}>Delivery Charge</Text>
                          <Text style={styles.priceVal}>
                            {selectedDeliveryArea ? `₹${AREA_DELIVERY_CHARGES[selectedDeliveryArea]}` : 'Select Area'}
                          </Text>
                        </View>
                      )}
                      <View style={styles.divider} />
                      <View style={styles.priceRow}>
                        <Text style={styles.grandPriceLabel}>Grand Total</Text>
                        <Text style={styles.grandPriceVal}>₹{grandTotal}</Text>
                      </View>
                    </View>

                    {/* Checkout CTA */}
                    <TouchableOpacity style={styles.submitOrderBtn} onPress={startPaymentCheckout}>
                      <CreditCard size={18} color="#111827" />
                      <Text style={styles.submitOrderText}>Proceed to Payment (Checkout)</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </ScrollView>
            )}

            {/* TAB: ACTIVE ORDER FULFILLMENT PROGRESS TRACKER */}
            {activeTab === 'orders' && (
              <ScrollView contentContainerStyle={styles.ordersWrapper}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <Text style={styles.sectionTitle}>Active Order Tracker</Text>
                  {userProfile.isLoggedIn && (
                    <TouchableOpacity 
                      style={[styles.syncBtn, isSyncing && styles.syncBtnDisabled]} 
                      onPress={syncCustomerOrders}
                      disabled={isSyncing}
                    >
                      {isSyncing ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.syncBtnText}>🔄 Sync</Text>
                      )}
                    </TouchableOpacity>
                  )}
                </View>

                {activeOrders.length === 0 ? (
                  <View style={styles.emptyOrders}>
                    <Clock size={48} color="#4b5563" />
                    <Text style={styles.emptyCartText}>No orders placed yet.</Text>
                    <Text style={styles.emptySubText}>Add items to basket and pay to start tracking progress here.</Text>
                  </View>
                ) : (
                  activeOrders.map(order => (
                    <View key={order.id} style={styles.orderStatusCard}>
                      <View style={styles.orderHeader}>
                        <View>
                          <Text style={styles.orderIdText}>Order ID: {order.id}</Text>
                          <Text style={styles.orderTxText}>TxID: {order.paymentTx}</Text>
                        </View>
                        <Text style={styles.orderTimeText}>{order.date}</Text>
                      </View>
                      
                      {/* Interactive Step-by-step progress status */}
                      <View style={styles.trackerRow}>
                        <View style={[styles.trackerStep, styles.trackerStepDone]}>
                          <Text style={styles.stepNumText}>✓</Text>
                          <Text style={styles.stepLabelDone}>Placed</Text>
                        </View>
                        <View style={[styles.trackerLine, 
                          (order.status === 'Preparing' || order.status === 'Out' || order.status === 'Completed') && styles.trackerLineActive
                        ]} />
                        <View style={[styles.trackerStep, 
                          (order.status === 'Preparing' || order.status === 'Out' || order.status === 'Completed') && styles.trackerStepDone,
                          order.status === 'Preparing' && styles.trackerStepActive
                        ]}>
                          <Text style={styles.stepNumText}>
                            {order.status === 'Preparing' ? '2' : '✓'}
                          </Text>
                          <Text style={order.status === 'Preparing' ? styles.stepLabelActive : (order.status === 'Out' || order.status === 'Completed') ? styles.stepLabelDone : styles.stepLabelMuted}>
                            Prep
                          </Text>
                        </View>
                        <View style={[styles.trackerLine, 
                          (order.status === 'Out' || order.status === 'Completed') && styles.trackerLineActive
                        ]} />
                        <View style={[styles.trackerStep, 
                          (order.status === 'Out' || order.status === 'Completed') && styles.trackerStepDone,
                          order.status === 'Out' && styles.trackerStepActive
                        ]}>
                          <Text style={styles.stepNumText}>
                            {order.status === 'Out' ? '3' : order.status === 'Completed' ? '✓' : '3'}
                          </Text>
                          <Text style={order.status === 'Out' ? styles.stepLabelActive : order.status === 'Completed' ? styles.stepLabelDone : styles.stepLabelMuted}>
                            {order.type === 'delivery' ? 'Out' : 'Ready'}
                          </Text>
                        </View>
                        <View style={[styles.trackerLine, 
                          order.status === 'Completed' && styles.trackerLineActive
                        ]} />
                        <View style={[styles.trackerStep, 
                          order.status === 'Completed' && styles.trackerStepDone,
                          order.status === 'Completed' && styles.trackerStepActive
                        ]}>
                          <Text style={styles.stepNumText}>4</Text>
                          <Text style={order.status === 'Completed' ? styles.stepLabelActive : styles.stepLabelMuted}>Done</Text>
                        </View>
                      </View>

                      <View style={styles.divider} />
                      <Text style={styles.statusDescription}>
                        {order.status === 'Received' && '📦 Order submitted and waiting kitchen validation.'}
                        {order.status === 'Preparing' && '🍳 Kitchen cooks are preparing your fresh food.'}
                        {order.status === 'Out' && (order.type === 'delivery' ? '🛵 Rider has picked up and is out for delivery.' : '🥡 Your takeaway box is packed and ready for pickup!')}
                        {order.status === 'Completed' && '✓ Flipped completed. Enjoy your meal!'}
                      </Text>
                      <View style={styles.divider} />
                      
                      {order.items.map(item => (
                        <Text key={item.id} style={styles.orderItemText}>
                          • {item.name} x{item.quantity}
                        </Text>
                      ))}
                      <Text style={styles.orderTotalText}>Total Amount Paid: ₹{order.total}</Text>
                      {order.status === 'Completed' && (
                        <TouchableOpacity 
                          style={{ backgroundColor: colors.primary, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, alignItems: 'center', marginTop: 12 }}
                          onPress={() => handleOpenReview(order.id)}
                        >
                          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>⭐ Share Feedback / Review</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ))
                )}
              </ScrollView>
            )}

            {/* TAB: USER PROFILE / LOGIN & ADMIN ACCESS */}
            {activeTab === 'profile' && (
              <ScrollView contentContainerStyle={styles.profileWrapper}>
                <Text style={styles.sectionTitle}>My Profile</Text>

                {!userProfile.isLoggedIn ? (
                  <View style={styles.profileLoginCard}>
                    <User size={48} color="#f59e0b" style={styles.profileIcon} />
                    <Text style={styles.loginTitle}>Unlock Customer Profile</Text>
                    <Text style={styles.loginSub}>Save delivery addresses, view order histories, and unlock features.</Text>
                    <TouchableOpacity style={styles.loginBtn} onPress={() => setShowLoginModal(true)}>
                      <Text style={styles.loginBtnText}>Log In / Register</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View>
                    {/* Logged in card */}
                    <View style={styles.userCard}>
                      <View style={styles.userIconBox}>
                        <Text style={styles.userIconText}>{userProfile.name[0]}</Text>
                      </View>
                      <View style={styles.userMeta}>
                        <Text style={styles.userName}>{userProfile.name}</Text>
                        <Text style={styles.userPhone}>{userProfile.phone} • {userProfile.email}</Text>
                        {userProfile.address && <Text style={styles.userAddr}>📍 {userProfile.address}</Text>}
                      </View>
                    </View>

                    {/* Saved Addresses Section */}
                    <Text style={styles.subSectionTitle}>Saved Delivery Addresses</Text>
                    
                    <View style={styles.addressListContainer}>
                      {savedAddresses.length === 0 ? (
                        <Text style={styles.emptyTextMuted}>No saved addresses found. Add one below!</Text>
                      ) : (
                        savedAddresses.map(item => (
                          <View key={item.id} style={styles.addressCard}>
                            <View style={styles.addressMeta}>
                              <View style={styles.addressLabelRow}>
                                <Text style={styles.addressLabel}>{item.label}</Text>
                                {item.isDefault && (
                                  <View style={styles.defaultBadge}>
                                    <Text style={styles.defaultBadgeText}>Default</Text>
                                  </View>
                                )}
                              </View>
                              <Text style={styles.addressText}>{item.text}</Text>
                            </View>
                            
                            <View style={styles.addressActions}>
                              {!item.isDefault && (
                                <TouchableOpacity 
                                  style={styles.addrActionBtn} 
                                  onPress={() => handleSetDefaultAddress(item.id)}
                                >
                                  <Text style={styles.addrActionText}>Set Default</Text>
                                </TouchableOpacity>
                              )}
                              <TouchableOpacity 
                                style={[styles.addrActionBtn, styles.deleteAddrBtn]} 
                                onPress={() => handleDeleteAddress(item.id)}
                              >
                                <Trash2 size={14} color="#ef4444" />
                              </TouchableOpacity>
                            </View>
                          </View>
                        ))
                      )}
                    </View>

                    {/* Add Address Form */}
                    <View style={styles.addAddressForm}>
                      <Text style={styles.addAddressTitle}>Add New Address</Text>
                      <TextInput 
                        style={styles.addressFormInput}
                        placeholder="Label (e.g. Home, Work, Hostel)"
                        placeholderTextColor="#9ca3af"
                        value={newAddressLabel}
                        onChangeText={setNewAddressLabel}
                      />
                      <TextInput 
                        style={[styles.addressFormInput, { height: 60, textAlignVertical: 'top' }]}
                        placeholder="Complete Address details"
                        placeholderTextColor="#9ca3af"
                        multiline
                        value={newAddressText}
                        onChangeText={setNewAddressText}
                      />
                      <TouchableOpacity 
                        style={styles.checkboxRow} 
                        onPress={() => setNewAddressDefault(!newAddressDefault)}
                      >
                        <View style={[styles.checkbox, newAddressDefault && styles.checkboxChecked]}>
                          {newAddressDefault && <Check size={12} color="#111827" />}
                        </View>
                        <Text style={styles.checkboxLabel}>Set as Default Address</Text>
                      </TouchableOpacity>

                      <TouchableOpacity style={styles.saveAddressBtn} onPress={handleAddAddress}>
                        <Text style={styles.saveAddressBtnText}>Save Address</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Order History receipt lists */}
                    <Text style={styles.subSectionTitle}>Previous Order Receipts</Text>
                    {activeOrders.length === 0 ? (
                      <Text style={styles.emptyTextMuted}>No past receipts found on this device.</Text>
                    ) : (
                      activeOrders.map(receipt => (
                        <View key={receipt.id} style={styles.receiptCard}>
                          <Receipt size={16} color="#f59e0b" />
                          <View style={styles.receiptMeta}>
                            <Text style={styles.receiptTitle}>Receipt {receipt.id}</Text>
                            <Text style={styles.receiptSub}>Paid: ₹{receipt.total} ({receipt.date})</Text>
                          </View>
                        </View>
                      ))
                    )}

                    {/* Gateway to Staff Admin view - ONLY visible to logged-in users with admin emails */}
                    {isAdminEmail(userProfile.email) && (
                      <View style={styles.adminGatewayBox}>
                        <Lock size={18} color="#4b5563" />
                        <Text style={styles.gatewayText}>Staff / Admin Doorway</Text>
                        <TouchableOpacity style={styles.gatewayBtn} onPress={() => setShowAdminModal(true)}>
                          <Text style={styles.gatewayBtnText}>Unlock Admin View</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    <TouchableOpacity 
                      style={styles.logoutBtn} 
                      onPress={handleSignOut}
                    >
                      <Text style={styles.logoutBtnText}>Log Out Account</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </ScrollView>
            )}
              </View>
            )}
          </View>
        )}

      </View>

      {/* Nav Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'home' && styles.tabButtonActive]} 
          onPress={() => {
            setIsStaffMode(false);
            setActiveTab('home');
          }}
        >
          <ShoppingBag size={20} color={activeTab === 'home' && !isStaffMode ? '#f59e0b' : '#9ca3af'} />
          <Text style={[styles.tabLabel, activeTab === 'home' && !isStaffMode && styles.tabLabelActive]}>Explore Menu</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'scanner' && styles.tabButtonActive]} 
          onPress={() => {
            setIsStaffMode(false);
            setActiveTab('scanner');
          }}
        >
          <QrCode size={20} color={activeTab === 'scanner' && !isStaffMode ? '#f59e0b' : '#9ca3af'} />
          <Text style={[styles.tabLabel, activeTab === 'scanner' && !isStaffMode && styles.tabLabelActive]}>Scan Table</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'cart' && styles.tabButtonActive]} 
          onPress={() => {
            setIsStaffMode(false);
            setActiveTab('cart');
          }}
        >
          <View>
            <ShoppingBag size={20} color={activeTab === 'cart' && !isStaffMode ? '#f59e0b' : '#9ca3af'} />
            {cart.length > 0 && (
              <View style={styles.cartBadgeCount}>
                <Text style={styles.cartBadgeCountText}>{cart.length}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.tabLabel, activeTab === 'cart' && !isStaffMode && styles.tabLabelActive]}>Cart Basket</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'orders' && styles.tabButtonActive]} 
          onPress={() => {
            setIsStaffMode(false);
            setActiveTab('orders');
          }}
        >
          <Clock size={20} color={activeTab === 'orders' && !isStaffMode ? '#f59e0b' : '#9ca3af'} />
          <Text style={[styles.tabLabel, activeTab === 'orders' && !isStaffMode && styles.tabLabelActive]}>Order Tracker</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tabButton, (activeTab === 'profile' || isStaffMode) && styles.tabButtonActive]} 
          onPress={() => setActiveTab('profile')}
        >
          <User size={20} color={activeTab === 'profile' || isStaffMode ? '#f59e0b' : '#9ca3af'} />
          <Text style={[styles.tabLabel, (activeTab === 'profile' || isStaffMode) && styles.tabLabelActive]}>My Profile</Text>
        </TouchableOpacity>
      </View>

      {/* MODAL 1: GOOGLE & OTP SIGN-IN MODAL */}
      <Modal 
        animationType="fade" 
        transparent={true} 
        visible={showLoginModal} 
        onRequestClose={() => { setShowLoginModal(false); setIsOtpSent(false); }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.googleLoginCard, { backgroundColor: isDarkMode ? '#1e293b' : '#ffffff', borderColor: isDarkMode ? '#334155' : '#dadce0' }]}>
            {/* Close Button */}
            <TouchableOpacity 
              style={styles.googleCloseBtn} 
              onPress={() => { setShowLoginModal(false); setIsOtpSent(false); }}
            >
              <X size={20} color={isDarkMode ? '#94a3b8' : '#5f6368'} />
            </TouchableOpacity>

            {/* Auth Mode Tab Bar */}
            <View style={[styles.authTabRow, { borderBottomColor: isDarkMode ? '#334155' : '#dadce0', borderBottomWidth: 1, width: '100%', marginBottom: 20 }]}>
              <TouchableOpacity 
                style={[styles.authTabButton, authTab === 'google' && styles.authTabButtonActive, { borderBottomColor: authTab === 'google' ? '#1a73e8' : 'transparent' }]}
                onPress={() => { setAuthTab('google'); setIsOtpSent(false); }}
              >
                <Text style={[styles.authTabButtonText, { color: authTab === 'google' ? '#1a73e8' : (isDarkMode ? '#94a3b8' : '#5f6368') }]}>Google Login</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.authTabButton, authTab === 'phone' && styles.authTabButtonActive, { borderBottomColor: authTab === 'phone' ? '#1a73e8' : 'transparent' }]}
                onPress={() => setAuthTab('phone')}
              >
                <Text style={[styles.authTabButtonText, { color: authTab === 'phone' ? '#1a73e8' : (isDarkMode ? '#94a3b8' : '#5f6368') }]}>Phone & OTP</Text>
              </TouchableOpacity>
            </View>

            {authTab === 'google' ? (
              // Google Sign-In Tab
              <View style={{ width: '100%', alignItems: 'center' }}>
                {/* Google Logo */}
                <View style={styles.googleLogoContainer}>
                  <Svg width={40} height={40} viewBox="0 0 24 24">
                    <Path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <Path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <Path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <Path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </Svg>
                </View>

                {/* Sign-in Headers */}
                <Text style={[styles.googleTitle, { color: isDarkMode ? '#f8fafc' : '#202124' }]}>
                  Sign in
                </Text>
                <Text style={[styles.googleSubtitle, { color: isDarkMode ? '#94a3b8' : '#5f6368' }]}>
                  to continue to Limra Restaurant
                </Text>

                {/* User Account Info box / prompt */}
                <View style={[styles.googleAccountBox, { borderColor: isDarkMode ? '#334155' : '#e2e8f0', backgroundColor: isDarkMode ? '#0f172a' : '#f8f9fa' }]}>
                  <Text style={{ fontSize: 13, color: isDarkMode ? '#94a3b8' : '#5f6368', textAlign: 'center', lineHeight: 18 }}>
                    Securely sign in using your Google Account. There is no need to enter an email or password.
                  </Text>
                </View>

                {/* Google Sign-in Button */}
                <TouchableOpacity 
                  style={[styles.googleSignInBtn, { backgroundColor: isDarkMode ? '#334155' : '#ffffff', borderColor: isDarkMode ? '#475569' : '#dadce0' }]} 
                  onPress={handleSocialSignIn}
                >
                  <View style={styles.googleBtnIconWrapper}>
                    <Svg width={18} height={18} viewBox="0 0 24 24">
                      <Path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <Path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <Path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <Path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </Svg>
                  </View>
                  <Text style={[styles.googleBtnText, { color: isDarkMode ? '#f8fafc' : '#3c4043' }]}>
                    Sign in with Google
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              // Phone & OTP Sign-In/Register Tab
              <View style={{ width: '100%' }}>
                <Text style={[styles.googleTitle, { fontSize: 20, textAlign: 'left', marginBottom: 4, color: isDarkMode ? '#f8fafc' : '#202124' }]}>
                  {isOtpSent ? 'Verify code' : 'Register / Login'}
                </Text>
                <Text style={{ fontSize: 13, color: isDarkMode ? '#94a3b8' : '#5f6368', marginBottom: 20 }}>
                  {isOtpSent ? `We sent a 6-digit code to +91 ${otpPhone}` : 'Enter your mobile number to receive a one-time verification password.'}
                </Text>

                {!isOtpSent ? (
                  <>
                    <Text style={[styles.googleInputLabel, { color: isDarkMode ? '#cbd5e1' : '#cbd5e1' }]}>Full Name</Text>
                    <TextInput 
                      style={[styles.googleInput, { borderColor: isDarkMode ? '#475569' : '#dadce0', backgroundColor: isDarkMode ? '#1e293b' : '#ffffff', color: isDarkMode ? '#f8fafc' : '#202124' }]}
                      placeholder="e.g. Salim Arfat"
                      placeholderTextColor={isDarkMode ? '#64748b' : '#9ca3af'}
                      value={otpName}
                      onChangeText={setOtpName}
                    />

                    <Text style={[styles.googleInputLabel, { color: isDarkMode ? '#cbd5e1' : '#cbd5e1' }]}>Phone Number</Text>
                    <TextInput 
                      style={[styles.googleInput, { borderColor: isDarkMode ? '#475569' : '#dadce0', backgroundColor: isDarkMode ? '#1e293b' : '#ffffff', color: isDarkMode ? '#f8fafc' : '#202124' }]}
                      placeholder="10-digit mobile number"
                      placeholderTextColor={isDarkMode ? '#64748b' : '#9ca3af'}
                      keyboardType="phone-pad"
                      value={otpPhone}
                      onChangeText={setOtpPhone}
                    />

                    <TouchableOpacity 
                      style={styles.googlePrimaryBtn}
                      onPress={handleSendOtp}
                    >
                      <Text style={styles.googlePrimaryBtnText}>Send OTP</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <Text style={[styles.googleInputLabel, { color: isDarkMode ? '#cbd5e1' : '#cbd5e1' }]}>6-Digit Verification Code</Text>
                    <TextInput 
                      style={[styles.googleInput, { borderColor: isDarkMode ? '#475569' : '#dadce0', backgroundColor: isDarkMode ? '#1e293b' : '#ffffff', color: isDarkMode ? '#f8fafc' : '#202124', textAlign: 'center', fontSize: 18, letterSpacing: 4 }]}
                      placeholder="000000"
                      placeholderTextColor={isDarkMode ? '#64748b' : '#9ca3af'}
                      keyboardType="number-pad"
                      maxLength={6}
                      value={otpCode}
                      onChangeText={setOtpCode}
                    />

                    <TouchableOpacity 
                      style={styles.googlePrimaryBtn}
                      onPress={handleVerifyOtp}
                    >
                      <Text style={styles.googlePrimaryBtnText}>Verify & Sign In</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={{ marginTop: 16, alignItems: 'center' }}
                      onPress={() => { setIsOtpSent(false); setOtpCode(''); }}
                    >
                      <Text style={{ fontSize: 13, color: '#1a73e8', fontWeight: '500' }}>Change mobile number</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            )}

            {/* Footer */}
            <Text style={{ fontSize: 11, color: isDarkMode ? '#64748b' : '#757575', textAlign: 'center', marginTop: 30 }}>
              To proceed, Google or Limra will securely establish your active user profile session.
            </Text>
          </View>
        </View>
      </Modal>

      {/* MODAL 2: NATIVE PAYMENT CHECKOUT SHEET */}
      <Modal animationType="slide" transparent={true} visible={showPaymentModal} onRequestClose={() => setShowPaymentModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            
            {paymentSuccess ? (
              <View style={styles.paySuccessBox}>
                <CheckCircle size={64} color="#10b981" />
                <Text style={styles.paySuccessTitle}>Payment Approved!</Text>
                <Text style={styles.paySuccessSub}>Your order has been logged successfully.</Text>
                <View style={styles.txDetailCard}>
                  <Text style={styles.txDetailText}>TxID: {lastTxId}</Text>
                  <Text style={styles.txDetailText}>Paid Amount: ₹{grandTotal}</Text>
                </View>

                <TouchableOpacity style={styles.modalAddBtn} onPress={() => finalizeOrderPlacement(false)}>
                  <Text style={styles.modalAddBtnText}>Confirm Order (Kitchen)</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalCloseBtn, styles.waConfirmBtn]} onPress={() => finalizeOrderPlacement(true)}>
                  <Text style={styles.waConfirmText}>💬 Send via WhatsApp</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                <View style={styles.modalHeaderRow}>
                  <Text style={styles.modalTitle}>Secure Checkout Payment</Text>
                  <TouchableOpacity onPress={() => setShowPaymentModal(false)}>
                    <X size={20} color="#9ca3af" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.grandPriceTotalText}>Amount to Pay: ₹{grandTotal}</Text>

                {/* Method selector */}
                <View style={styles.payMethodTabs}>
                  <TouchableOpacity 
                    style={[styles.payMethodTab, paymentType === 'cod' && styles.payMethodTabActive]}
                    onPress={() => setPaymentType('cod')}
                  >
                    <Text style={[styles.payMethodTabText, paymentType === 'cod' && styles.payMethodTabTextActive]}>Cash on Delivery</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.payMethodTab, paymentType === 'upi' && styles.payMethodTabActive]}
                    onPress={() => setPaymentType('upi')}
                  >
                    <Text style={[styles.payMethodTabText, paymentType === 'upi' && styles.payMethodTabTextActive]}>UPI QR Code</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.payMethodTab, paymentType === 'card' && styles.payMethodTabActive]}
                    onPress={() => setPaymentType('card')}
                  >
                    <Text style={[styles.payMethodTabText, paymentType === 'card' && styles.payMethodTabTextActive]}>Card Payment</Text>
                  </TouchableOpacity>
                </View>

                {/* Cash on Delivery Panel */}
                {paymentType === 'cod' && (
                  <View style={styles.codPanelWrapper}>
                    <Text style={styles.codHelperText}>You have selected Cash on Delivery (COD). You will pay directly upon receiving your order.</Text>
                    
                    <TouchableOpacity style={styles.modalAddBtn} onPress={() => {
                      setLastTxId('Cash on Delivery');
                      finalizeOrderPlacement(false);
                    }}>
                      <Text style={styles.modalAddBtnText}>Confirm Order (Cash on Delivery)</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity style={[styles.modalCloseBtn, styles.waConfirmBtn, { marginTop: 8 }]} onPress={() => {
                      setLastTxId('Cash on Delivery');
                      finalizeOrderPlacement(true);
                    }}>
                      <Text style={styles.waConfirmText}>💬 Send via WhatsApp</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* UPI Panel */}
                {paymentType === 'upi' && (() => {
                  const payeeAddress = '7501299357@ybl';
                  const payeeName = 'LIMRA Restaurant';
                  const upiUri = `upi://pay?pa=${payeeAddress}&pn=${encodeURIComponent(payeeName)}&am=${grandTotal}&cu=INR&tn=LimraOrder`;
                  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(upiUri)}`;
                  
                  return (
                    <View style={styles.upiPanelWrapper}>
                      <Text style={styles.upiHelperText}>Scan QR Code with GPay, PhonePe, Paytm, or any UPI App:</Text>

                      <View style={styles.mockQrCodeContainer}>
                        <Image 
                          source={{ uri: qrCodeUrl }} 
                          style={styles.realQrImage} 
                          resizeMode="contain"
                        />
                        <Text style={styles.mockQrText}>Payable Amount: ₹{grandTotal}</Text>
                      </View>

                      <View style={styles.upiIdRow}>
                        <Text style={styles.upiIdText}>UPI ID: {payeeAddress}</Text>
                        <TouchableOpacity style={styles.copyBtn} onPress={() => copyToClipboard(payeeAddress)}>
                          <Text style={styles.copyBtnText}>📋 Copy</Text>
                        </TouchableOpacity>
                      </View>

                      {Platform.OS !== 'web' && (
                        <TouchableOpacity 
                          style={styles.openUpiBtn} 
                          onPress={() => {
                            Linking.openURL(upiUri).catch(err => {
                              showAlert('Error', 'No UPI app found on this device. Please scan the QR code instead.');
                            });
                          }}
                        >
                          <Text style={styles.openUpiBtnText}>📱 Open UPI App to Pay</Text>
                        </TouchableOpacity>
                      )}

                      <Text style={styles.inputLabel}>Enter UPI Transaction Ref / UTR No (12 Digits)</Text>
                      <TextInput 
                        style={[styles.textInput, styles.modalInput, { width: '100%', marginBottom: 12 }]}
                        placeholder="UTR Number (12 Digits)"
                        placeholderTextColor="#4b5563"
                        keyboardType="number-pad"
                        maxLength={12}
                        value={upiTxRef}
                        onChangeText={setUpiTxRef}
                      />
                    </View>
                  );
                })()}

                {/* Card Panel */}
                {paymentType === 'card' && (
                  <View style={styles.cardPanelWrapper}>
                    <Text style={styles.inputLabel}>Credit Card Number</Text>
                    <TextInput 
                      style={[styles.textInput, styles.modalInput]}
                      placeholder="0000 0000 0000 0000"
                      placeholderTextColor="#4b5563"
                      keyboardType="number-pad"
                      value={cardNumber}
                      onChangeText={setCardNumber}
                    />
                    <View style={styles.cardExpiryRow}>
                      <View style={styles.flexOne}>
                        <Text style={styles.inputLabel}>Expiry Date</Text>
                        <TextInput 
                          style={[styles.textInput, styles.modalInput]}
                          placeholder="MM/YY"
                          placeholderTextColor="#4b5563"
                          value={cardExpiry}
                          onChangeText={setCardExpiry}
                        />
                      </View>
                      <View style={styles.flexOne}>
                        <Text style={styles.inputLabel}>CVV</Text>
                        <TextInput 
                          style={[styles.textInput, styles.modalInput]}
                          placeholder="000"
                          placeholderTextColor="#4b5563"
                          keyboardType="number-pad"
                          secureTextEntry
                          maxLength={3}
                          value={cardCvv}
                          onChangeText={setCardCvv}
                        />
                      </View>
                    </View>
                  </View>
                )}

                {/* Pay Trigger */}
                {(paymentType === 'upi' || paymentType === 'card') && (
                  <TouchableOpacity style={styles.modalAddBtn} onPress={executeMockPayment} disabled={isPaying}>
                    {isPaying ? (
                      <ActivityIndicator size="small" color="#111827" />
                    ) : (
                      <Text style={styles.modalAddBtnText}>
                        {paymentType === 'upi' ? 'Confirm Payment (Verify UTR)' : `Authorize Card Payment (₹${grandTotal})`}
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* MODAL 3: STAFF AUTH GATEWAY */}
      <Modal animationType="slide" transparent={true} visible={showAdminModal} onRequestClose={() => setShowAdminModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Staff Security Entrance</Text>
              <TouchableOpacity onPress={() => setShowAdminModal(false)}>
                <X size={20} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            <Text style={styles.infoText}>Enter the passcode to launch the Kitchen Fulfillment console.</Text>
            <Text style={styles.inputLabel}>Admin / Staff Passcode</Text>
            <TextInput 
              style={[styles.textInput, styles.modalInput, styles.otpInputCenter]}
              placeholder="••••"
              placeholderTextColor="#4b5563"
              keyboardType="number-pad"
              secureTextEntry
              value={passcodeInput}
              onChangeText={setPasscodeInput}
            />

            <TouchableOpacity style={styles.modalAddBtn} onPress={handleAdminAuth}>
              <Text style={styles.modalAddBtnText}>Unlock Console</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL 4: DISH DETAIL SHEET */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={selectedDish !== null}
        onRequestClose={() => setSelectedDish(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedDish && (
              <View>
                {itemImages[selectedDish.id] ? (
                  <Image source={itemImages[selectedDish.id]} style={styles.modalImage} />
                ) : (
                  <Text style={styles.modalEmoji}>{selectedDish.emoji || '🍛'}</Text>
                )}
                <Text style={styles.modalName}>{selectedDish.name}</Text>
                <Text style={styles.modalCategory}>{categoryLabels[selectedDish.category] || selectedDish.category}</Text>
                <Text style={styles.modalPrice}>₹{selectedDish.price}</Text>
                <Text style={styles.modalDesc}>
                  Authentic dish prepared fresh using locally sourced premium ingredients and home ground spices.
                </Text>

                {selectedDish.soldOut ? (
                  <View style={[styles.modalAddBtn, { backgroundColor: '#374151' }]}>
                    <Text style={[styles.modalAddBtnText, { color: '#9ca3af' }]}>Sold Out</Text>
                  </View>
                ) : (
                  <TouchableOpacity 
                    style={styles.modalAddBtn}
                    onPress={() => {
                      addToCart(selectedDish);
                      setSelectedDish(null);
                    }}
                  >
                    <Text style={styles.modalAddBtnText}>Add to Basket — ₹{selectedDish.price}</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity 
                  style={styles.modalCloseBtn}
                  onPress={() => setSelectedDish(null)}
                >
                  <Text style={styles.modalCloseBtnText}>Go Back</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* MODAL 5: DELIVERY AREA SELECTION SHEET */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showAreaModal}
        onRequestClose={() => setShowAreaModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.areaModalContent]}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Choose Delivery Area</Text>
              <TouchableOpacity onPress={() => setShowAreaModal(false)}>
                <X size={20} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            <Text style={styles.infoText}>
              Select your local village/area. A custom charge will be applied automatically.
            </Text>

            <ScrollView style={styles.areaListScroll} contentContainerStyle={styles.areaListContent}>
              {Object.keys(AREA_LABELS).map(key => {
                const isSelected = selectedDeliveryArea === key;
                return (
                  <TouchableOpacity
                    key={key}
                    style={[
                      styles.areaItemRow,
                      isSelected && styles.areaItemRowActive
                    ]}
                    onPress={() => {
                      setSelectedDeliveryArea(key);
                      setShowAreaModal(false);
                      // Auto-populate address details
                      const label = AREA_LABELS[key];
                      if (key !== 'custom') {
                        setDeliveryAddress(prev => {
                          if (!prev) return label;
                          if (prev.includes(label)) return prev;
                          return `${prev}, ${label}`;
                        });
                      }
                    }}
                  >
                    <View style={styles.areaItemLeft}>
                      <Compass size={16} color={isSelected ? '#f59e0b' : '#9ca3af'} style={{ marginRight: 8 }} />
                      <Text style={[
                        styles.areaItemText,
                        isSelected && styles.areaItemTextActive
                      ]}>
                        {AREA_LABELS[key]}
                      </Text>
                    </View>
                    <View style={styles.areaItemRight}>
                      {isSelected && <Check size={16} color="#10b981" />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity 
              style={[styles.modalCloseBtn, { marginTop: 16 }]}
              onPress={() => setShowAreaModal(false)}
            >
              <Text style={styles.modalCloseBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL: WALLET PORTAL */}
      <Modal animationType="slide" transparent={true} visible={showWalletModal} onRequestClose={() => setShowWalletModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Client Wallet Ledger</Text>
              <TouchableOpacity onPress={() => setShowWalletModal(false)}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={{ backgroundColor: colors.background, padding: 20, borderRadius: 16, alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ fontSize: 13, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1 }}>Available Balance</Text>
              <Text style={{ fontSize: 32, fontWeight: 'bold', color: colors.primary, marginTop: 8 }}>₹{walletBalance.toFixed(2)}</Text>
            </View>

            <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>Add Funds (INR)</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
              <TextInput 
                style={[styles.textInput, { flex: 1, backgroundColor: colors.background, color: colors.textPrimary, borderColor: colors.border }]}
                placeholder="Amount (e.g. 500)"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
                value={walletDepositAmount}
                onChangeText={setWalletDepositAmount}
              />
              <TouchableOpacity style={[styles.modalAddBtn, { marginTop: 0, paddingHorizontal: 20, backgroundColor: colors.primary }]} onPress={handleWalletDeposit}>
                <Text style={styles.modalAddBtnText}>Deposit</Text>
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 12 }}>Transaction History</Text>
            <ScrollView style={{ maxHeight: 200 }}>
              {walletTransactions.length === 0 ? (
                <Text style={{ color: colors.textSecondary, textAlign: 'center', marginVertical: 20, fontSize: 13 }}>No transactions found</Text>
              ) : (
                walletTransactions.map((tx) => (
                  <View key={tx.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                    <View>
                      <Text style={{ fontWeight: '500', color: colors.textPrimary, textTransform: 'capitalize' }}>{tx.tx_type}</Text>
                      <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 4 }}>{tx.reference_id}</Text>
                    </View>
                    <Text style={{ fontWeight: 'bold', color: tx.amount > 0 ? colors.success : colors.error }}>
                      {tx.amount > 0 ? '+' : ''}₹{tx.amount}
                    </Text>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL: RAZORPAY STANDARD WEB CHECKOUT */}
      <Modal animationType="slide" transparent={true} visible={showRazorpayModal} onRequestClose={() => setShowRazorpayModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, padding: 24, maxWidth: 380 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 12 }}>
              <View>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#002f6c' }}>Razorpay Secure</Text>
                <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>Order ID: {razorpayOrderId}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowRazorpayModal(false)}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={{ backgroundColor: '#f4f6f9', padding: 16, borderRadius: 12, marginBottom: 20, alignItems: 'center' }}>
              <Text style={{ fontSize: 12, color: '#555' }}>PAYMENT AMOUNT</Text>
              <Text style={{ fontSize: 26, fontWeight: 'bold', color: '#1e293b', marginTop: 4 }}>₹{pendingRazorpayOrder?.amount.toFixed(2)}</Text>
            </View>

            {/* Payment Method Selector */}
            <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: 16 }}>
              {['card', 'upi'].map((method) => (
                <TouchableOpacity 
                  key={method} 
                  style={{ flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: razorpayPaymentMethod === method ? '#002f6c' : 'transparent' }}
                  onPress={() => setRazorpayPaymentMethod(method)}
                >
                  <Text style={{ fontWeight: '600', color: razorpayPaymentMethod === method ? '#002f6c' : colors.textSecondary, textTransform: 'uppercase', fontSize: 13 }}>{method}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {razorpayPaymentMethod === 'card' ? (
              <View style={{ gap: 12 }}>
                <View>
                  <Text style={{ fontSize: 12, fontWeight: '500', color: colors.textSecondary, marginBottom: 6 }}>Card Number</Text>
                  <TextInput 
                    style={[styles.textInput, { backgroundColor: colors.background, color: colors.textPrimary, borderColor: colors.border }]}
                    placeholder="4111 2222 3333 4444"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="numeric"
                    value={razorpayCardNumber}
                    onChangeText={setRazorpayCardNumber}
                  />
                </View>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, fontWeight: '500', color: colors.textSecondary, marginBottom: 6 }}>Expiry</Text>
                    <TextInput 
                      style={[styles.textInput, { backgroundColor: colors.background, color: colors.textPrimary, borderColor: colors.border }]}
                      placeholder="MM/YY"
                      placeholderTextColor={colors.textSecondary}
                      value={razorpayCardExpiry}
                      onChangeText={setRazorpayCardExpiry}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, fontWeight: '500', color: colors.textSecondary, marginBottom: 6 }}>CVV</Text>
                    <TextInput 
                      style={[styles.textInput, { backgroundColor: colors.background, color: colors.textPrimary, borderColor: colors.border }]}
                      placeholder="123"
                      placeholderTextColor={colors.textSecondary}
                      keyboardType="numeric"
                      secureTextEntry
                      value={razorpayCardCvv}
                      onChangeText={setRazorpayCardCvv}
                    />
                  </View>
                </View>
              </View>
            ) : (
              <View>
                <Text style={{ fontSize: 12, fontWeight: '500', color: colors.textSecondary, marginBottom: 6 }}>UPI ID</Text>
                <TextInput 
                  style={[styles.textInput, { backgroundColor: colors.background, color: colors.textPrimary, borderColor: colors.border }]}
                  placeholder="success@razorpay"
                  placeholderTextColor={colors.textSecondary}
                  value={razorpayUpiId}
                  onChangeText={setRazorpayUpiId}
                />
              </View>
            )}

            {isRazorpayProcessing ? (
              <View style={{ marginTop: 24, alignItems: 'center' }}>
                <ActivityIndicator size="small" color="#002f6c" />
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 8 }}>Securing checkout with server validation...</Text>
              </View>
            ) : (
              <TouchableOpacity 
                style={{ backgroundColor: '#002f6c', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 24 }}
                onPress={handleExecuteRazorpayPayment}
              >
                <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 15 }}>Pay Securely</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      {/* MODAL: POST-DELIVERY REVIEWS & FEEDBACK */}
      <Modal animationType="slide" transparent={true} visible={showReviewModal} onRequestClose={() => setShowReviewModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, padding: 24 }]}>
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Rate Your Experience</Text>
              <TouchableOpacity onPress={() => setShowReviewModal(false)}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={{ alignItems: 'center', marginVertical: 16 }}>
              <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 8 }}>OVERALL RATING</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity key={star} onPress={() => setRatingStars(star)}>
                    <Text style={{ fontSize: 32 }}>{ratingStars >= star ? '⭐' : '☆'}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={{ gap: 14, marginBottom: 20 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: colors.textPrimary, fontWeight: '500' }}>Taste & Food Quality</Text>
                <View style={{ flexDirection: 'row', gap: 4 }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <TouchableOpacity key={star} onPress={() => setFoodRating(star)}>
                      <Text style={{ fontSize: 18 }}>{foodRating >= star ? '⭐' : '☆'}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: colors.textPrimary, fontWeight: '500' }}>Delivery Service</Text>
                <View style={{ flexDirection: 'row', gap: 4 }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <TouchableOpacity key={star} onPress={() => setDeliveryRating(star)}>
                      <Text style={{ fontSize: 18 }}>{deliveryRating >= star ? '⭐' : '☆'}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: colors.textPrimary, fontWeight: '500' }}>Packaging & Safety</Text>
                <View style={{ flexDirection: 'row', gap: 4 }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <TouchableOpacity key={star} onPress={() => setPackagingRating(star)}>
                      <Text style={{ fontSize: 18 }}>{packagingRating >= star ? '⭐' : '☆'}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>Written Feedback (Optional)</Text>
            <TextInput 
              style={[styles.textInput, { backgroundColor: colors.background, color: colors.textPrimary, borderColor: colors.border, height: 80, textAlignVertical: 'top' }]}
              placeholder="Tell us what you liked or how we can improve..."
              placeholderTextColor={colors.textSecondary}
              multiline
              value={reviewComment}
              onChangeText={setReviewComment}
            />

            <TouchableOpacity style={[styles.modalAddBtn, { backgroundColor: colors.primary, marginTop: 20 }]} onPress={handleSubmitReview}>
              <Text style={styles.modalAddBtnText}>Submit Review</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F19', // Obsidian Premium Dark theme
  },
  googleLoginCard: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 8,
    borderWidth: 1,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  googleCloseBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 8,
    borderRadius: 20,
  },
  googleLogoContainer: {
    marginBottom: 16,
    alignItems: 'center',
  },
  googleTitle: {
    fontSize: 24,
    fontWeight: '400',
    textAlign: 'center',
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  googleSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 28,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  googleAccountBox: {
    width: '100%',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 28,
  },
  googleSignInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 12,
    borderRadius: 4,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  googleBtnIconWrapper: {
    marginRight: 12,
  },
  googleBtnText: {
    fontSize: 14,
    fontWeight: '500',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  },
  authTabRow: {
    flexDirection: 'row',
    width: '100%',
    marginBottom: 20,
  },
  authTabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
  },
  authTabButtonActive: {
    borderBottomColor: '#1a73e8',
  },
  authTabButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  googleInput: {
    width: '100%',
    height: 48,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 16,
    fontSize: 15,
    marginBottom: 16,
  },
  googleInputLabel: {
    fontSize: 12,
    marginBottom: 6,
    width: '100%',
    alignSelf: 'flex-start',
    fontWeight: '500',
  },
  googlePrimaryBtn: {
    width: '100%',
    height: 44,
    borderRadius: 4,
    backgroundColor: '#1a73e8',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  googlePrimaryBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  flexOne: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0B0F19'
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f9fafb',
    letterSpacing: 0.5,
  },
  headerSub: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 2,
  },
  tableBadge: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tableBadgeText: {
    color: '#111827',
    fontWeight: 'bold',
    fontSize: 11,
  },
  content: {
    flex: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    color: '#f9fafb',
    fontSize: 14,
  },
  categoriesWrapper: {
    height: 48,
    marginBottom: 10,
  },
  categoryScroll: {
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1f2937',
    borderWidth: 1,
    borderColor: '#374151',
  },
  categoryChipActive: {
    backgroundColor: '#f59e0b',
    borderColor: '#f59e0b',
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#f9fafb',
  },
  foodList: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    gap: 12,
  },
  foodCard: {
    flexDirection: 'row',
    backgroundColor: '#1f2937',
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#374151',
  },
  foodCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  emojiContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  foodImage: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#111827',
  },
  foodEmoji: {
    fontSize: 24,
  },
  foodMeta: {
    marginLeft: 12,
    flex: 1,
  },
  foodName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#f9fafb',
  },
  foodCategory: {
    fontSize: 10,
    color: '#9ca3af',
    marginTop: 2,
    textTransform: 'capitalize',
  },
  foodPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#f59e0b',
    marginTop: 4,
  },
  actionContainer: {
    marginLeft: 12,
  },
  addButton: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addButtonText: {
    color: '#111827',
    fontWeight: 'bold',
    fontSize: 12,
  },
  qtySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    borderRadius: 10,
    padding: 4,
    gap: 12,
  },
  qtyBtn: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#374151',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyText: {
    color: '#f9fafb',
    fontWeight: 'bold',
    fontSize: 13,
  },
  tabBar: {
    height: 64,
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
    backgroundColor: '#0B0F19',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 5,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  tabButtonActive: {
    //
  },
  tabLabel: {
    fontSize: 10,
    color: '#9ca3af',
  },
  tabLabelActive: {
    color: '#f59e0b',
    fontWeight: 'bold',
  },
  cartBadgeCount: {
    position: 'absolute',
    right: -8,
    top: -6,
    backgroundColor: '#ef4444',
    borderRadius: 8,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadgeCountText: {
    color: '#f9fafb',
    fontSize: 9,
    fontWeight: 'bold',
  },
  scannerWrapper: {
    flex: 1,
    backgroundColor: '#0B0F19',
  },
  scannerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f9fafb',
    textAlign: 'center',
    marginTop: 24,
  },
  scannerSub: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 20,
  },
  cameraBox: {
    flex: 1,
    marginHorizontal: 24,
    marginBottom: 40,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#f59e0b',
  },
  clearTableBtn: {
    margin: 20,
    padding: 12,
    backgroundColor: '#ef4444',
    borderRadius: 12,
    alignItems: 'center',
  },
  clearTableText: {
    color: '#f9fafb',
    fontWeight: 'bold',
    fontSize: 13,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  infoText: {
    color: '#9ca3af',
    textAlign: 'center',
    marginBottom: 16,
    fontSize: 14,
  },
  actionButton: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  actionButtonText: {
    color: '#111827',
    fontWeight: 'bold',
    fontSize: 13,
  },
  cartWrapper: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f9fafb',
    marginBottom: 16,
  },
  subSectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#f9fafb',
    marginTop: 20,
    marginBottom: 10,
  },
  emptyCart: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyCartText: {
    color: '#9ca3af',
    fontSize: 14,
    textAlign: 'center',
  },
  cartItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#374151',
  },
  cartItemEmoji: {
    fontSize: 24,
  },
  cartItemMeta: {
    marginLeft: 12,
    flex: 1,
  },
  cartItemName: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#f9fafb',
  },
  cartItemPrice: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 2,
  },
  cartItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cartQtyBtn: {
    width: 20,
    height: 20,
    borderRadius: 5,
    backgroundColor: '#374151',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartQtyVal: {
    color: '#f9fafb',
    fontSize: 12,
    fontWeight: 'bold',
  },
  cartTrashBtn: {
    marginLeft: 4,
    padding: 4,
  },
  typeSelectorWrapper: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  typeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1f2937',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
    gap: 6,
  },
  typeOptionActive: {
    backgroundColor: '#f59e0b',
    borderColor: '#f59e0b',
  },
  typeOptionText: {
    color: '#9ca3af',
    fontSize: 11,
    fontWeight: 'bold',
  },
  typeOptionTextActive: {
    color: '#111827',
  },
  inputSection: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#9ca3af',
    marginBottom: 6,
  },
  inputFieldWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  textInput: {
    flex: 1,
    paddingVertical: 10,
    marginLeft: 8,
    color: '#f9fafb',
    fontSize: 13,
  },
  gpsFetchBtn: {
    backgroundColor: '#374151',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  gpsBtnText: {
    color: '#f59e0b',
    fontWeight: 'bold',
    fontSize: 11,
  },
  textInputMultiline: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
    padding: 10,
    color: '#f9fafb',
    fontSize: 13,
    height: 70,
    textAlignVertical: 'top',
  },
  pricingCard: {
    backgroundColor: '#1f2937',
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#374151',
    gap: 8,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceLabel: {
    color: '#9ca3af',
    fontSize: 12,
  },
  priceVal: {
    color: '#f9fafb',
    fontSize: 12,
    fontWeight: '600',
  },
  grandPriceLabel: {
    color: '#f9fafb',
    fontWeight: 'bold',
    fontSize: 14,
  },
  grandPriceVal: {
    color: '#f59e0b',
    fontWeight: 'bold',
    fontSize: 18,
  },
  submitOrderBtn: {
    backgroundColor: '#f59e0b',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 20,
  },
  submitOrderText: {
    color: '#111827',
    fontWeight: 'bold',
    fontSize: 14,
  },
  ordersWrapper: {
    padding: 16,
    paddingBottom: 40,
  },
  emptyOrders: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    gap: 12,
  },
  emptySubText: {
    color: '#6b7280',
    fontSize: 11,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  orderStatusCard: {
    backgroundColor: '#1f2937',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  orderIdText: {
    color: '#f59e0b',
    fontWeight: 'bold',
    fontSize: 14,
  },
  orderTxText: {
    color: '#9ca3af',
    fontSize: 10,
    marginTop: 2,
  },
  orderTimeText: {
    color: '#9ca3af',
    fontSize: 11,
  },
  trackerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    marginBottom: 16,
    marginTop: 8,
  },
  trackerStep: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#374151',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackerStepDone: {
    backgroundColor: '#10b981',
  },
  trackerStepActive: {
    backgroundColor: '#f59e0b',
    borderWidth: 2,
    borderColor: '#f9fafb',
  },
  stepNumText: {
    color: '#111827',
    fontSize: 11,
    fontWeight: 'bold',
  },
  stepLabelDone: {
    position: 'absolute',
    bottom: -18,
    fontSize: 8,
    fontWeight: 'bold',
    color: '#10b981',
    width: 50,
    textAlign: 'center',
  },
  stepLabelActive: {
    position: 'absolute',
    bottom: -18,
    fontSize: 8,
    fontWeight: 'bold',
    color: '#f59e0b',
    width: 50,
    textAlign: 'center',
  },
  stepLabelMuted: {
    position: 'absolute',
    bottom: -18,
    fontSize: 8,
    color: '#6b7280',
    width: 50,
    textAlign: 'center',
  },
  trackerLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#374151',
  },
  trackerLineActive: {
    backgroundColor: '#10b981',
  },
  statusDescription: {
    color: '#f9fafb',
    fontSize: 12,
    textAlign: 'center',
    marginVertical: 8,
    fontWeight: '500',
  },
  orderItemText: {
    color: '#9ca3af',
    fontSize: 12,
    marginTop: 4,
  },
  orderTotalText: {
    color: '#f9fafb',
    fontWeight: 'bold',
    fontSize: 13,
    marginTop: 12,
    textAlign: 'right',
  },
  divider: {
    height: 1,
    backgroundColor: '#374151',
    marginVertical: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1f2937',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#374151',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f9fafb',
  },
  modalInput: {
    backgroundColor: '#111827',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
    color: '#f9fafb',
  },
  otpInputCenter: {
    textAlign: 'center',
    fontSize: 20,
    letterSpacing: 8,
    fontWeight: 'bold',
  },
  resendBtn: {
    padding: 10,
    alignItems: 'center',
    marginTop: 6,
  },
  resendBtnText: {
    color: '#9ca3af',
    fontSize: 12,
  },
  modalEmoji: {
    fontSize: 48,
    textAlign: 'center',
    marginBottom: 12,
  },
  modalImage: {
    width: 120,
    height: 120,
    borderRadius: 20,
    alignSelf: 'center',
    marginBottom: 16,
    backgroundColor: '#111827',
  },
  modalName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f9fafb',
    textAlign: 'center',
  },
  modalCategory: {
    fontSize: 11,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 4,
    textTransform: 'capitalize',
  },
  modalPrice: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f59e0b',
    textAlign: 'center',
    marginVertical: 12,
  },
  modalDesc: {
    color: '#9ca3af',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  modalAddBtn: {
    backgroundColor: '#f59e0b',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  modalAddBtnText: {
    color: '#111827',
    fontWeight: 'bold',
    fontSize: 14,
  },
  modalCloseBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  modalCloseBtnText: {
    color: '#9ca3af',
    fontSize: 12,
  },
  profileWrapper: {
    padding: 16,
    paddingBottom: 40,
  },
  profileLoginCard: {
    backgroundColor: '#1f2937',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 12,
    marginTop: 20,
  },
  profileIcon: {
    marginBottom: 8,
  },
  loginTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f9fafb',
  },
  loginSub: {
    color: '#9ca3af',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 16,
  },
  loginBtn: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginTop: 8,
  },
  loginBtnText: {
    color: '#111827',
    fontWeight: 'bold',
    fontSize: 13,
  },
  userCard: {
    flexDirection: 'row',
    backgroundColor: '#1f2937',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  userIconBox: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f59e0b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userIconText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#111827',
  },
  userMeta: {
    marginLeft: 16,
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f9fafb',
  },
  userPhone: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  userAddr: {
    fontSize: 11,
    color: '#f59e0b',
    marginTop: 4,
  },
  receiptCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#374151',
    gap: 12,
  },
  receiptMeta: {
    flex: 1,
  },
  receiptTitle: {
    color: '#f9fafb',
    fontSize: 13,
    fontWeight: 'bold',
  },
  receiptSub: {
    color: '#9ca3af',
    fontSize: 11,
    marginTop: 2,
  },
  logoutBtn: {
    borderWidth: 1,
    borderColor: '#ef4444',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 30,
  },
  logoutBtnText: {
    color: '#ef4444',
    fontWeight: 'bold',
    fontSize: 13,
  },
  adminGatewayBox: {
    backgroundColor: '#1f2937',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    gap: 8,
    marginTop: 40,
  },
  gatewayText: {
    color: '#f9fafb',
    fontWeight: 'bold',
    fontSize: 13,
  },
  gatewayBtn: {
    backgroundColor: '#374151',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
  },
  gatewayBtnText: {
    color: '#f9fafb',
    fontWeight: '600',
    fontSize: 11,
  },
  grandPriceTotalText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f59e0b',
    marginBottom: 16,
    textAlign: 'center',
  },
  payMethodTabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  payMethodTab: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 8,
    alignItems: 'center',
  },
  payMethodTabActive: {
    borderColor: '#f59e0b',
    backgroundColor: '#374151',
  },
  payMethodTabText: {
    color: '#9ca3af',
    fontSize: 11,
    fontWeight: '600',
  },
  payMethodTabTextActive: {
    color: '#f59e0b',
  },
  upiPanelWrapper: {
    alignItems: 'center',
    marginVertical: 12,
  },
  upiHelperText: {
    color: '#9ca3af',
    fontSize: 12,
    marginBottom: 10,
  },
  upiAppsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  upiAppBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#111827',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#374151',
  },
  upiAppBtnActive: {
    borderColor: '#10b981',
    backgroundColor: '#10b981',
  },
  upiAppText: {
    color: '#f9fafb',
    fontSize: 11,
    fontWeight: 'bold',
  },
  mockQrCodeContainer: {
    backgroundColor: '#111827',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  mockQrText: {
    color: '#9ca3af',
    fontSize: 10,
  },
  cardPanelWrapper: {
    marginBottom: 16,
  },
  cardExpiryRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  paySuccessBox: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 12,
  },
  paySuccessTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#10b981',
  },
  paySuccessSub: {
    color: '#9ca3af',
    fontSize: 12,
    textAlign: 'center',
  },
  txDetailCard: {
    backgroundColor: '#111827',
    padding: 12,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    gap: 4,
    marginBottom: 10,
  },
  txDetailText: {
    color: '#f9fafb',
    fontSize: 12,
    fontWeight: 'bold',
  },
  waConfirmBtn: {
    backgroundColor: '#10b981',
    marginTop: 8,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
  },
  waConfirmText: {
    color: '#f9fafb',
    fontWeight: 'bold',
    fontSize: 14,
  },
  adminWrapper: {
    padding: 16,
    paddingBottom: 40,
  },
  adminHeaderBox: {
    marginBottom: 20,
  },
  adminTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f9fafb',
  },
  adminSub: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 4,
  },
  adminOrderCard: {
    backgroundColor: '#1f2937',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#374151',
    marginBottom: 12,
  },
  adminCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'start',
  },
  adminOrderId: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#f9fafb',
  },
  adminOrderType: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 2,
    textTransform: 'capitalize',
  },
  statusText: {
    fontSize: 11,
    fontWeight: 'bold',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#111827',
  },
  statusRed: {
    color: '#ef4444',
  },
  statusAmber: {
    color: '#f59e0b',
  },
  statusGreen: {
    color: '#10b981',
  },
  adminItemText: {
    color: '#f9fafb',
    fontSize: 12,
    marginTop: 4,
  },
  adminActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  adminActBtn: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: '#111827',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#374151',
    alignItems: 'center',
  },
  adminActBtnActive: {
    borderColor: '#f59e0b',
    backgroundColor: '#374151',
  },
  adminActText: {
    color: '#f9fafb',
    fontSize: 11,
    fontWeight: 'bold',
  },
  emptyCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 100,
    gap: 12,
  },
  emptyText: {
    color: '#f9fafb',
    fontWeight: 'bold',
    fontSize: 14,
  },
  emptySub: {
    color: '#9ca3af',
    fontSize: 11,
    textAlign: 'center',
  },
  emptyTextMuted: {
    color: '#4b5563',
    fontSize: 12,
    textAlign: 'center',
    marginVertical: 12,
  },
  authTabsRow: {
    flexDirection: 'row',
    marginBottom: 20,
    backgroundColor: '#111827',
    borderRadius: 8,
    padding: 4,
  },
  authTabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  authTabBtnActive: {
    backgroundColor: '#f59e0b',
  },
  authTabBtnText: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '600',
  },
  authTabBtnTextActive: {
    color: '#111827',
  },
  areaPickerSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1f2937',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  areaPickerInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  areaPickerText: {
    color: '#f9fafb',
    fontSize: 13,
  },
  areaModalContent: {
    maxHeight: '75%',
  },
  areaListScroll: {
    marginTop: 10,
    marginBottom: 10,
  },
  areaListContent: {
    gap: 8,
  },
  areaItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 14,
    backgroundColor: '#111827',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  areaItemRowActive: {
    borderColor: '#f59e0b',
    backgroundColor: '#1f2937',
  },
  areaItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  areaItemText: {
    color: '#9ca3af',
    fontSize: 13,
    fontWeight: '500',
  },
  areaItemTextActive: {
    color: '#f9fafb',
    fontWeight: 'bold',
  },
  areaItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  areaItemCharge: {
    color: '#9ca3af',
    fontSize: 12,
  },
  areaItemChargeActive: {
    color: '#f59e0b',
    fontWeight: 'bold',
  },
  // Saved Address chips in cart
  savedAddrScroll: {
    paddingVertical: 4,
    gap: 8,
  },
  addrChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  addrChipActive: {
    backgroundColor: '#f59e0b',
    borderColor: '#f59e0b',
  },
  addrChipText: {
    color: '#9ca3af',
    fontSize: 11,
    fontWeight: '600',
  },
  addrChipTextActive: {
    color: '#111827',
  },
  // Profile Addresses management styles
  addressListContainer: {
    gap: 8,
    marginBottom: 16,
  },
  addressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1f2937',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 14,
    padding: 12,
  },
  addressMeta: {
    flex: 1,
    marginRight: 10,
  },
  addressLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  addressLabel: {
    color: '#f9fafb',
    fontWeight: 'bold',
    fontSize: 13,
  },
  defaultBadge: {
    backgroundColor: '#10b981',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  defaultBadgeText: {
    color: '#111827',
    fontSize: 9,
    fontWeight: 'bold',
  },
  addressText: {
    color: '#9ca3af',
    fontSize: 12,
  },
  addressActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addrActionBtn: {
    backgroundColor: '#374151',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  addrActionText: {
    color: '#f9fafb',
    fontSize: 10,
    fontWeight: 'bold',
  },
  deleteAddrBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  addAddressForm: {
    backgroundColor: '#1f2937',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  addAddressTitle: {
    color: '#f9fafb',
    fontWeight: 'bold',
    fontSize: 13,
    marginBottom: 10,
  },
  addressFormInput: {
    backgroundColor: '#111827',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#374151',
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#f9fafb',
    fontSize: 12,
    marginBottom: 8,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 4,
  },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#374151',
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  checkboxChecked: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  checkboxLabel: {
    color: '#9ca3af',
    fontSize: 11,
  },
  saveAddressBtn: {
    backgroundColor: '#f59e0b',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  saveAddressBtnText: {
    color: '#111827',
    fontWeight: 'bold',
    fontSize: 12,
  },
  // Admin dashboard updates styles
  adminTabsRow: {
    flexDirection: 'row',
    backgroundColor: '#111827',
    borderRadius: 10,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#374151',
  },
  adminTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  adminTabActive: {
    backgroundColor: '#f59e0b',
  },
  adminTabText: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: 'bold',
  },
  adminTabTextActive: {
    color: '#111827',
  },
  adminOrderContactRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  adminContactText: {
    color: '#f9fafb',
    fontSize: 11,
    fontWeight: '600',
  },
  adminDeliveryDetailsBox: {
    backgroundColor: '#111827',
    borderRadius: 10,
    padding: 10,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: '#374151',
  },
  adminAddrText: {
    color: '#9ca3af',
    fontSize: 11,
    marginTop: 2,
  },
  adminNotesBox: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 10,
    padding: 8,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  adminNotesText: {
    color: '#f59e0b',
    fontSize: 11,
    fontStyle: 'italic',
  },
  adminOrderTotalText: {
    color: '#f9fafb',
    fontWeight: 'bold',
    fontSize: 13,
    textAlign: 'right',
  },
  adminMenuManagerBox: {
    gap: 12,
  },
  adminAddDishCard: {
    backgroundColor: '#1f2937',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  adminFormTitle: {
    color: '#f9fafb',
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: 10,
  },
  adminFormRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  adminFormInput: {
    backgroundColor: '#111827',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#374151',
    color: '#f9fafb',
    fontSize: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  adminMenuItemCard: {
    backgroundColor: '#1f2937',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
  },
  adminMenuItemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  adminMenuEmoji: {
    fontSize: 24,
  },
  adminMenuName: {
    color: '#f9fafb',
    fontWeight: 'bold',
    fontSize: 13,
  },
  adminMenuCat: {
    color: '#9ca3af',
    fontSize: 11,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  adminMenuItemActions: {
    flexDirection: 'row',
    gap: 8,
  },
  adminActBtnActiveRed: {
    borderColor: '#ef4444',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  soldOutBadgeInline: {
    backgroundColor: '#ef4444',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  soldOutBadgeTextInline: {
    color: '#f9fafb',
    fontSize: 9,
    fontWeight: 'bold',
  },
  foodCardSoldOut: {
    opacity: 0.5,
  },
  syncBtn: {
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncBtnDisabled: {
    backgroundColor: '#4b5563',
    opacity: 0.7,
  },
  syncBtnText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  realQrImage: {
    width: 180,
    height: 180,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    padding: 8,
  },
  upiIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    marginBottom: 16,
  },
  upiIdText: {
    color: '#f9fafb',
    fontSize: 12,
    fontWeight: '600',
  },
  copyBtn: {
    backgroundColor: '#374151',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  copyBtnText: {
    color: '#f59e0b',
    fontSize: 11,
    fontWeight: 'bold',
  },
  openUpiBtn: {
    backgroundColor: '#10b981',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    width: '100%',
  },
  openUpiBtnText: {
    color: '#111827',
    fontWeight: 'bold',
    fontSize: 12,
  },
  codPanelWrapper: {
    alignItems: 'center',
    marginVertical: 12,
    width: '100%',
  },
  codHelperText: {
    color: '#9ca3af',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },
});
