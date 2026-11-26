/* =====================================================
   PhysLab Interactive v2.0 — Main Application Controller
   Aurora Glassmorphism UI • Live Hero Canvas • Filterable Grid
   Formula Copy • Circular Mastery Ring • Quiz Confetti
   ===================================================== */

(function () {
  const CHAPTERS = window.PHYSICS_CHAPTERS || [];
  const STORAGE_KEY = 'physlab_interactive_progress_v1';

  const CHAPTER_META = {
    ch1: { emoji: '🧭', accent: '#38bdf8', soft: 'rgba(56, 189, 248, 0.14)', grad: 'linear-gradient(90deg, #38bdf8, #0ea5e9)' },
    ch2: { emoji: '🏎️', accent: '#60a5fa', soft: 'rgba(96, 165, 250, 0.14)', grad: 'linear-gradient(90deg, #60a5fa, #6366f1)' },
    ch3: { emoji: '🚀', accent: '#a78bfa', soft: 'rgba(167, 139, 250, 0.15)', grad: 'linear-gradient(90deg, #818cf8, #c084fc)' },
    ch4: { emoji: '🍎', accent: '#fb7185', soft: 'rgba(251, 113, 133, 0.14)', grad: 'linear-gradient(90deg, #fb7185, #f97316)' },
    ch5: { emoji: '🎡', accent: '#fbbf24', soft: 'rgba(251, 191, 36, 0.14)', grad: 'linear-gradient(90deg, #fbbf24, #f59e0b)' },
    ch6: { emoji: '⚡', accent: '#34d399', soft: 'rgba(52, 211, 153, 0.14)', grad: 'linear-gradient(90deg, #34d399, #10b981)' },
    ch7: { emoji: '💧', accent: '#2dd4bf', soft: 'rgba(45, 212, 191, 0.14)', grad: 'linear-gradient(90deg, #2dd4bf, #0ea5e9)' },
    ch8: { emoji: '🌊', accent: '#e879f9', soft: 'rgba(232, 121, 249, 0.14)', grad: 'linear-gradient(90deg, #e879f9, #818cf8)' }
  };

  const state = {
    view: 'home', // 'home' | 'chapter' | 'puzzles'
    chapterId: null,
    tab: 'lesson', // 'lesson' | 'sim' | 'puzzles' | 'quiz'
    search: '',
    filterGroup: 'all',
    theme: localStorage.getItem('physlab_theme') || 'dark',
    progress: loadProgress()
  };

  let heroRafId = null;
  let toastTimer = null;

  function loadProgress() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return { readChapters: {}, solvedPuzzles: {}, quizScores: {} };
  }

  function saveProgress() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress));
    } catch (e) {}
    updateProgressUI();
  }

  // DOM References
  const elSidebar = document.getElementById('sidebar');
  const elOverlay = document.getElementById('sidebar-overlay');
  const elNav = document.getElementById('sidebar-nav');
  const elSearch = document.getElementById('sidebar-search');
  const elMain = document.getElementById('main-container');
  const elRingFg = document.getElementById('ring-fg');
  const elRingPct = document.getElementById('ring-pct');
  const elMasterySub = document.getElementById('mastery-sub');
  const elFormulaModal = document.getElementById('formula-modal');
  const elFormulaBody = document.getElementById('formula-modal-body');
  const elToast = document.getElementById('toast');
  const elScrollBar = document.getElementById('scroll-progress');

  function showToast(msg) {
    if (!elToast) return;
    elToast.textContent = msg;
    elToast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => elToast.classList.remove('show'), 2200);
  }

  function stopHeroCanvas() {
    if (heroRafId !== null) {
      cancelAnimationFrame(heroRafId);
      heroRafId = null;
    }
  }

  function startHeroCanvas(canvas) {
    stopHeroCanvas();
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const nodes = [];
    for (let i = 0; i < 24; i++) {
      nodes.push({
        x: Math.random(),
        y: Math.random(),
        vx: (Math.random() - 0.5) * 0.0005,
        vy: (Math.random() - 0.5) * 0.0005,
        r: 1.8 + Math.random() * 2.2
      });
    }
    let t = 0;
    function tick() {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(rect.width || 600, 260);
      const h = Math.max(rect.height || 240, 180);
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      t += 0.015;
      // Subtle harmonic sine waves on right side
      for (let k = 0; k < 2; k++) {
        ctx.beginPath();
        ctx.strokeStyle = k === 0 ? 'rgba(56, 189, 248, 0.28)' : 'rgba(167, 139, 250, 0.22)';
        ctx.lineWidth = 1.6;
        for (let x = 0; x <= w; x += 6) {
          const y = h * 0.52 + Math.sin(x * 0.014 + t * (1.2 + k * 0.5) + k * 2) * (24 + k * 14);
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // Orbit rings on right side
      const ox = w * 0.84, oy = h * 0.5;
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.16)';
      ctx.lineWidth = 1.2;
      [42, 74, 108].forEach((r, idx) => {
        ctx.beginPath();
        ctx.ellipse(ox, oy, r, r * 0.52, idx * 0.5, 0, Math.PI * 2);
        ctx.stroke();
        const a = t * (1.1 - idx * 0.25) + idx * 2;
        const px = ox + Math.cos(a) * r * Math.cos(idx * 0.5) - Math.sin(a) * r * 0.52 * Math.sin(idx * 0.5);
        const py = oy + Math.cos(a) * r * Math.sin(idx * 0.5) + Math.sin(a) * r * 0.52 * Math.cos(idx * 0.5);
        ctx.fillStyle = idx === 0 ? '#38bdf8' : (idx === 1 ? '#a78bfa' : '#34d399');
        ctx.beginPath(); ctx.arc(px, py, 3.8, 0, Math.PI * 2); ctx.fill();
      });

      // Floating connected particles
      nodes.forEach(n => {
        n.x += n.vx; n.y += n.vy;
        if (n.x < 0 || n.x > 1) n.vx *= -1;
        if (n.y < 0 || n.y > 1) n.vy *= -1;
      });
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        const ax = a.x * w, ay = a.y * h;
        ctx.fillStyle = 'rgba(148, 163, 184, 0.45)';
        ctx.beginPath(); ctx.arc(ax, ay, a.r, 0, Math.PI * 2); ctx.fill();
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dist = Math.hypot(ax - b.x * w, ay - b.y * h);
          if (dist < 110) {
            ctx.strokeStyle = `rgba(56, 189, 248, ${(1 - dist / 110) * 0.16})`;
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(b.x * w, b.y * h); ctx.stroke();
          }
        }
      }

      heroRafId = requestAnimationFrame(tick);
    }
    tick();
  }

  function launchConfetti() {
    const canvas = document.getElementById('confetti-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const colors = ['#38bdf8', '#818cf8', '#34d399', '#fbbf24', '#fb7185', '#e879f9'];
    const pieces = Array.from({ length: 70 }, () => ({
      x: canvas.width * (0.25 + Math.random() * 0.5),
      y: canvas.height * 0.35,
      vx: (Math.random() - 0.5) * 11,
      vy: -4 - Math.random() * 9,
      size: 5 + Math.random() * 5,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.25,
      color: colors[Math.floor(Math.random() * colors.length)],
      life: 1
    }));

    function frame() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      pieces.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.28;
        p.rot += p.vr;
        p.life -= 0.012;
        if (p.life > 0 && p.y < canvas.height + 20) {
          alive = true;
          ctx.save();
          ctx.globalAlpha = Math.max(0, p.life);
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.65);
          ctx.restore();
        }
      });
      if (alive) requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    requestAnimationFrame(frame);
  }

  function applyTheme() {
    document.documentElement.setAttribute('data-theme', state.theme);
    localStorage.setItem('physlab_theme', state.theme);
    document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
      btn.textContent = state.theme === 'dark' ? '☀️ โหมดสว่าง' : '🌙 โหมดมืด';
    });
  }

  function toggleTheme() {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    applyTheme();
    showToast(state.theme === 'dark' ? '🌙 เปลี่ยนเป็นโหมดมืดแล้ว' : '☀️ เปลี่ยนเป็นโหมดสว่างแล้ว');
  }

  function closeMobileSidebar() {
    elSidebar.classList.remove('open');
    elOverlay.classList.remove('open');
  }

  function updateProgressUI() {
    const totalItems = CHAPTERS.length * 2;
    let done = 0;
    let readCount = 0;
    CHAPTERS.forEach(ch => {
      if (state.progress.readChapters[ch.id]) { done += 1; readCount += 1; }
      if ((state.progress.quizScores[ch.id] || 0) >= Math.ceil(ch.quiz.length / 2)) done += 1;
    });
    const pct = totalItems ? Math.round((done / totalItems) * 100) : 0;
    const circumference = 2 * Math.PI * 19;
    if (elRingFg) {
      elRingFg.style.strokeDasharray = `${circumference}`;
      elRingFg.style.strokeDashoffset = `${circumference * (1 - pct / 100)}`;
    }
    if (elRingPct) elRingPct.textContent = `${pct}%`;
    if (elMasterySub) elMasterySub.textContent = `อ่านแล้ว ${readCount}/${CHAPTERS.length} บท`;
    renderSidebar();
  }

  function renderSidebar() {
    const q = state.search.trim().toLowerCase();
    const groups = {};
    CHAPTERS.forEach(ch => {
      const hay = (ch.title + ' ' + ch.subtitle + ' ' + ch.shortTitle + ' ' + ch.formulas.map(f => f.eq + f.desc).join(' ')).toLowerCase();
      if (q && !hay.includes(q)) return;
      if (!groups[ch.group]) groups[ch.group] = [];
      groups[ch.group].push(ch);
    });

    let html = `
      <button class="nav-item ${state.view === 'home' ? 'active' : ''}" data-action="home">
        <span class="nav-num">🏠</span>
        <span class="nav-title">หน้าหลัก (ภาพรวม)</span>
      </button>
      <button class="nav-item ${state.view === 'puzzles' ? 'active' : ''}" data-action="puzzles">
        <span class="nav-num">💡</span>
        <span class="nav-title">คลังปัญหาชวนคิด (24 ข้อ)</span>
      </button>
    `;

    Object.keys(groups).forEach(g => {
      html += `<div class="nav-section-label">${g}</div>`;
      groups[g].forEach(ch => {
        const isActive = state.view === 'chapter' && state.chapterId === ch.id;
        const isDone = state.progress.readChapters[ch.id] && (state.progress.quizScores[ch.id] || 0) >= Math.ceil(ch.quiz.length / 2);
        html += `
          <button class="nav-item ${isActive ? 'active' : ''}" data-ch="${ch.id}">
            <span class="nav-num">${ch.num}</span>
            <span class="nav-title">${ch.shortTitle}</span>
            ${isDone ? '<span class="nav-check">✓</span>' : ''}
          </button>
        `;
      });
    });

    elNav.innerHTML = html;
    elNav.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const act = btn.dataset.action;
        const chId = btn.dataset.ch;
        if (act === 'home') navigate('home');
        else if (act === 'puzzles') navigate('puzzles');
        else if (chId) navigate('chapter', chId, 'lesson');
        closeMobileSidebar();
      });
    });
  }

  function navigate(view, chapterId = null, tab = 'lesson') {
    window.PhysicsSimEngine.unmount();
    stopHeroCanvas();
    state.view = view;
    state.chapterId = chapterId;
    state.tab = tab;

    if (view === 'chapter' && chapterId) {
      state.progress.readChapters[chapterId] = true;
      saveProgress();
    } else {
      renderSidebar();
    }

    if (view === 'home') renderHome();
    else if (view === 'puzzles') renderAllPuzzles();
    else if (view === 'chapter') renderChapter(chapterId, tab);

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ================= HOME VIEW ================= */
  function renderHome() {
    const totalPuzzles = CHAPTERS.reduce((s, c) => s + c.puzzles.length, 0);
    const totalQuiz = CHAPTERS.reduce((s, c) => s + c.quiz.length, 0);
    const solvedPuzzles = Object.values(state.progress.solvedPuzzles).filter(Boolean).length;
    const allGroups = ['all', ...Array.from(new Set(CHAPTERS.map(c => c.group)))];
    const filtered = state.filterGroup === 'all' ? CHAPTERS : CHAPTERS.filter(c => c.group === state.filterGroup);

    elMain.innerHTML = `
      <section class="hero">
        <canvas class="hero-canvas" id="hero-canvas"></canvas>
        <div class="hero-inner">
          <div class="hero-badge"><span class="live-dot"></span> Interactive Physics Studio • Cambridge IGCSE & Classical Physics</div>
          <h1>เรียนฟิสิกส์ให้<span class="grad-text">เห็นภาพจริง</span><br>เข้าใจง่าย พร้อมห้องทดลองเคลื่อนไหว</h1>
          <p>ย่อยเนื้อหาฟิสิกส์จากตำราสากล 2 เล่มให้สนุกและชัดเจน ครบทั้ง <strong>บทเรียนพร้อมตัวอย่างโจทย์ทีละขั้น</strong>, <strong>ห้องทดลอง HTML5 ปรับตัวแปรได้จริง 12 โหมด</strong>, <strong>ปัญหาชวนคิด</strong> และ <strong>แบบทดสอบเฉลยละเอียด</strong></p>
          <div class="hero-actions">
            <button class="btn btn-primary" id="hero-start">🚀 เริ่มเรียนบทที่ 1</button>
            <button class="btn btn-amber" id="hero-puzzles">💡 ตะลุยปัญหาชวนคิด (${totalPuzzles} ข้อ)</button>
            <button class="btn" id="hero-formulas">📐 ชีตรวมสูตรทั้งหมด</button>
          </div>
        </div>
      </section>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon" style="background:rgba(56,189,248,0.14);color:#38bdf8;">📘</div>
          <div>
            <div class="stat-val">${CHAPTERS.length} บท</div>
            <div class="stat-label">เนื้อหาละเอียด + ตัวอย่าง</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="background:rgba(167,139,250,0.15);color:#a78bfa;">🎬</div>
          <div>
            <div class="stat-val">12 โหมด</div>
            <div class="stat-label">ห้องทดลองเคลื่อนไหว</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="background:rgba(251,191,36,0.15);color:#fbbf24;">💡</div>
          <div>
            <div class="stat-val">${solvedPuzzles}/${totalPuzzles}</div>
            <div class="stat-label">ปัญหาชวนคิดที่ไขแล้ว</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="background:rgba(52,211,153,0.15);color:#34d399;">🏆</div>
          <div>
            <div class="stat-val">${totalQuiz} ข้อ</div>
            <div class="stat-label">แบบฝึกหัดเฉลยละเอียด</div>
          </div>
        </div>
      </div>

      <div class="section-bar">
        <h2 style="font-size:21px;">📚 เลือกบทเรียนฟิสิกส์</h2>
        <div class="filter-pills">
          ${allGroups.map(g => `
            <button class="filter-pill ${state.filterGroup === g ? 'active' : ''}" data-filter="${g}">
              ${g === 'all' ? 'ทั้งหมด (8 บท)' : g}
            </button>
          `).join('')}
        </div>
      </div>

      <div class="chapters-grid">
        ${filtered.map(ch => {
          const meta = CHAPTER_META[ch.id] || { emoji: '⚛', accent: '#38bdf8', soft: 'rgba(56,189,248,0.14)', grad: 'linear-gradient(90deg,#38bdf8,#818cf8)' };
          const score = state.progress.quizScores[ch.id];
          const scoreBadge = score !== undefined
            ? `<span class="meta-tag" style="color:var(--emerald);border-color:rgba(52,211,153,0.4);">Quiz ${score}/${ch.quiz.length}</span>`
            : `<span class="meta-tag">Quiz ${ch.quiz.length} ข้อ</span>`;
          return `
            <article class="chapter-card" data-open-ch="${ch.id}" style="--ch-accent:${meta.accent};--ch-soft:${meta.soft};--ch-grad:${meta.grad};">
              <div class="chapter-card-top">
                <div class="ch-icon-badge">
                  <span class="ch-emoji">${meta.emoji}</span>
                  <span class="chapter-pill">บทที่ ${ch.num}</span>
                </div>
                <span style="font-size:11.8px;color:var(--text-dim);">${ch.group}</span>
              </div>
              <h3>${ch.title}</h3>
              <p>${ch.subtitle}</p>
              <div class="chapter-meta">
                <div class="meta-left">
                  <span class="meta-tag">🎬 แล็บจำลอง</span>
                  <span class="meta-tag">💡 ${ch.puzzles.length} ชวนคิด</span>
                  ${scoreBadge}
                </div>
                <span class="ch-cta">เริ่มเรียน →</span>
              </div>
            </article>
          `;
        }).join('')}
      </div>
    `;

    startHeroCanvas(elMain.querySelector('#hero-canvas'));
    elMain.querySelector('#hero-start').onclick = () => navigate('chapter', CHAPTERS[0].id, 'lesson');
    elMain.querySelector('#hero-puzzles').onclick = () => navigate('puzzles');
    elMain.querySelector('#hero-formulas').onclick = openFormulaModal;

    elMain.querySelectorAll('[data-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.filterGroup = btn.dataset.filter;
        renderHome();
      });
    });

    elMain.querySelectorAll('[data-open-ch]').forEach(card => {
      card.addEventListener('click', () => navigate('chapter', card.dataset.openCh, 'lesson'));
    });
  }

  /* ================= ALL PUZZLES VIEW ================= */
  function renderAllPuzzles() {
    let cardsHtml = '';
    CHAPTERS.forEach(ch => {
      ch.puzzles.forEach((pz) => {
        cardsHtml += renderPuzzleCardHTML(pz, `บทที่ ${ch.num}: ${ch.shortTitle} • ${pz.tag}`);
      });
    });

    elMain.innerHTML = `
      <div class="chapter-hero" style="--ch-grad:linear-gradient(90deg,#fbbf24,#f97316);--ch-soft:rgba(251,191,36,0.14);">
        <div class="breadcrumb"><a id="bc-home">หน้าหลัก</a> / คลังปัญหาชวนคิด</div>
        <div class="chapter-title-row">
          <div class="chapter-hero-icon">💡</div>
          <div>
            <h1>คลังปัญหาชวนคิดฟิสิกส์ (Think Deeper)</h1>
            <p class="chapter-subtitle">รวม 24 คำถามชวนคิดสุดคลาสสิกจาก Cambridge IGCSE และ Classical Physics — ลองคิดคำตอบในใจก่อนกดเปิดคำใบ้หรือเฉลย!</p>
          </div>
        </div>
      </div>
      <div id="puzzles-list">${cardsHtml}</div>
    `;

    elMain.querySelector('#bc-home').onclick = () => navigate('home');
    bindPuzzleEvents(elMain);
  }

  function renderPuzzleCardHTML(pz, badgeText) {
    const solved = !!state.progress.solvedPuzzles[pz.id];
    return `
      <div class="puzzle-card ${solved ? 'is-solved' : ''}" data-pid="${pz.id}">
        <div class="puzzle-top">
          <span class="puzzle-badge">💡 ${badgeText}</span>
          <button class="btn btn-sm ${solved ? 'btn-emerald' : ''} btn-mark-solved" data-pid="${pz.id}">
            ${solved ? '✅ เข้าใจแล้ว' : '⬜ ติ๊กว่าเข้าใจแล้ว'}
          </button>
        </div>
        <div class="puzzle-q">${pz.question}</div>
        <div class="puzzle-actions">
          <button class="btn btn-sm btn-amber btn-hint">🔍 ดูคำใบ้ (Hint)</button>
          <button class="btn btn-sm btn-primary btn-ans">✨ เปิดเฉลยและคำอธิบาย</button>
        </div>
        <div class="puzzle-reveal hint-box"><strong>🔍 คำใบ้:</strong> ${pz.hint}</div>
        <div class="puzzle-reveal answer-box"><strong>✨ คำอธิบาย:</strong> ${pz.answer}</div>
      </div>
    `;
  }

  function bindPuzzleEvents(container) {
    container.querySelectorAll('.puzzle-card').forEach(card => {
      const pid = card.dataset.pid;
      const hintBox = card.querySelector('.hint-box');
      const ansBox = card.querySelector('.answer-box');
      card.querySelector('.btn-hint').onclick = () => hintBox.classList.toggle('show');
      card.querySelector('.btn-ans').onclick = () => ansBox.classList.toggle('show');
      const solveBtn = card.querySelector('.btn-mark-solved');
      solveBtn.onclick = () => {
        state.progress.solvedPuzzles[pid] = !state.progress.solvedPuzzles[pid];
        const isSolved = state.progress.solvedPuzzles[pid];
        card.classList.toggle('is-solved', isSolved);
        solveBtn.classList.toggle('btn-emerald', isSolved);
        solveBtn.textContent = isSolved ? '✅ เข้าใจแล้ว' : '⬜ ติ๊กว่าเข้าใจแล้ว';
        saveProgress();
        if (isSolved) showToast('บันทึกว่าเข้าใจปัญหาชวนคิดข้อนี้แล้ว ✨');
      };
    });
  }

  function bindFormulaCopy(container) {
    container.querySelectorAll('.formula-card').forEach(card => {
      card.addEventListener('click', () => {
        const eq = card.dataset.eq || '';
        if (navigator.clipboard && eq) {
          navigator.clipboard.writeText(eq).catch(() => {});
        }
        showToast(`📋 คัดลอกสูตร: ${eq}`);
      });
    });
  }

  /* ================= CHAPTER VIEW ================= */
  function renderChapter(chapterId, activeTab) {
    const idx = CHAPTERS.findIndex(c => c.id === chapterId);
    const ch = CHAPTERS[idx];
    if (!ch) return renderHome();

    const meta = CHAPTER_META[ch.id] || { emoji: '⚛', accent: '#38bdf8', soft: 'rgba(56,189,248,0.14)', grad: 'linear-gradient(90deg,#38bdf8,#818cf8)' };
    const prevCh = idx > 0 ? CHAPTERS[idx - 1] : null;
    const nextCh = idx < CHAPTERS.length - 1 ? CHAPTERS[idx + 1] : null;

    elMain.innerHTML = `
      <div class="chapter-hero" style="--ch-accent:${meta.accent};--ch-soft:${meta.soft};--ch-grad:${meta.grad};">
        <div class="breadcrumb"><a id="bc-home">หน้าหลัก</a> / ${ch.group} / บทที่ ${ch.num}</div>
        <div class="chapter-title-row">
          <div class="chapter-hero-icon">${meta.emoji}</div>
          <div>
            <h1>บทที่ ${ch.num}: ${ch.title}</h1>
            <p class="chapter-subtitle">${ch.subtitle}</p>
            <div class="source-badges">
              ${ch.sources.map(s => `<span class="source-badge">📖 อ้างอิง: ${s}</span>`).join('')}
            </div>
          </div>
        </div>
      </div>

      <div class="tab-bar">
        <button class="tab-btn ${activeTab === 'lesson' ? 'active' : ''}" data-tab="lesson">📖 เนื้อหาละเอียด</button>
        <button class="tab-btn ${activeTab === 'sim' ? 'active' : ''}" data-tab="sim">🎬 ห้องทดลองเคลื่อนไหว</button>
        <button class="tab-btn ${activeTab === 'puzzles' ? 'active' : ''}" data-tab="puzzles">💡 ปัญหาชวนคิด (${ch.puzzles.length})</button>
        <button class="tab-btn ${activeTab === 'quiz' ? 'active' : ''}" data-tab="quiz">📝 แบบฝึกหัด (${ch.quiz.length})</button>
      </div>

      <div id="chapter-tab-body"></div>

      <div class="chapter-nav-footer">
        ${prevCh ? `<button class="btn" id="btn-prev">← บทที่ ${prevCh.num}: ${prevCh.shortTitle}</button>` : '<div></div>'}
        ${nextCh ? `<button class="btn btn-primary" id="btn-next">บทที่ ${nextCh.num}: ${nextCh.shortTitle} →</button>` : `<button class="btn btn-emerald" id="btn-finish">🎉 กลับหน้าหลัก</button>`}
      </div>
    `;

    elMain.querySelector('#bc-home').onclick = () => navigate('home');
    if (prevCh) elMain.querySelector('#btn-prev').onclick = () => navigate('chapter', prevCh.id, 'lesson');
    if (nextCh) elMain.querySelector('#btn-next').onclick = () => navigate('chapter', nextCh.id, 'lesson');
    else elMain.querySelector('#btn-finish').onclick = () => navigate('home');

    elMain.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const nextTab = btn.dataset.tab;
        state.tab = nextTab;
        elMain.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === nextTab));
        renderChapterTabContent(ch, nextTab);
      });
    });

    renderChapterTabContent(ch, activeTab);
  }

  function renderChapterTabContent(ch, tab) {
    window.PhysicsSimEngine.unmount();
    const body = document.getElementById('chapter-tab-body');

    if (tab === 'lesson') {
      body.innerHTML = `
        <div class="intuition-box">
          <strong>🧠 แก่นแนวคิดเข้าใจใน 10 วินาที:</strong><br>${ch.intuition}
        </div>

        <div class="content-section">
          <h2>📐 สูตรสำคัญประจำบท <span style="font-size:12px;color:var(--text-dim);font-weight:400;">(แตะที่การ์ดเพื่อคัดลอกสูตร)</span></h2>
          <div class="formula-grid">
            ${ch.formulas.map(f => `
              <div class="formula-card" data-eq="${f.eq.replace(/"/g, '&quot;')}">
                <div class="formula-top">
                  <div class="formula-eq">${f.eq}</div>
                  <span class="copy-badge">📋</span>
                </div>
                <div class="formula-desc">${f.desc}</div>
              </div>
            `).join('')}
          </div>
        </div>

        ${ch.sections.map(sec => `
          <div class="content-section">
            <h2>${sec.heading}</h2>
            ${sec.html}
          </div>
        `).join('')}

        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px;">
          <button class="btn btn-primary" id="jump-sim">🎬 ไปลองเล่นห้องทดลองเคลื่อนไหวบทนี้ →</button>
          <button class="btn btn-amber" id="jump-puz">💡 ลองคิดปัญหาชวนคิดประจำบท →</button>
        </div>
      `;
      bindFormulaCopy(body);
      body.querySelector('#jump-sim').onclick = () => renderChapter(ch.id, 'sim');
      body.querySelector('#jump-puz').onclick = () => renderChapter(ch.id, 'puzzles');
    }

    else if (tab === 'sim') {
      body.innerHTML = `
        <div class="sim-card">
          <div class="sim-header">
            <div class="sim-title-group">
              <span class="sim-live-pill"><span class="live-dot"></span> LIVE</span>
              <h2 style="font-size:18.5px;">${ch.simTitle}</h2>
            </div>
            <div class="sim-modes" id="sim-modes"></div>
          </div>
          <div class="canvas-wrap">
            <canvas id="sim-canvas"></canvas>
          </div>
          <div class="sim-readouts" id="sim-readouts"></div>
          <div class="sim-controls" id="sim-controls"></div>
          <div class="sim-actions" id="sim-actions"></div>
          <div class="sim-try-box">
            <strong>🧪 ภารกิจทดลองแนะนำ:</strong> ${ch.simGuide}
          </div>
        </div>
      `;
      window.PhysicsSimEngine.mount(ch.simId, {
        canvas: body.querySelector('#sim-canvas'),
        modes: body.querySelector('#sim-modes'),
        readouts: body.querySelector('#sim-readouts'),
        controls: body.querySelector('#sim-controls'),
        actions: body.querySelector('#sim-actions')
      });
    }

    else if (tab === 'puzzles') {
      body.innerHTML = ch.puzzles.map((pz, i) => renderPuzzleCardHTML(pz, `ข้อที่ ${i + 1} • ${pz.tag}`)).join('');
      bindPuzzleEvents(body);
    }

    else if (tab === 'quiz') {
      renderQuiz(body, ch);
    }
  }

  function renderQuiz(body, ch) {
    let answered = 0;
    let correctCount = 0;

    body.innerHTML = `
      <div class="quiz-summary">
        <div>
          <strong style="font-family:var(--font-head);font-size:16.5px;">📝 แบบทดสอบความเข้าใจ บทที่ ${ch.num}</strong>
          <div style="font-size:13.5px;color:var(--text-muted);" id="quiz-score-lbl">ตอบแล้ว 0 / ${ch.quiz.length} ข้อ • คะแนนสูงสุดเดิม: ${state.progress.quizScores[ch.id] ?? '-'} / ${ch.quiz.length}</div>
        </div>
        <button class="btn btn-sm" id="btn-retry-quiz">🔄 ทำแบบทดสอบใหม่</button>
      </div>
      ${ch.quiz.map((item, qIdx) => `
        <div class="quiz-card" data-qidx="${qIdx}">
          <div class="quiz-q">${qIdx + 1}. ${item.q}</div>
          <div class="quiz-options">
            ${item.options.map((opt, oIdx) => `
              <button class="quiz-opt" data-oidx="${oIdx}">
                <span class="opt-letter">${String.fromCharCode(65 + oIdx)}</span>
                <span>${opt}</span>
              </button>
            `).join('')}
          </div>
          <div class="quiz-explain"><strong>คำอธิบาย:</strong> ${item.explain}</div>
        </div>
      `).join('')}
    `;

    body.querySelector('#btn-retry-quiz').onclick = () => renderQuiz(body, ch);

    body.querySelectorAll('.quiz-card').forEach(card => {
      const qIdx = parseInt(card.dataset.qidx, 10);
      const item = ch.quiz[qIdx];
      const opts = card.querySelectorAll('.quiz-opt');
      const exp = card.querySelector('.quiz-explain');

      opts.forEach(btn => {
        btn.addEventListener('click', () => {
          const picked = parseInt(btn.dataset.oidx, 10);
          opts.forEach(b => b.disabled = true);
          answered++;
          if (picked === item.ans) {
            btn.classList.add('correct');
            correctCount++;
          } else {
            btn.classList.add('wrong');
            opts[item.ans].classList.add('correct');
          }
          exp.classList.add('show');

          const best = Math.max(state.progress.quizScores[ch.id] || 0, correctCount);
          state.progress.quizScores[ch.id] = best;
          saveProgress();
          body.querySelector('#quiz-score-lbl').textContent =
            `ตอบแล้ว ${answered} / ${ch.quiz.length} ข้อ • คะแนนรอบนี้: ${correctCount} / ${ch.quiz.length} (สูงสุด: ${best}/${ch.quiz.length})`;

          if (answered === ch.quiz.length) {
            if (correctCount >= Math.ceil(ch.quiz.length * 0.75)) {
              launchConfetti();
              showToast(`🎉 เยี่ยมมาก! ได้ ${correctCount}/${ch.quiz.length} คะแนน`);
            } else {
              showToast(`ทำครบแล้ว! ได้ ${correctCount}/${ch.quiz.length} คะแนน ลองทบทวนแล้วทำใหม่ได้นะ`);
            }
          }
        });
      });
    });
  }

  /* ================= FORMULA SHEET MODAL ================= */
  function openFormulaModal() {
    elFormulaBody.innerHTML = CHAPTERS.map(ch => `
      <div style="margin-bottom:20px;">
        <h3 style="color:var(--primary);margin-bottom:10px;font-size:16px;">${(CHAPTER_META[ch.id] || {}).emoji || '⚛'} บทที่ ${ch.num}: ${ch.title}</h3>
        <div class="formula-grid">
          ${ch.formulas.map(f => `
            <div class="formula-card" data-eq="${f.eq.replace(/"/g, '&quot;')}">
              <div class="formula-top">
                <div class="formula-eq">${f.eq}</div>
                <span class="copy-badge">📋</span>
              </div>
              <div class="formula-desc">${f.desc}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');
    bindFormulaCopy(elFormulaBody);
    elFormulaModal.classList.add('open');
  }

  function closeFormulaModal() { elFormulaModal.classList.remove('open'); }

  /* ================= INIT EVENTS ================= */
  document.getElementById('brand-home').addEventListener('click', () => { navigate('home'); closeMobileSidebar(); });
  document.getElementById('mobile-menu-btn').addEventListener('click', () => {
    elSidebar.classList.toggle('open');
    elOverlay.classList.toggle('open');
  });
  elOverlay.addEventListener('click', closeMobileSidebar);

  document.querySelectorAll('.theme-toggle-btn').forEach(btn => btn.addEventListener('click', toggleTheme));
  document.querySelectorAll('.open-formula-btn').forEach(btn => btn.addEventListener('click', openFormulaModal));
  document.getElementById('close-formula-modal').addEventListener('click', closeFormulaModal);
  elFormulaModal.addEventListener('click', e => { if (e.target === elFormulaModal) closeFormulaModal(); });

  elSearch.addEventListener('input', e => {
    state.search = e.target.value;
    renderSidebar();
  });

  window.addEventListener('scroll', () => {
    if (!elScrollBar) return;
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const docH = document.documentElement.scrollHeight - window.innerHeight;
    const pct = docH > 0 ? Math.min(100, (scrollTop / docH) * 100) : 0;
    elScrollBar.style.width = `${pct}%`;
  }, { passive: true });

  // Boot
  applyTheme();
  updateProgressUI();
  renderHome();
})();
