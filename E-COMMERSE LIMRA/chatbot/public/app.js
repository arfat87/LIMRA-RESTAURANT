// LIMRA RESTAURANT — WhatsApp Agent Portal Client Engine

let activePhone = null;
let activeFilter = 'all';
let previousUnreadTotal = 0;
let pollingInterval = null;

// Premium Audio Bell Chime Synthesizer
function playPremiumChime() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    // Bell Chime Part 1: G5
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(783.99, audioCtx.currentTime); // G5
    gain1.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.2);
    
    // Bell Chime Part 2: C6 (Higher chime)
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1046.50, audioCtx.currentTime + 0.12); // C6
    gain2.gain.setValueAtTime(0.15, audioCtx.currentTime + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.4);
    
    osc1.start(audioCtx.currentTime);
    osc1.stop(audioCtx.currentTime + 1.2);
    osc2.start(audioCtx.currentTime + 0.12);
    osc2.stop(audioCtx.currentTime + 1.4);
  } catch (err) {
    console.warn('Audio Context block:', err);
  }
}

// 1. Navigation Panel Router
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    
    // Update active class
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    item.classList.add('active');
    
    // Hide all views
    document.querySelectorAll('.view-panel').forEach(panel => {
      panel.style.display = 'none';
    });
    
    // Show selected view
    const viewId = item.getAttribute('data-view');
    const targetPanel = document.getElementById(`view-${viewId}`);
    if (targetPanel) {
      targetPanel.style.display = 'block';
    }
  });
});

// 2. Initialize and Start Polling
window.addEventListener('load', () => {
  fetchDashboardStats();
  fetchConversations();
  fetchCustomers();
  fetchKnowledgeBase();
  fetchCampaigns();
  fetchSettings();
  fetchNotifications();
  
  // Set poller to query the Express backend APIs every 4 seconds
  pollingInterval = setInterval(() => {
    fetchDashboardStats();
    fetchConversations(true); // silent update
    fetchNotifications();
  }, 4000);
});

// 3. Fetch Dashboard stats
async function fetchDashboardStats() {
  try {
    const res = await fetch('/api/dashboard/stats');
    if (!res.ok) throw new Error('API Error');
    const stats = await res.json();
    
    document.getElementById('stat-total-chats').innerText = stats.totalConversations;
    document.getElementById('stat-ai-chats').innerText = stats.aiHandled;
    document.getElementById('stat-human-chats').innerText = stats.humanHandled;
    document.getElementById('stat-satisfaction').innerText = stats.satisfactionScore;
    document.getElementById('stat-orders').innerText = stats.totalOrders;
    document.getElementById('stat-revenue').innerText = stats.totalRevenue;
  } catch (err) {
    console.error('Stats fetch error:', err);
  }
}

// 4. Fetch Conversations List
async function fetchConversations(isSilent = false) {
  try {
    const res = await fetch('/api/conversations');
    if (!res.ok) throw new Error('API Error');
    const convos = await res.json();
    
    // Calculate total unread
    const totalUnreads = convos.reduce((a, b) => a + (b.unread_count || 0), 0);
    const unreadBadge = document.getElementById('sidebar-unread-badge');
    if (totalUnreads > 0) {
      unreadBadge.innerText = totalUnreads;
      unreadBadge.style.display = 'inline-block';
      
      // Play premium synthesised chimes if new messages are detected
      if (totalUnreads > previousUnreadTotal) {
        playPremiumChime();
        showToastNotification('New Incoming Message', `A customer sent a query. Click Chat Portal to takeover!`);
      }
    } else {
      unreadBadge.style.display = 'none';
    }
    previousUnreadTotal = totalUnreads;
    
    renderConversationsList(convos);
    
    if (activePhone) {
      // Keep loading active chat messages reactively
      fetchActiveChatMessages(isSilent);
    }
  } catch (err) {
    console.error('Convos fetch error:', err);
  }
}

