import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import CartDrawer from '@/components/cart/CartDrawer'

// Import all pages
import HomePage from '@/pages/HomePage'
import ProductListingPage from '@/pages/ProductListingPage'
import ProductDetailPage from '@/pages/ProductDetailPage'
import SearchPage from '@/pages/SearchPage'
import DealsPage from '@/pages/DealsPage'
import NotificationsPage from '@/pages/NotificationsPage'
import WishlistPage from '@/pages/WishlistPage'
import CartPage from '@/pages/CartPage'
import CheckoutPage from '@/pages/CheckoutPage'
import OrderSuccessPage from '@/pages/OrderSuccessPage'
import LoginPage from '@/pages/auth/LoginPage'
import RegisterPage from '@/pages/auth/RegisterPage'
import AccountDashboard from '@/pages/account/AccountDashboard'
import OrderHistoryPage from '@/pages/account/OrderHistoryPage'
import OrderDetailPage from '@/pages/account/OrderDetailPage'
import SellerDashboard from '@/pages/seller/SellerDashboard'
import SellerProductsPage from '@/pages/seller/SellerProductsPage'
import AddProductPage from '@/pages/seller/AddProductPage'
import AdminDashboard from '@/pages/admin/AdminDashboard'

// Protected Route component
function ProtectedRoute({ children, role }: { children: React.ReactNode; role?: 'customer' | 'seller' | 'admin' }) {
  const { user, initialized } = useAuthStore()

  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#131921]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (role && user.role !== role) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

function App() {
  const initializeAuth = useAuthStore(state => state.initialize)
  const initialized = useAuthStore(state => state.initialized)

  useEffect(() => {
    initializeAuth()
  }, [initializeAuth])

  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#131921]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <div className="flex flex-col min-h-screen bg-[#131921] text-white">
        <Navbar />
        <main className="flex-grow">
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<HomePage />} />
            <Route path="/products" element={<ProductListingPage />} />
            <Route path="/product/:id" element={<ProductDetailPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/deals" element={<DealsPage />} />
            <Route path="/category/:slug" element={<ProductListingPage />} />
            <Route path="/brand/:slug" element={<ProductListingPage />} />

            {/* Guest/Auth Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* Protected Customer Routes */}
            <Route path="/cart" element={<CartPage />} />
            <Route path="/checkout" element={
              <ProtectedRoute>
                <CheckoutPage />
              </ProtectedRoute>
            } />
            <Route path="/checkout/success" element={
              <ProtectedRoute>
                <OrderSuccessPage />
              </ProtectedRoute>
            } />
            <Route path="/wishlist" element={
              <ProtectedRoute>
                <WishlistPage />
              </ProtectedRoute>
            } />
            <Route path="/notifications" element={
              <ProtectedRoute>
                <NotificationsPage />
              </ProtectedRoute>
            } />

            {/* Account Management Routes */}
            <Route path="/account" element={
              <ProtectedRoute>
                <AccountDashboard />
              </ProtectedRoute>
            } />
            <Route path="/account/orders" element={
              <ProtectedRoute>
                <OrderHistoryPage />
              </ProtectedRoute>
            } />
            <Route path="/account/orders/:id" element={
              <ProtectedRoute>
                <OrderDetailPage />
              </ProtectedRoute>
            } />

            {/* Backwards compatibility for old navbar links */}
            <Route path="/orders" element={<Navigate to="/account/orders" replace />} />

            {/* Seller Routes */}
            <Route path="/seller" element={
              <ProtectedRoute role="seller">
                <SellerDashboard />
              </ProtectedRoute>
            } />
            <Route path="/seller/products" element={
              <ProtectedRoute role="seller">
                <SellerProductsPage />
              </ProtectedRoute>
            } />
            <Route path="/seller/products/new" element={
              <ProtectedRoute role="seller">
                <AddProductPage />
              </ProtectedRoute>
            } />
            <Route path="/seller/products/add" element={
              <ProtectedRoute role="seller">
                <AddProductPage />
              </ProtectedRoute>
            } />

            {/* Admin Routes */}
            <Route path="/admin" element={
              <ProtectedRoute role="admin">
                <AdminDashboard />
              </ProtectedRoute>
            } />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <Footer />
        <CartDrawer />
      </div>
    </BrowserRouter>
  )
}

export default App
