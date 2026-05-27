/* Smooth scroll + cinematic animations (GSAP) + particles + tilt */

(() => {
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Loading
  const loading = document.getElementById('loading');
  const hideLoading = () => {
    if (!loading) return;
    gsap.to(loading, { opacity: 0, duration: 0.55, ease: 'power2.out', onComplete: () => loading.remove() });
  };
  window.addEventListener('load', () => setTimeout(hideLoading, 650));

  // Reveal on scroll
  gsap.registerPlugin(ScrollTrigger);
  document.querySelectorAll('[data-reveal]').forEach((el) => {
    gsap.fromTo(el, { opacity: 0, y: 22, filter: 'blur(10px)' }, {
      opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.0,
      scrollTrigger: { trigger: el, start: 'top 85%', toggleActions: 'play none none none' }
    });
  });

  // Counters (simple)
  const setCount = (el, to) => {
    const from = 0;
    const dur = 900;
    const start = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - start) / dur);
      const val = from + (to - from) * (p * (2 - p));
      el.textContent = Number(to % 1 === 0 ? Math.round(val) : val).toFixed(to % 1 === 0 ? 0 : 1);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  document.querySelectorAll('[data-count]').forEach((el) => {
    const to = Number(el.getAttribute('data-count'));
    ScrollTrigger.create({
      trigger: el,
      start: 'top 80%',
      onEnter: () => setCount(el, to),
      once: true
    });
  });

  // Navbar mobile
  const burger = document.getElementById('navBurger');
  const navLinks = document.querySelector('.nav-links');
  if (burger && navLinks) {
    burger.addEventListener('click', () => {
      const open = navLinks.classList.toggle('mobile-open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  // Theme toggle (simple)
  const themeToggle = document.getElementById('themeToggle');
  themeToggle?.addEventListener('click', () => {
    document.documentElement.classList.toggle('light');
  });

  // Mouse effects removed (normal pointer / no custom cursor)


  // Button glow remains via CSS hover; pointer-based magnetic effect removed.


  // Tilt cards
  document.querySelectorAll('[data-tilt]').forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      if (prefersReduced) return;
      const r = card.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      const px = x / r.width;
      const py = y / r.height;
      const rx = (py - 0.5) * -10;
      const ry = (px - 0.5) * 12;
      card.style.transform = `perspective(800px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-2px)`;
      card.style.setProperty('--mx', (px*100) + '%');
      card.style.setProperty('--my', (py*100) + '%');
    });
    card.addEventListener('pointerleave', () => {
      card.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg) translateY(0px)';
    });
  });

  // Particles
  const canvas = document.getElementById('particles');
  if (canvas && !prefersReduced) {
    const ctx = canvas.getContext('2d');
    let w, h, dpr;
    const resize = () => {
      dpr = window.devicePixelRatio || 1;
      w = canvas.clientWidth = window.innerWidth;
      h = canvas.clientHeight = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const count = Math.min(140, Math.floor((w*h)/22000));
    const pts = new Array(count).fill(0).map(() => {
      const z = Math.random();
      return {
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * (0.22 + z),
        vy: (Math.random() - 0.5) * (0.22 + z),
        r: 0.8 + z * 2.2,
        a: 0.25 + z * 0.6,
      };
    });

    const draw = () => {
      ctx.clearRect(0, 0, w, h);

      for (let i=0;i<pts.length;i++){
        const p = pts[i];
        p.x += p.vx; p.y += p.vy;
        if (p.x < -20) p.x = w + 20;
        if (p.x > w + 20) p.x = -20;
        if (p.y < -20) p.y = h + 20;
        if (p.y > h + 20) p.y = -20;

        ctx.beginPath();
        ctx.fillStyle = `rgba(45,212,255,${p.a})`;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
        ctx.fill();
      }

      // lines
      for (let i=0;i<pts.length;i++){
        for (let j=i+1;j<pts.length;j++){
          const a = pts[i], b = pts[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.hypot(dx,dy);
          if (dist < 110){
            const t = 1 - dist/110;
            ctx.strokeStyle = `rgba(217,180,107,${0.08*t})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x,a.y);
            ctx.lineTo(b.x,b.y);
            ctx.stroke();
          }
        }
      }

      requestAnimationFrame(draw);
    };
    draw();
  }

  // Scroll progress
  const prog = document.querySelector('#scrollProgress div');
  const onScroll = () => {
    if (!prog) return;
    const s = window.scrollY;
    const max = document.body.scrollHeight - window.innerHeight;
    const p = max > 0 ? (s / max) * 100 : 0;
    prog.style.width = p + '%';
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Chatbot UI
  const chatBtn = document.getElementById('chatBtn');
  const chatbot = document.getElementById('chatbot');
  const chatClose = document.getElementById('chatClose');
  const chatBody = document.getElementById('chatBody');
  const chatInput = document.getElementById('chatInput');
  const chatSend = document.getElementById('chatSend');

  const setChatOpen = (open) => {
    if (!chatbot) return;
    if (open){
      chatbot.classList.add('open');
      chatbot.setAttribute('aria-hidden','false');
    } else {
      chatbot.classList.remove('open');
      chatbot.setAttribute('aria-hidden','true');
    }
  };

  chatBtn?.addEventListener('click', () => setChatOpen(true));
  chatClose?.addEventListener('click', () => setChatOpen(false));

  const addBubble = (text, cls) => {
    const d = document.createElement('div');
    d.className = `bubble ${cls}`;
    d.textContent = text;
    chatBody?.appendChild(d);
    chatBody.scrollTop = chatBody.scrollHeight;
  };

  chatSend?.addEventListener('click', () => {
    const t = chatInput?.value?.trim();
    if (!t) return;
    addBubble(t, 'user');
    if (chatInput) chatInput.value = '';
    setTimeout(() => addBubble('Thanks! We can help you pick the best package.', 'bot'), 420);
  });
  chatInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') chatSend?.click();
  });
})();