// Filter button event listeners
document.querySelectorAll('.filter-pills .pill').forEach(pill => {
  pill.addEventListener('click', () => {
    document.querySelectorAll('.filter-pills .pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    activeFilter = pill.getAttribute('data-filter');
    fetchConversations(true);
  });
});

// Search input event listener
document.getElementById('chat-search-input').addEventListener('input', () => {
  fetchConversations(true);
});

// Render Conversations List
function renderConversationsList(convos) {
  const container = document.getElementById('conversations-list-container');
  const searchVal = document.getElementById('chat-search-input').value.toLowerCase();
  
  // Filter and search logic
  const filtered = convos.filter(c => {
    const matchesSearch = c.customer_name.toLowerCase().includes(searchVal) || c.phone.includes(searchVal);
    if (!matchesSearch) return false;
    
    if (activeFilter === 'ai') return c.mode === 'ai';
    if (activeFilter === 'human') return c.mode === 'human';
    if (activeFilter === 'pending') return c.status === 'pending';
    return true;
  });
  
  if (filtered.length === 0) {
    container.innerHTML = `<div class="no-chats-found">No conversations found.</div>`;
    return;
  }
  
  container.innerHTML = filtered.map(c => {
    const isActive = c.phone === activePhone ? 'active' : '';
    const avatarChar = c.customer_name.charAt(0).toUpperCase();
    const modeBadge = c.mode === 'ai' 
      ? `<span class="mode-badge badge-ai">🤖 AI</span>`
      : `<span class="mode-badge badge-human">👨‍💼 Human</span>`;
    const unreadDot = c.unread_count > 0 
      ? `<span class="unread-dot">${c.unread_count}</span>` 
      : '';
      
    return `
      <div class="chat-item ${isActive}" onclick="selectConversation('${c.phone}')">
        <div class="avatar-large">${avatarChar}</div>
        <div class="body">
          <div class="header-row">
            <span class="name">${c.customer_name}</span>
            <span class="time">${new Date(c.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <p class="msg-snippet">${c.last_message || 'No messages yet'}</p>
          <div class="footer-row">
            ${modeBadge}
            ${unreadDot}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// 5. Select Active Chat Conversation
window.selectConversation = async function(phone) {
  activePhone = phone;
  
  // Display layout structures
  document.getElementById('active-chat-header').style.display = 'flex';
  document.getElementById('active-chat-input-bar').style.display = 'flex';
  document.getElementById('active-chat-simulation-bar').style.display = 'flex';
  document.getElementById('active-chat-metadata-sidebar').style.display = 'block';
  
  // Highlight active conversation row
  fetchConversations(true);
  
  // Clear unreads upon selection
  await fetch(`/api/conversations/${phone}/messages`);
  
  fetchActiveChatMessages();
  loadCustomerMetadata(phone);
};

// Fetch Active Chat message history
async function fetchActiveChatMessages(isSilent = false) {
  if (!activePhone) return;
  try {
    const res = await fetch(`/api/conversations/${activePhone}/messages`);
    if (!res.ok) throw new Error('API Error');
    const messages = await res.json();
    
    renderMessagesTimeline(messages, isSilent);
  } catch (err) {
    console.error('Messages timeline load error:', err);
  }
}

// Render Messages bubbles
function renderMessagesTimeline(messages, isSilent) {
  const container = document.getElementById('chat-messages-scroll-area');
  
  if (messages.length === 0) {
    container.innerHTML = `<div class="no-messages-yet">Start of WhatsApp Conversation.</div>`;
    return;
  }
  
  const html = messages.map(m => {
    let senderClass = 'sender-customer';
    let authorLabel = '';
    
    if (m.sender === 'agent') {
      senderClass = 'sender-agent';
      authorLabel = '<span class="author">Operator</span>';
    } else if (m.sender === 'ai') {
      senderClass = 'sender-ai';
      authorLabel = '<span class="author">🤖 Gemini AI</span>';
    }
    
    const timeStr = new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    return `
      <div class="message-row ${senderClass}">
        <div class="message-bubble">
          ${authorLabel}
          <div class="body">${m.body}</div>
          <div class="meta">${timeStr} <i class="fa-solid fa-check-double"></i></div>
        </div>
      </div>
    `;
  }).join('');
  
  container.innerHTML = html;
  
  // Keep scrolling to the bottom of the chats container
  if (!isSilent) {
    container.scrollTop = container.scrollHeight;
  }
}

// 6. Mode Switch Actions (Human vs AI Mode toggling)
async function updateConversationMode(mode) {
  if (!activePhone) return;
  try {
    const res = await fetch(`/api/conversations/${activePhone}/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode })
    });
    if (!res.ok) throw new Error('Toggle error');
    
    showToastNotification('Switchboard Mode Updated', `Chat mode swapped to ${mode.toUpperCase()} successfully.`);
    fetchConversations(true);
    loadCustomerMetadata(activePhone);
  } catch (err) {
    console.error('Toggle error:', err);
  }
}

