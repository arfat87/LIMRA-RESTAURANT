import { motion } from 'framer-motion'
import { Bell, Package, Tag, Info, CheckCheck } from 'lucide-react'
import { useState } from 'react'

const TYPE_ICONS: Record<string, React.ReactNode> = {
  order: <Package size={18} className="text-blue-400" />,
  promo: <Tag size={18} className="text-primary" />,
  system: <Info size={18} className="text-purple-400" />,
  shipping: <Package size={18} className="text-green-400" />,
}

const mockNotifications = [
  { id: 'n1', type: 'order', title: 'Order Shipped!', message: 'Your order ORD-002 has been shipped. Expected delivery: May 18.', is_read: false, created_at: '2 hours ago' },
  { id: 'n2', type: 'promo', title: '🔥 Flash Sale Starting Now!', message: 'Up to 60% off on Electronics. Use code FLASH60 at checkout. Today only!', is_read: false, created_at: '4 hours ago' },
  { id: 'n3', type: 'order', title: 'Order Delivered', message: 'Your order ORD-001 has been delivered successfully. How was it? Leave a review!', is_read: true, created_at: '2 days ago' },
  { id: 'n4', type: 'system', title: 'Account Security Alert', message: 'A new device signed in to your account. If this wasn\'t you, please change your password.', is_read: true, created_at: '3 days ago' },
  { id: 'n5', type: 'promo', title: '💰 Weekend Deals Are Here!', message: 'This weekend only — save big on Fashion & Beauty. Members get extra 5% off!', is_read: true, created_at: '5 days ago' },
  { id: 'n6', type: 'shipping', title: 'Package Out for Delivery', message: 'Your package is out for delivery today. Estimated arrival: 2:00 PM - 6:00 PM.', is_read: true, created_at: '1 week ago' },
]

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState(mockNotifications)
  const unreadCount = notifications.filter(n => !n.is_read).length

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
  }

  const markRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Bell className="text-primary" size={28} />
          <div>
            <h1 className="text-2xl font-bold text-white">Notifications</h1>
            {unreadCount > 0 && (
              <p className="text-sm text-primary">{unreadCount} unread</p>
            )}
          </div>
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="btn-outline text-sm flex items-center gap-2 py-2">
            <CheckCheck size={16} /> Mark All Read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-16">
          <Bell size={64} className="text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No notifications yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((notif, i) => (
            <motion.div
              key={notif.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => markRead(notif.id)}
              className={`card cursor-pointer transition-all duration-200 hover:border-primary/30 ${
                !notif.is_read ? 'border-primary/40 bg-primary/5' : ''
              }`}
            >
              <div className="flex gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                  !notif.is_read ? 'bg-primary/20' : 'bg-surface'
                }`}>
                  {TYPE_ICONS[notif.type] ?? <Bell size={18} className="text-gray-400" />}
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm font-semibold ${!notif.is_read ? 'text-white' : 'text-gray-300'}`}>
                      {notif.title}
                    </p>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-gray-500">{notif.created_at}</span>
                      {!notif.is_read && (
                        <div className="w-2 h-2 bg-primary rounded-full" />
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{notif.message}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
