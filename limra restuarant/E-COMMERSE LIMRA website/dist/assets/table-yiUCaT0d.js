import{c as e,h as t,l as n,m as r,r as i,s as a}from"./insforge-BCkf9a_z.js";import{a as o,i as s,r as c,t as l}from"./menu-BbW-k3um.js";/* empty css              */var u=`https://www.google.com/travel/search?q=limra%20restaurant%20reviews&g2lb=4965990%2C72471280%2C72560029%2C72573224%2C72647020%2C72686036%2C72803964%2C72882230%2C73064764%2C121738283%2C121762713&hl=en-IN&gl=in&cs=1&ssta=1&ts=CAEaKwopEicyJTB4M2ExZDJiMjYxNGYzYzE1NToweGRmOWNhNzlhZjUxMWVhY2E&qs=CAEyFENnc0l5dFhIcUtfenFjN2ZBUkFCOAI&ap=ugEHcmV2aWV3cw&ictx=111&ved=0CAAQ5JsGahcKEwiIhf6ftcyVAxUAAAAAHQAAAAAQBA`,d=e=>typeof e==`string`&&e.startsWith(`#`)?document.getElementById(e.slice(1)):document.getElementById(e),f=e=>{e&&e.classList.remove(`hidden`)},p=e=>{e&&e.classList.add(`hidden`)};function m(){try{if(typeof window>`u`||!window.localStorage)return[];let e=localStorage.getItem(`limra-table-cart`);if(!e)return[];let t=JSON.parse(e);return Array.isArray(t)?t.map(e=>{if(!e||!e.item)return null;if(e.item.isCombo||typeof e.item.id==`string`&&e.item.id.startsWith(`combo-`))return e;let t=o.find(t=>t.id===e.item.id);return t?{item:t,quantity:e.quantity}:null}).filter(Boolean):[]}catch(e){return console.warn(`[TableCart] Hydration failed:`,e),[]}}var h=m(),g=null,_=null;async function v(){let e=new URLSearchParams(window.location.search),t=e.get(`t`)||e.get(`table`);if(t&&/^\d+$/.test(t)){let e=parseInt(t,10);if(e>=1&&e<=19){g=e,f(d(`#customer-view`)),p(d(`#owner-view`)),p(d(`#error-view`)),await S();return}}e.has(`t`)||e.has(`table`)?(p(d(`#customer-view`)),p(d(`#owner-view`)),f(d(`#error-view`))):(f(d(`#owner-view`)),p(d(`#customer-view`)),p(d(`#error-view`)),j());function n(){let e=document.createElement(`div`);e.id=`network-status-toast`,e.style.cssText=`
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%) translateY(100px);
      background: #1f2937;
      color: #f3f4f6;
      padding: 12px 24px;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 600;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.1);
      display: flex;
      align-items: center;
      gap: 8px;
      z-index: 9999;
      transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), background 0.3s ease;
    `,document.body.appendChild(e);function t(){navigator.onLine?(e.style.background=`#10b981`,e.innerHTML=`⚡ <span>Back online!</span>`,setTimeout(()=>{e.style.transform=`translateX(-50%) translateY(100px)`},2e3)):(e.style.background=`#ef4444`,e.innerHTML=`<span class="animate-spin mr-1">⏳</span> <span>Connection lost. Reconnecting...</span>`,e.style.transform=`translateX(-50%) translateY(0)`)}window.addEventListener(`online`,t),window.addEventListener(`offline`,t),navigator.onLine||t()}n()}var y=`featured`,b=[];async function x(){try{let e=await a();o.forEach(t=>{let n=e.find(e=>e.id===t.id);n?(n.price!==null&&n.price!==void 0&&(t.price=parseFloat(n.price)),n.mrp!==null&&n.mrp!==void 0&&(t.mrp=parseFloat(n.mrp)),n.available!==void 0&&(t.available=n.available),n.featured!==void 0&&(t.featured=n.featured)):(t.available=!0,t.featured=!1)})}catch(e){console.error(`Failed to load menu overrides:`,e)}}async function S(){let e=(g<=9?`indoor`:`outdoor`)==`indoor`?`🪑 Indoor`:`🌿 Outdoor`;d(`#customer-table-number-label`).textContent=`Serving Table ${g} (${e})`,d(`#checkout-table-display`).textContent=g,d(`checkout-zone-display`)&&(d(`checkout-zone-display`).textContent=e),await x();try{b=await i()}catch(e){console.error(`Failed to load combos on customer view:`,e)}C(),w(),d(`#food-search-input`).addEventListener(`input`,()=>{w()}),A()}function C(){let e=d(`#categories-scroll-container`);if(!e)return;let t=`
    <button class="category-chip px-5 py-2.5 rounded-full text-xs font-semibold border border-white/5 bg-slate-900/60 text-slate-300 hover:border-white/10 ${y===`featured`?`active`:``}" data-category="featured">
      ⭐ Today's Specials
    </button>
  `,n=`
    <button class="category-chip px-5 py-2.5 rounded-full text-xs font-semibold border border-white/5 bg-slate-900/60 text-slate-300 hover:border-white/10 ${y===`all`?`active`:``}" data-category="all">
      🍽️ All Items
    </button>
  `,r=s.map(e=>{let t=c[e]||e,n=l[e]||`🍛`;return`
      <button class="category-chip px-5 py-2.5 rounded-full text-xs font-semibold border border-white/5 bg-slate-900/60 text-slate-300 hover:border-white/10 ${y===e?`active`:``}" data-category="${e}">
        ${n} ${t}
      </button>
    `}).join(``);e.innerHTML=t+n+r,e.querySelectorAll(`.category-chip`).forEach(t=>{t.addEventListener(`click`,()=>{e.querySelectorAll(`.category-chip`).forEach(e=>e.classList.remove(`active`)),t.classList.add(`active`),y=t.dataset.category;let n=t.textContent.trim();d(`#menu-category-title`).textContent=n,w()})})}function w(){let e=d(`#food-cards-grid`),t=d(`#food-search-input`).value.toLowerCase().trim(),n=o.filter(e=>{let n=y===`all`||(y===`featured`?e.featured===!0:e.category===y),r=!t||e.name.toLowerCase().includes(t);return n&&r}),r=b.filter(e=>{if(y!==`all`&&y!==`featured`)return!1;let n=!t||e.name.toLowerCase().includes(t);return e.available!==!1&&n}),i=n.length+r.length;if(d(`#menu-count-badge`).textContent=`${i} item${i===1?``:`s`}`,i===0){y===`featured`?e.innerHTML=`
        <div class="col-span-full py-16 text-center text-slate-400 space-y-4">
          <p class="text-5xl">🍱</p>
          <div class="space-y-1">
            <p class="text-sm font-bold text-slate-200">No active Specials or Combo Deals today</p>
            <p class="text-xs text-slate-400">Click the "🍽️ All Items" tab above to view our complete menu!</p>
          </div>
        </div>
      `:e.innerHTML=`
        <div class="col-span-full py-12 text-center text-slate-400 space-y-2">
          <p class="text-3xl">🍲</p>
          <p class="text-sm font-semibold">No food items match your search</p>
        </div>
      `;return}e.innerHTML=r.map(e=>{let t=h.find(t=>t.item.id===`combo-${e.id}`||String(t.item.id)===`combo-${e.id}`),n=t?t.quantity:0,r=Array.isArray(e.items)?e.items.map(e=>`${e.name} (x${e.qty||1})`).join(` + `):`No items`,i=e.mrp&&parseFloat(e.mrp)>parseFloat(e.price),a=e.image_url||e.image||`/images/food_biryani.png`;return`
      <div class="glass-card food-card p-4 flex flex-col justify-between space-y-4 border border-amber-500/25 cursor-pointer hover:border-amber-500/40" data-item-id="combo-${e.id}">
        <div class="flex gap-3">
          <div class="w-20 h-20 rounded-xl overflow-hidden shrink-0 border border-amber-500/20 bg-neutral-800 animate-pulse flex items-center justify-center relative">
            <img src="${a}" alt="${e.name}" class="w-full h-full object-cover error-fallback" onload="this.parentElement.classList.remove('animate-pulse', 'bg-neutral-800');" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'; this.parentElement.classList.remove('animate-pulse', 'bg-neutral-800');">
            <span class="text-3xl absolute inset-0 flex items-center justify-center" style="display:none;">🍱</span>
          </div>
          <div class="flex-1 min-w-0 text-left">
            <div class="flex items-center gap-1.5 mb-1">
              <span class="px-1.5 py-0.5 rounded bg-amber-500/10 text-[9px] font-bold text-amber-400 uppercase tracking-wider">Combo Pack</span>
            </div>
            <h4 class="font-bold text-sm text-slate-100 truncate">${e.name}</h4>
            <p class="text-[10px] text-slate-400 mt-1 font-semibold leading-relaxed line-clamp-2" style="max-height: 2.4rem; overflow: hidden;" title="Includes: ${r}">Includes: ${r}</p>
            <p class="text-sm font-bold text-amber-500 mt-2">
              ₹${e.price}
              ${i?`<span class="text-xs font-normal text-slate-500 line-through ml-1.5">₹${e.mrp}</span>`:``}
            </p>
          </div>
        </div>

        <div class="flex justify-between items-center pt-2">
          <div class="flex items-center gap-2">
            ${n>0?`
              <button class="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center font-bold btn-cart-minus" data-item-id="combo-${e.id}">-</button>
              <span class="w-6 text-center font-semibold text-sm text-slate-100">${n}</span>
              <button class="w-8 h-8 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 flex items-center justify-center font-bold btn-cart-plus" data-item-id="combo-${e.id}">+</button>
            `:`
              <button class="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs btn-cart-add" data-item-id="combo-${e.id}">Add to Cart</button>
            `}
          </div>
        </div>
      </div>
    `}).join(``)+n.map(e=>{let t=h.find(t=>t.item.id===e.id||String(t.item.id)===String(e.id)),n=t?t.quantity:0,r=e.image||`/images/food_biryani.png`,i=e.emoji||`🍛`,a=e.available!==!1;return`
      <div class="glass-card food-card p-4 flex flex-col justify-between space-y-4 ${a?``:`opacity-55 grayscale-[20%]`} cursor-pointer hover:border-amber-500/30" data-item-id="${e.id}">
        <div class="flex gap-3">
          <div class="w-20 h-20 rounded-xl overflow-hidden shrink-0 border border-white/5 bg-neutral-800 animate-pulse flex items-center justify-center relative">
            <img src="${r}" alt="" class="w-full h-full object-cover error-fallback" onload="this.parentElement.classList.remove('animate-pulse', 'bg-neutral-800');" onerror="this.style.display='none'; this.nextElementSibling.style.display='block'; this.parentElement.classList.remove('animate-pulse', 'bg-neutral-800');">
            <span class="text-3xl absolute inset-0 flex items-center justify-center" style="display:none;">${i}</span>
          </div>
          <div class="flex-1 min-w-0 text-left">
            <h4 class="font-bold text-sm text-slate-100 truncate">${e.name}</h4>
            <p class="text-xs text-slate-400 mt-1 capitalize">${c[e.category]||e.category}</p>
            <p class="text-sm font-bold text-amber-500 mt-2">₹${e.price}</p>
          </div>
        </div>

        <div class="flex justify-between items-center pt-2">
          ${a?`
            <div class="flex items-center gap-2">
              ${n>0?`
                <button class="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center font-bold btn-cart-minus" data-item-id="${e.id}">-</button>
                <span class="w-6 text-center font-semibold text-sm text-slate-100">${n}</span>
                <button class="w-8 h-8 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 flex items-center justify-center font-bold btn-cart-plus" data-item-id="${e.id}">+</button>
              `:`
                <button class="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs btn-cart-add" data-item-id="${e.id}">Add to Cart</button>
              `}
            </div>
          `:`
            <span class="px-2 py-1 rounded bg-red-500/10 text-red-500 font-bold text-[9px] uppercase tracking-wider">Sold Out</span>
          `}
        </div>
      </div>
    `}).join(``),e.querySelectorAll(`.btn-cart-add, .btn-cart-plus`).forEach(e=>{e.addEventListener(`click`,t=>{t.stopPropagation();let n=e.dataset.itemId;T(n.startsWith(`combo-`)?n:parseInt(n,10))})}),e.querySelectorAll(`.btn-cart-minus`).forEach(e=>{e.addEventListener(`click`,t=>{t.stopPropagation();let n=e.dataset.itemId;E(n.startsWith(`combo-`)?n:parseInt(n,10))})}),e.querySelectorAll(`.food-card`).forEach(e=>{e.style.cursor=`pointer`,e.addEventListener(`click`,t=>{if(t.target.closest(`.btn-cart-add, .btn-cart-plus, .btn-cart-minus`))return;let n=e.dataset.itemId;P(n)})})}function T(e){let t=null;if(typeof e==`string`&&e.startsWith(`combo-`)){let n=parseInt(e.replace(`combo-`,``),10),r=b.find(e=>e.id===n);if(r){let n=Array.isArray(r.items)?r.items.map(e=>`${e.name} (x${e.qty||1})`).join(` + `):`No items`;t={id:e,name:r.name,price:parseFloat(r.price),mrp:r.mrp?parseFloat(r.mrp):null,category:`specials`,description:r.description||`Included: ${n}`,image:r.image_url||r.image||`/images/food_biryani.png`,isCombo:!0,items:r.items||[]}}}else{let n=typeof e==`number`?e:parseInt(e,10);t=o.find(e=>e.id===n)}if(!t)return;let n=h.find(e=>e.item.id===t.id||String(e.item.id)===String(t.id));n?n.quantity+=1:h.push({item:t,quantity:1}),D()}function E(e){let t=String(e).startsWith(`combo-`)||typeof e==`number`?e:parseInt(e,10),n=h.findIndex(e=>e.item.id===t||String(e.item.id)===String(t));if(n===-1)return;let r=h[n];r.quantity>1?--r.quantity:h.splice(n,1),D()}function D(){try{localStorage.setItem(`limra-table-cart`,JSON.stringify(h))}catch(e){console.warn(`[TableCart] Failed to save cart:`,e)}w(),O()}function O(){let e=h.reduce((e,t)=>e+t.quantity,0),t=h.reduce((e,t)=>e+t.item.price*t.quantity,0);if(_&&t<parseFloat(_.min_bill)){_=null;let e=d(`#table-coupon-feedback`);e&&(e.textContent=`✗ Coupon cleared: Minimum bill of ₹${parseFloat(_.min_bill).toFixed(2)} required.`,e.style.color=`#ff5b5b`,f(e))}let n=_?Math.round(t*(_.discount_pct/100)):0,r=Math.round((t-n)*.05),i=t-n+r;d(`#cart-count-desktop`).textContent=`${e} item${e===1?``:`s`}`,d(`#cart-badge-mobile`).textContent=e,d(`#cart-total-desktop`).textContent=`₹${t.toFixed(2)}`,d(`#cart-total-mobile`).textContent=`₹${t.toFixed(2)}`,d(`modal-subtotal`)&&(d(`modal-subtotal`).textContent=`₹${t.toFixed(2)}`),d(`modal-discount-row`)&&(_?(d(`modal-discount`).textContent=`-₹${n.toFixed(2)}`,f(d(`modal-discount-row`))):p(d(`modal-discount-row`))),d(`modal-gst`)&&(d(`modal-gst`).textContent=`₹${r.toFixed(2)}`),d(`modal-total`)&&(d(`modal-total`).textContent=`₹${i.toFixed(2)}`);let a=e>0;d(`#btn-checkout-desktop`).disabled=!a,d(`#btn-checkout-mobile`).disabled=!a,k(t)}function k(e){let t=d(`#cart-items-desktop-container`),n=d(`#cart-items-mobile-container`);if(h.length===0){let e=`
      <div class="py-12 text-center text-slate-500 space-y-2 flex-1 flex flex-col justify-center items-center">
        <p class="text-4xl">🛒</p>
        <p class="text-xs font-semibold">Your tray is empty</p>
      </div>
    `;t.innerHTML=e,n.innerHTML=e;return}let r=h.map(e=>`
    <div class="p-3 rounded-xl border border-white/5 bg-slate-900/40 flex items-center justify-between gap-3">
      <div class="min-w-0 flex-1 text-left">
        <p class="font-semibold text-xs truncate text-slate-200">${e.item.name}</p>
        ${e.item.description?`<p class="text-[9px] text-slate-400 mt-0.5 font-semibold truncate">${e.item.description}</p>`:``}
        <p class="text-[10px] text-amber-500 font-bold mt-1">₹${e.item.price} × ${e.quantity}</p>
      </div>
      <div class="flex items-center gap-1.5 shrink-0">
        <button class="btn-cart-minus w-6 h-6 rounded-md bg-white/5 hover:bg-white/10 text-white flex items-center justify-center text-xs font-bold" data-item-id="${e.item.id}">-</button>
        <span class="text-xs font-bold w-4 text-center">${e.quantity}</span>
        <button class="btn-cart-plus w-6 h-6 rounded-md bg-amber-500 hover:bg-amber-600 text-slate-950 flex items-center justify-center text-xs font-bold" data-item-id="${e.item.id}">+</button>
      </div>
    </div>
  `).join(``);t.innerHTML=r,n.innerHTML=r,[t,n].forEach(e=>{e.querySelectorAll(`.btn-cart-plus`).forEach(e=>{e.addEventListener(`click`,()=>{let t=e.dataset.itemId;T(t.startsWith(`combo-`)?t:parseInt(t,10))})}),e.querySelectorAll(`.btn-cart-minus`).forEach(e=>{e.addEventListener(`click`,()=>{let t=e.dataset.itemId;E(t.startsWith(`combo-`)?t:parseInt(t,10))})})})}function A(){L(),d(`#cart-fab-btn`).addEventListener(`click`,()=>{f(d(`#cart-drawer-overlay`))}),d(`#cart-drawer-close`).addEventListener(`click`,()=>{p(d(`#cart-drawer-overlay`))}),d(`#cart-drawer-overlay`).addEventListener(`click`,e=>{e.target===d(`#cart-drawer-overlay`)&&p(d(`#cart-drawer-overlay`))});let i=()=>{f(d(`#checkout-modal`))},a=()=>{p(d(`#checkout-modal`))};d(`#btn-checkout-desktop`).addEventListener(`click`,i),d(`#btn-checkout-mobile`).addEventListener(`click`,()=>{p(d(`#cart-drawer-overlay`)),i()}),d(`#checkout-modal-close`).addEventListener(`click`,a),d(`#checkout-modal`).addEventListener(`click`,e=>{e.target===d(`#checkout-modal`)&&a()}),d(`#btn-apply-coupon`)?.addEventListener(`click`,async()=>{let e=d(`#table-coupon-input`),n=d(`#table-coupon-feedback`),r=document.querySelector(`#checkout-form input[name="phone"]`),i=r?r.value.trim():``,a=e.value.trim().toUpperCase();if(!a){n.textContent=`Please enter a coupon code`,n.style.color=`#ff5b5b`,n.classList.remove(`hidden`);return}n.textContent=`Validating...`,n.style.color=`#cbd5e1`,n.classList.remove(`hidden`);let o=h.reduce((e,t)=>e+t.item.price*t.quantity,0);try{let e=await t(a,o,i);_=e,n.textContent=`✓ Code applied! Saved ${e.discount_pct}% on subtotal.`,n.style.color=`#10b981`,O()}catch(e){_=null,n.textContent=`✗ ${e.message}`,n.style.color=`#ff5b5b`,O()}}),d(`#checkout-form`).addEventListener(`submit`,async e=>{e.preventDefault();let t=new FormData(e.target);await o(t.get(`name`).toString().trim()||`Guest`,t.get(`phone`).toString().trim()||`Dine-In`,t.get(`notes`).toString().trim(),`cash`,null)});async function o(t,i,o,c,l){let u=d(`#btn-submit-order`);u.disabled=!0,u.textContent=`Sending to Kitchen...`;try{let u=g<=9?`indoor`:`outdoor`,m=h.reduce((e,t)=>e+t.item.price*t.quantity,0),v=_?Math.round(m*(_.discount_pct/100)):0;Math.round((m-v)*.05);let y=_?`[COUPON: ${_.code}] [DISCOUNT_PCT: ${_.discount_pct}%] [DISCOUNT_AMT: ${v}]`:``,b=`[PAYMENT: ${c}] | [PAYMENT_STATUS: ${c===`upi`?`PAID`:`PENDING`}]`,x=[`[TABLE: ${g}]`,b,`[CGST: 2.5%] [SGST: 2.5%]`,y,o].filter(Boolean).join(` | `),S=await r({customerName:t,customerPhone:i,items:h.map(e=>({id:e.item.id,name:e.item.isCombo?`🍱 [COMBO] ${e.item.name} (${e.item.description})`:e.item.name,price:Number(e.item.price),qty:Number(e.quantity)})),notes:x,orderType:`table`,tableNumber:g,tableZone:u,txnRef:l});if(_)try{await n(_.code,i,S.id)}catch(e){console.error(`Failed to redeem coupon:`,e)}try{let{data:t}=await e.database.from(`coupons`).select(`*`).eq(`active`,!0).eq(`is_auto_send`,!0).limit(1);if(t&&t.length>0){let e=t[0],n=new Date(e.expiry_date).toLocaleDateString(`en-IN`,{day:`numeric`,month:`short`,year:`numeric`});d(`#success-promo-code`).textContent=e.code,d(`#success-promo-pct`).textContent=`${e.discount_pct}%`,d(`#success-promo-expiry`).textContent=n,f(d(`#success-promo-box`))}else p(d(`#success-promo-box`))}catch(e){console.error(`Failed to load auto-send promo coupon:`,e),p(d(`#success-promo-box`))}a(),h=[],_=null;let C=d(`#table-coupon-input`);C&&(C.value=``);let w=d(`#table-coupon-feedback`);w&&p(w),D();let T=parseInt(S.order_number,10),E=!isNaN(T)&&T>0?T<10?`0${T}`:`${T}`:String(S.order_number||`01`);d(`#success-order-number`).textContent=`#${E}`,d(`#success-table-number`).textContent=`Table ${g}`,d(`#success-diner-name`).textContent=t;let O=d(`#success-append-badge`);O&&(S.is_subsequent_round||S.is_appended?(O.textContent=S.round_number?`Round ${S.round_number} Sent to Kitchen! 🍽️`:`Additional Round Sent to Kitchen! 🍽️`,f(O)):p(O)),p(d(`#customer-view`)),f(d(`#success-view`)),s()}catch(e){alert(`Failed to place order: `+e.message)}finally{u.disabled=!1,u.textContent=`Confirm & Send to Kitchen`}}function s(e=450){setTimeout(()=>{let e=d(`#google-review-modal`),t=d(`#btn-submit-google-review`),n=d(`#btn-close-google-review`),r=d(`#btn-dismiss-review-corner`);if(!e||!t||!n)return;t.href=u;let i=()=>{p(e)};t.onclick=i,n.onclick=i,r&&(r.onclick=i),e.onclick=t=>{t.target===e&&i()},f(e)},e)}[`#btn-header-review`,`#btn-banner-review`,`#btn-success-review`].forEach(e=>{let t=d(e);t&&t.addEventListener(`click`,e=>{e.preventDefault(),s(0)})}),d(`#btn-order-more`).addEventListener(`click`,()=>{p(d(`#success-view`)),f(d(`#customer-view`))})}function j(){let e=document.querySelectorAll(`.layout-table-node`);e.forEach(t=>{t.addEventListener(`click`,()=>{e.forEach(e=>e.classList.remove(`active`)),t.classList.add(`active`);let n=t.dataset.tableId;M(n,parseInt(n,10)<=9?`Indoor Area`:`Outdoor Area`)})}),d(`#btn-copy-url`).addEventListener(`click`,()=>{let e=d(`#qr-url-input`);e.select(),navigator.clipboard.writeText(e.value);let t=d(`#btn-copy-url`).textContent;d(`#btn-copy-url`).textContent=`Copied!`,setTimeout(()=>{d(`#btn-copy-url`).textContent=t},1500)}),d(`#btn-print-qr`).addEventListener(`click`,()=>{let e=window.open(),t=d(`#qr-code-image`).src,n=d(`#qr-table-title`).textContent,r=d(`#qr-table-subtitle`).textContent,i=d(`#qr-url-input`).value;e.document.write(`
      <html>
      <head>
        <title>Print QR Label</title>
        <style>
          body {
            font-family: 'Inter', sans-serif;
            text-align: center;
            padding: 40px;
            color: #1e293b;
          }
          .label-card {
            border: 3px solid #f59e0b;
            padding: 30px;
            border-radius: 24px;
            max-width: 380px;
            margin: 0 auto;
            box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
          }
          h1 {
            color: #d97706;
            margin: 0 0 5px 0;
            font-size: 28px;
            font-weight: 800;
          }
          p.sub {
            color: #64748b;
            margin: 0 0 20px 0;
            text-transform: uppercase;
            font-size: 11px;
            letter-spacing: 0.1em;
            font-weight: 700;
          }
          img {
            width: 250px;
            height: 250px;
            margin-bottom: 20px;
          }
          p.instructions {
            font-size: 14px;
            margin: 0 0 10px 0;
            color: #334155;
            font-weight: 600;
          }
          p.url {
            font-family: monospace;
            font-size: 10px;
            color: #64748b;
            word-break: break-all;
            margin: 0;
          }
        </style>
      </head>
      <body>
        <div class="label-card">
          <h1>LIMRA Restaurant</h1>
          <p class="sub">${n} · ${r}</p>
          <img src="${t}" />
          <p class="instructions">📱 Scan to View Menu & Place Order</p>
          <p class="url">${i}</p>
        </div>
        <script>
          window.onload = function() {
            window.print();
            window.close();
          }
        <\/script>
      </body>
      </html>
    `),e.document.close()})}function M(e,t){p(d(`#qr-placeholder`)),f(d(`#qr-card`)),d(`#qr-table-title`).textContent=`Table ${e}`,d(`#qr-table-subtitle`).textContent=t;let n=`${window.location.origin}/table/index.html?table=${e}`;d(`#qr-url-input`).value=n;let r=`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(n)}`;d(`#qr-code-image`).src=r,fetch(r).then(e=>e.blob()).then(t=>{let n=URL.createObjectURL(t),r=d(`#btn-download-qr`);r.href=n,r.download=`table_${e}_qr.png`}).catch(e=>{console.error(`Error fetching QR code blob:`,e);let t=d(`#btn-download-qr`);t.href=r,t.removeAttribute(`download`)})}function N(e){if(!e)return[];let t=(e.name||``).toLowerCase(),n=e.category||``,r=[];return r=e.isCombo?[`beverages`,`lassi`,`milkshakes`,`mocktails`,`desserts`]:n===`bread`||t.includes(`naan`)||t.includes(`roti`)||t.includes(`kulcha`)?[`veg-curry`,`nonveg-curry`]:n===`biryani`||t.includes(`biryani`)||t.includes(`khuska`)?[`beverages`,`lassi`,`milkshakes`,`mocktails`]:n===`nonveg-curry`||n===`nonveg-starters`||n===`tandoor-kabab`||n===`chinese-nonveg`||t.includes(`chicken`)||t.includes(`mutton`)||t.includes(`fish`)||t.includes(`prawns`)||t.includes(`tikka`)||t.includes(`kabab`)?[`bread`,`veg-rice`,`nonveg-rice`]:[`desserts`,`momos-chaat`,`mocktails`],o.filter(t=>t.id!==e.id&&r.includes(t.category)&&t.available!==!1).sort(()=>.5-Math.random()).slice(0,2)}function P(e){let t=!1,n=null,r=null;if(typeof e==`string`&&e.startsWith(`combo-`)){let i=parseInt(e.replace(`combo-`,``),10);if(r=b.find(e=>e.id===i),!r)return;t=!0;let a=Array.isArray(r.items)?r.items.map(e=>`${e.name} (x${e.qty||1})`).join(` + `):`No items`;n={id:e,name:r.name,price:parseFloat(r.price),mrp:r.mrp?parseFloat(r.mrp):null,category:`specials`,description:r.description?r.description:`Special combo pack featuring ${a}. Prepared fresh with authentic ingredients at LIMRA Restaurant Egra.`,image:r.image_url||r.image||`/images/food_biryani.png`,emoji:`🍱`,isCombo:!0,items:r.items||[]}}else{let t=typeof e==`number`?e:parseInt(e,10);n=o.find(e=>e.id===t)}if(!n)return;let i=d(`#table-detail-overlay`),a=d(`#table-detail-drawer`);if(!i||!a)return;d(`#table-drawer-name`).textContent=n.name,d(`#table-drawer-category`).textContent=t?`🍱 Combo Pack`:c[n.category]||n.category;let s=d(`#table-drawer-price`);if(s){let e=n.mrp&&parseFloat(n.mrp)>parseFloat(n.price);s.innerHTML=`
      <span>₹${n.price}</span>
      ${e?`<span class="text-xs font-normal text-slate-400 line-through ml-2">₹${n.mrp}</span>`:``}
    `}let l=d(`#table-drawer-desc`);l&&(l.textContent=n.description||`Fresh and authentic ${n.name} prepared with traditional spices and methods at LIMRA Restaurant Egra.`);let u=d(`#table-drawer-combo-items`),m=d(`#table-drawer-combo-items-list`);u&&m&&(t&&Array.isArray(n.items)&&n.items.length>0?(m.innerHTML=n.items.map(e=>`
        <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-semibold">
          <span>🍴</span>
          <span>${e.name}</span>
          <span class="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500/25 text-amber-200 font-bold">×${e.qty||1}</span>
        </span>
      `).join(``),f(u)):p(u));let h=d(`#table-drawer-image`),g=d(`#table-drawer-emoji`);h&&(h.style.display=`block`,h.src=n.image||`/images/food_biryani.png`,h.onerror=()=>{h.style.display=`none`,g&&(g.textContent=n.emoji||(t?`🍱`:`🍛`),g.style.display=`flex`)},g&&(g.style.display=`none`)),F(n);let _=d(`#table-drawer-recommendations-grid`),v=d(`#table-drawer-recommendations-section`),y=N(n);_&&v&&(y.length>0?(_.innerHTML=``,y.forEach(e=>{let t=document.createElement(`div`);t.className=`flex items-center gap-3 p-3 bg-white/5 border border-white/5 rounded-2xl hover:border-amber-500/30 transition-colors cursor-pointer`;let r=e.image||`/images/food_biryani.png`,i=e.emoji||`🍲`;t.innerHTML=`
          <div class="w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-white/5 bg-neutral-800 flex items-center justify-center relative">
            <img src="${r}" alt="${e.name}" class="w-full h-full object-cover error-fallback" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
            <span class="text-xl absolute inset-0 flex items-center justify-center" style="display:none;">${i}</span>
          </div>
          <div class="flex-1 min-w-0 text-left">
            <h5 class="text-xs font-bold text-slate-100 truncate">${e.name}</h5>
            <span class="text-[10px] font-black text-amber-400">₹${e.price}</span>
          </div>
          <button class="rec-add-btn shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-amber-500 hover:bg-amber-600 active:scale-90 text-slate-950 font-bold text-sm shadow-md shadow-amber-500/10 transition-all">
            +
          </button>
        `,t.addEventListener(`click`,t=>{t.target.closest(`.rec-add-btn`)||P(e.id)}),t.querySelector(`.rec-add-btn`).addEventListener(`click`,t=>{t.stopPropagation(),T(e.id),F(n);let r=t.currentTarget;r.textContent=`✓`,r.classList.replace(`bg-amber-500`,`bg-slate-700`),r.classList.replace(`text-slate-950`,`text-amber-500`),setTimeout(()=>{r.textContent=`+`,r.classList.replace(`bg-slate-700`,`bg-amber-500`),r.classList.replace(`text-amber-500`,`text-slate-950`)},1200)}),_.appendChild(t)}),f(v)):p(v)),f(i),f(a),a.offsetWidth,i.classList.remove(`opacity-0`),a.classList.add(`open`)}function F(e){let t=d(`#table-drawer-actions-container`);if(!t||!e)return;let n=h.find(t=>t.item.id===e.id||String(t.item.id)===String(e.id)),r=n?n.quantity:0;r>0?(t.innerHTML=`
      <button class="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center font-bold text-sm active:scale-95 transition-transform btn-drawer-minus">-</button>
      <span class="w-6 text-center font-bold text-slate-100 text-sm">${r}</span>
      <button class="w-9 h-9 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 flex items-center justify-center font-bold text-sm active:scale-95 transition-transform btn-drawer-plus">+</button>
    `,t.querySelector(`.btn-drawer-plus`).addEventListener(`click`,()=>{T(e.id),F(e)}),t.querySelector(`.btn-drawer-minus`).addEventListener(`click`,()=>{E(e.id),F(e)})):(t.innerHTML=`
      <button class="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-bold text-xs transition-transform btn-drawer-add">
        Add to Order
      </button>
    `,t.querySelector(`.btn-drawer-add`).addEventListener(`click`,()=>{T(e.id),F(e)}))}function I(){let e=d(`#table-detail-overlay`),t=d(`#table-detail-drawer`);!e||!t||(e.classList.add(`opacity-0`),t.classList.remove(`open`),setTimeout(()=>{p(e),p(t)},350))}function L(){let e=d(`#table-detail-overlay`),t=d(`#table-drawer-close`);t&&t.addEventListener(`click`,I),e&&e.addEventListener(`click`,I),document.addEventListener(`keydown`,e=>{let t=d(`#table-detail-drawer`);t&&!t.classList.contains(`hidden`)&&e.key===`Escape`&&I()})}document.readyState===`loading`?document.addEventListener(`DOMContentLoaded`,v):v();