document.getElementById('toggle-mode-ai-btn').addEventListener('click', () => updateConversationMode('ai'));
document.getElementById('toggle-mode-human-btn').addEventListener('click', () => updateConversationMode('human'));

// 7. Load and Save Customer metadata/notes
async function loadCustomerMetadata(phone) {
  try {
    // 1. Fetch Conversations details
    const cRes = await fetch('/api/conversations');
    const convos = await cRes.json();
    const activeConvo = convos.find(c => c.phone === phone);
    
    if (activeConvo) {
      document.getElementById('chat-header-name').innerText = activeConvo.customer_name;
      document.getElementById('chat-header-phone').innerText = `+${phone}`;
      document.getElementById('chat-header-avatar').innerText = activeConvo.customer_name.charAt(0).toUpperCase();
      
      document.getElementById('meta-customer-name').innerText = activeConvo.customer_name;
      document.getElementById('meta-customer-notes').value = activeConvo.notes || '';
      document.getElementById('meta-team-comments').value = activeConvo.team_comments || '';
      
      // Update toggle buttons active states
      const aiBtn = document.getElementById('toggle-mode-ai-btn');
      const humanBtn = document.getElementById('toggle-mode-human-btn');
      
      if (activeConvo.mode === 'ai') {
        aiBtn.classList.add('active');
        humanBtn.classList.remove('active');
      } else {
        aiBtn.classList.remove('active');
        humanBtn.classList.add('active');
      }
    }
    
    // 2. Fetch Customer profile details
    const custRes = await fetch('/api/customers');
    const customers = await custRes.json();
    const profile = customers.find(c => c.phone === phone);
    
    if (profile) {
      document.getElementById('meta-customer-loyalty').innerText = profile.status || 'Active';
      document.getElementById('meta-customer-spent').innerText = `₹${profile.totalSpend.toLocaleString()}`;
      document.getElementById('meta-customer-orders').innerText = profile.orderCount;
    } else {
      document.getElementById('meta-customer-loyalty').innerText = 'New Guest';
      document.getElementById('meta-customer-spent').innerText = '₹0';
      document.getElementById('meta-customer-orders').innerText = '0';
    }
    
    // 3. Fetch recent orders from InsForge DB for profile list
    const orderRes = await fetch('/api/orders');
    const allOrders = await orderRes.json();
    const clientOrders = allOrders.filter(o => o.customer_phone.replace(/\D/g, '').endsWith(phone.replace(/\D/g, '').slice(-10)));
    
    const ordersContainer = document.getElementById('meta-orders-feed');
    if (clientOrders.length === 0) {
      ordersContainer.innerHTML = `<div class="no-orders">No order logs found.</div>`;
    } else {
      ordersContainer.innerHTML = clientOrders.map(o => `
        <div class="order-pill-card">
          <div class="row">
            <span class="num">#${o.order_number}</span>
            <span class="status bg-purple" style="background:${o.status === 'delivered' ? 'var(--primary-color)' : 'var(--accent-orange)'}; color:#fff;">${o.status}</span>
          </div>
          <div class="row" style="margin-top:4px;">
            <span class="price">₹${o.total_amount}</span>
            <span class="date">${new Date(o.created_at).toLocaleDateString('en-IN')}</span>
          </div>
        </div>
      `).join('');
    }
    
  } catch (err) {
    console.error('Metadata load error:', err);
  }
}

// Save Metadata Click
document.getElementById('meta-save-metadata-btn').addEventListener('click', async () => {
  if (!activePhone) return;
  const notes = document.getElementById('meta-customer-notes').value;
  const team_comments = document.getElementById('meta-team-comments').value;
  
  try {
    const res = await fetch(`/api/conversations/${activePhone}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes, team_comments })
    });
    
    if (!res.ok) throw new Error('Save error');
    showToastNotification('Profile Saved', 'Customer notes and team comments successfully saved.');
    loadCustomerMetadata(activePhone);
  } catch (err) {
    console.error('Metadata save error:', err);
  }
});

// 8. Send Manual Messages
async function sendManualMessage() {
  if (!activePhone) return;
  const input = document.getElementById('chat-message-input');
  const body = input.value.trim();
  if (!body) return;
  
  input.value = '';
  
  try {
    const res = await fetch(`/api/conversations/${activePhone}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body, sender: 'agent' })
    });
    
    if (!res.ok) throw new Error('Send error');
    fetchActiveChatMessages();
    fetchConversations(true);
  } catch (err) {
    console.error('Send error:', err);
  }
}

document.getElementById('chat-send-btn').addEventListener('click', sendManualMessage);
document.getElementById('chat-message-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendManualMessage();
});

// 9. Simulate Incoming Customer Message
async function simulateCustomerMessage() {
  if (!activePhone) return;
  const input = document.getElementById('sim-message-input');
  const body = input.value.trim();
  if (!body) return;
  
  input.value = '';
  
  try {
    const res = await fetch(`/api/conversations/${activePhone}/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body })
    });
    
    if (!res.ok) throw new Error('Simulate error');
    
    // Add brief timeout delay to allow the local/remote AI to run before UI refreshes
    setTimeout(() => {
      fetchActiveChatMessages();
      fetchConversations(true);
    }, 1000);
  } catch (err) {
    console.error('Simulate error:', err);
  }
}

document.getElementById('sim-send-btn').addEventListener('click', simulateCustomerMessage);
document.getElementById('sim-message-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') simulateCustomerMessage();
});

// 10. Fetch and Render Customers directory table
async function fetchCustomers() {
  try {
    const res = await fetch('/api/customers');
    const customers = await res.json();
    
    const body = document.getElementById('customers-table-body');
    body.innerHTML = customers.map(c => `
      <tr>
        <td><strong>${c.name}</strong></td>
        <td>+${c.phone}</td>
        <td>${c.email || '—'}</td>
        <td><strong>₹${c.totalSpend.toLocaleString()}</strong></td>
        <td>${c.orderCount}</td>
        <td><span class="loyalty-pill">${c.status}</span></td>
        <td>${new Date(c.lastInteraction).toLocaleDateString('en-IN')}</td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Customers list fetch error:', err);
  }
}

// 11. Fetch and Manage Knowledge Base references
async function fetchKnowledgeBase() {
  try {
    const res = await fetch('/api/knowledge-base');
    const kb = await res.json();
    
    const container = document.getElementById('kb-docs-list-container');
    container.innerHTML = kb.map(doc => `
      <div class="kb-doc-item">
        <div class="doc-header">
          <span class="category-tag bg-purple">${doc.category}</span>
          <button class="btn-delete-doc" onclick="deleteKnowledgeDoc(${doc.id})" title="Delete Doc"><i class="fa-solid fa-trash"></i></button>
        </div>
        <h3>${doc.title}</h3>
        <p>${doc.content}</p>
      </div>
    `).join('');
  } catch (err) {
    console.error('KB fetch error:', err);
  }
}

// Form Submission Add doc
document.getElementById('kb-add-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const category = document.getElementById('kb-category-select').value;
  const title = document.getElementById('kb-title-input').value.trim();
  const content = document.getElementById('kb-content-textarea').value.trim();
  
  try {
    const res = await fetch('/api/knowledge-base', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, title, content })
    });
    
    if (!res.ok) throw new Error('KB add error');
    
    document.getElementById('kb-title-input').value = '';
    document.getElementById('kb-content-textarea').value = '';
    
    showToastNotification('Reference Added', 'Document successfully integrated into Gemini Knowledge Base.');
    fetchKnowledgeBase();
  } catch (err) {
    console.error('KB add error:', err);
  }
});

window.deleteKnowledgeDoc = async function(id) {
  if (!confirm('Are you sure you want to delete this document from AI reference?')) return;
  try {
    await fetch(`/api/knowledge-base/${id}`, { method: 'DELETE' });
    showToastNotification('Reference Deleted', 'Document removed from knowledge base.');
    fetchKnowledgeBase();
  } catch (err) {
    console.error('KB delete error:', err);
  }
};

// 12. Fetch and Manage Marketing Campaigns
async function fetchCampaigns() {
  try {
    const res = await fetch('/api/marketing/campaigns');
    const camps = await res.json();
    
    const body = document.getElementById('campaigns-table-body');
    body.innerHTML = camps.map(c => `
      <tr>
        <td><strong>${c.title}</strong></td>
        <td>${c.segment}</td>
        <td><span class="badge-normal" style="border-color:var(--primary-color); color:var(--primary-color);">${c.status}</span></td>
        <td>${new Date(c.scheduledAt).toLocaleDateString('en-IN')}</td>
        <td>${c.sentCount} customers</td>
        <td><strong>${c.responseRate}</strong></td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Campaigns fetch error:', err);
  }
}

document.getElementById('marketing-campaign-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('camp-title-input').value.trim();
  const segment = document.getElementById('camp-segment-select').value;
  const messageBody = document.getElementById('camp-body-textarea').value.trim();
  
  try {
    const res = await fetch('/api/marketing/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, segment, messageBody })
    });
    
    if (!res.ok) throw new Error('Campaign launch error');
    
    document.getElementById('camp-title-input').value = '';
    document.getElementById('camp-body-textarea').value = '';
    
    showToastNotification('Broadcast Blast Sent', `Campaign successfully sent to all recipients in "${segment}".`);
    fetchCampaigns();
  } catch (err) {
    console.error('Campaign launch error:', err);
  }
});

// 13. Fetch AI Settings / Parameters
async function fetchSettings() {
  try {
    const res = await fetch('/api/settings');
    const settings = await res.json();
    
    document.getElementById('settings-prompt-textarea').value = settings.systemPrompt || '';
    document.getElementById('settings-personality-input').value = settings.personality || '';
    document.getElementById('settings-style-input').value = settings.responseTimeStyle || '';
    document.getElementById('settings-handoff-input').value = settings.handoffRules || '';
    document.getElementById('settings-autoreply-checkbox').checked = settings.autoReply !== false;
    
    // Order templates fields
    document.getElementById('settings-order-notifs-checkbox').checked = settings.enableOrderNotifications !== false;
    
    const tpl = settings.orderTemplates || {};
    document.getElementById('tpl-confirmed').value = tpl.confirmed || '';
    document.getElementById('tpl-preparing').value = tpl.preparing || '';
    document.getElementById('tpl-ready').value = tpl.ready || '';
    document.getElementById('tpl-out-for-delivery').value = tpl.out_for_delivery || '';
    document.getElementById('tpl-delivered').value = tpl.delivered || '';
    document.getElementById('tpl-review-request').value = tpl.review_request || '';
    document.getElementById('tpl-cancelled').value = tpl.cancelled || '';
  } catch (err) {
    console.error('Settings load error:', err);
  }
}

document.getElementById('ai-settings-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const systemPrompt = document.getElementById('settings-prompt-textarea').value;
  const personality = document.getElementById('settings-personality-input').value;
  const responseTimeStyle = document.getElementById('settings-style-input').value;
  const handoffRules = document.getElementById('settings-handoff-input').value;
  const autoReply = document.getElementById('settings-autoreply-checkbox').checked;
  
  try {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemPrompt, personality, responseTimeStyle, handoffRules, autoReply })
    });
    
    if (!res.ok) throw new Error('Settings save error');
    showToastNotification('AI Parameters Saved', 'Base prompt and auto-reply filters successfully updated.');
    fetchSettings();
  } catch (err) {
    console.error('Settings save error:', err);
  }
});

document.getElementById('order-templates-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const enableOrderNotifications = document.getElementById('settings-order-notifs-checkbox').checked;
  const orderTemplates = {
    confirmed: document.getElementById('tpl-confirmed').value,
    preparing: document.getElementById('tpl-preparing').value,
    ready: document.getElementById('tpl-ready').value,
    out_for_delivery: document.getElementById('tpl-out-for-delivery').value,
    delivered: document.getElementById('tpl-delivered').value,
    review_request: document.getElementById('tpl-review-request').value,
    cancelled: document.getElementById('tpl-cancelled').value
  };
  
  try {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enableOrderNotifications, orderTemplates })
    });
    
    if (!res.ok) throw new Error('Templates save error');
    showToastNotification('Notification Templates Saved', 'Order lifecycle auto-templates successfully updated.');
    fetchSettings();
  } catch (err) {
    console.error('Templates save error:', err);
  }
});

// 14. Live Database Notifications Feed
async function fetchNotifications() {
  try {
    const res = await fetch('/api/notifications');
    const notifs = await res.json();
    
    // Update top bell badge count
    const unreadNotifs = notifs.filter(n => !n.is_read).length;
    const badge = document.getElementById('notification-unread-count');
    badge.innerText = unreadNotifs;
    badge.style.display = unreadNotifs > 0 ? 'inline-block' : 'none';
    
    // Dashboard Notifications center list
    const container = document.getElementById('dashboard-notif-feed');
    if (notifs.length === 0) {
      container.innerHTML = `<div class="no-notifs">No notifications.</div>`;
    } else {
      container.innerHTML = notifs.map(n => `
        <div class="notif-item">
          <strong>${n.title}</strong>
          <p>${n.description}</p>
          <span style="font-size: 0.72rem; color: var(--text-muted); margin-top:2px;">${new Date(n.created_at).toLocaleTimeString()}</span>
        </div>
      `).join('');
    }
    
    // Quick Dashboard Activity Feed simulation
    const activityFeed = document.getElementById('dashboard-activity-feed');
    activityFeed.innerHTML = notifs.slice(0, 4).map(n => {
      let icon = '<i class="fa-solid fa-cart-shopping" style="color:var(--primary-color);"></i>';
      if (n.type === 'booking') icon = '<i class="fa-solid fa-calendar" style="color:var(--accent-purple);"></i>';
      if (n.type === 'order_status') icon = '<i class="fa-solid fa-refresh" style="color:var(--accent-orange);"></i>';
      
      return `
        <div class="timeline-item">
          <div class="icon">${icon}</div>
          <div class="body">
            <span class="text">${n.description}</span>
            <span class="time">${new Date(n.created_at).toLocaleString('en-IN')}</span>
          </div>
        </div>
      `;
    }).join('');
    
  } catch (err) {
    console.error('Notifications feed error:', err);
  }
}

// Toast Notifications helper
function showToastNotification(title, message) {
  const toast = document.createElement('div');
  toast.className = 'toast-alert-popup';
  toast.innerHTML = `
    <div class="toast-header">
      <i class="fa-solid fa-circle-info" style="color:var(--primary-color);"></i>
      <strong>${title}</strong>
      <button class="close-btn" onclick="this.parentElement.parentElement.remove()">&times;</button>
    </div>
    <div class="toast-body">${message}</div>
  `;
  document.body.appendChild(toast);
  
  // Style toast dynamically
  Object.assign(toast.style, {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    background: 'rgba(30, 41, 59, 0.95)',
    border: '1px solid rgba(16, 185, 129, 0.3)',
    borderRadius: '12px',
    padding: '16px',
    width: '320px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
    backdropFilter: 'blur(10px)',
    zIndex: '9999',
    animation: 'slideUp 0.3s ease-out'
  });
  
  // Add animation to document stylesheets
  if (!document.getElementById('toast-keyframes')) {
    const style = document.createElement('style');
    style.id = 'toast-keyframes';
    style.innerHTML = `
      @keyframes slideUp {
        from { transform: translateY(100%); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      .toast-header { display:flex; align-items:center; gap:8px; font-size:0.9rem; font-weight:600; margin-bottom:6px; }
      .toast-header .close-btn { margin-left:auto; background:transparent; border:none; color:var(--text-muted); cursor:pointer; font-size:1.1rem; }
      .toast-body { font-size:0.82rem; color:var(--text-muted); line-height:1.4; }
    `;
    document.head.appendChild(style);
  }
  
  // Auto dismiss after 6 seconds
  setTimeout(() => {
    toast.remove();
  }, 6000);
}
