/* =====================================================
   PhysLab Interactive — 8 HTML5 Canvas Physics Labs
   Smooth 60fps requestAnimationFrame + HiDPI Rendering
   ===================================================== */

window.PhysicsSimEngine = (function () {
  let rafId = null;
  let cleanupFns = [];

  function stopCurrent() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    cleanupFns.forEach(fn => { try { fn(); } catch (e) {} });
    cleanupFns = [];
  }

  function setupCanvas(canvas) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(rect.width || 720, 300);
    const h = Math.max(rect.height || 390, 260);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h };
  }

  function drawGrid(ctx, w, h, step = 30) {
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.09)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= w; x += step) {
      ctx.moveTo(x, 0); ctx.lineTo(x, h);
    }
    for (let y = 0; y <= h; y += step) {
      ctx.moveTo(0, y); ctx.lineTo(w, y);
    }
    ctx.stroke();
  }

  function drawArrow(ctx, x1, y1, x2, y2, color, width = 2.8, label = '', labelOffset = { x: 8, y: -8 }) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    if (len < 2) return;
    const angle = Math.atan2(dy, dx);
    const head = Math.min(12, Math.max(7, len * 0.25));

    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - head * Math.cos(angle - Math.PI / 6), y2 - head * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(x2 - head * Math.cos(angle + Math.PI / 6), y2 - head * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();

    if (label) {
      ctx.font = '600 13px "JetBrains Mono", "Prompt", sans-serif';
      ctx.fillStyle = color;
      ctx.fillText(label, (x1 + x2) / 2 + labelOffset.x, (y1 + y2) / 2 + labelOffset.y);
    }
    ctx.restore();
  }

  function makeSlider(id, label, min, max, step, value, unit, onChange) {
    const wrap = document.createElement('div');
    wrap.className = 'control-group';
    wrap.innerHTML = `
      <div class="control-label">
        <span>${label}</span>
        <span class="val" id="val-${id}">${value} ${unit}</span>
      </div>
      <input type="range" id="ctrl-${id}" min="${min}" max="${max}" step="${step}" value="${value}">
    `;
    const input = wrap.querySelector('input');
    const valSpan = wrap.querySelector('.val');
    const handler = () => {
      const v = parseFloat(input.value);
      valSpan.textContent = `${v} ${unit}`;
      onChange(v);
    };
    input.addEventListener('input', handler);
    cleanupFns.push(() => input.removeEventListener('input', handler));
    return wrap;
  }

  function setReadouts(container, items) {
    container.innerHTML = items.map(it => `
      <div class="readout-box">
        <div class="readout-label">${it.label}</div>
        <div class="readout-value" style="${it.color ? 'color:' + it.color : ''}">${it.value}</div>
      </div>
    `).join('');
  }

  /* ================= SIM 1: VECTORS ================= */
  function initVectors(ui) {
    const state = { aMag: 6, aAng: 25, bMag: 5, bAng: 110, mode: 'para', showComp: true };

    ui.modes.innerHTML = `
      <button class="mode-btn active" data-m="para">สี่เหลี่ยมด้านขนาน</button>
      <button class="mode-btn" data-m="tail">หางต่อหัว (Triangle)</button>
    `;
    ui.modes.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        ui.modes.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.mode = btn.dataset.m;
      });
    });

    ui.controls.innerHTML = '';
    ui.controls.append(
      makeSlider('amag', 'ขนาดเวกเตอร์ A', 1, 10, 0.5, state.aMag, 'N', v => state.aMag = v),
      makeSlider('aang', 'มุมเวกเตอร์ A', -180, 180, 5, state.aAng, '°', v => state.aAng = v),
      makeSlider('bmag', 'ขนาดเวกเตอร์ B', 1, 10, 0.5, state.bMag, 'N', v => state.bMag = v),
      makeSlider('bang', 'มุมเวกเตอร์ B', -180, 180, 5, state.bAng, '°', v => state.bAng = v)
    );

    ui.actions.innerHTML = `
      <button class="btn btn-sm" id="btn-toggle-comp">ซ่อน/แสดงองค์ประกอบ (Ax, Ay)</button>
      <button class="btn btn-sm btn-primary" id="btn-perp">ตั้งฉากกัน (90°)</button>
      <button class="btn btn-sm" id="btn-reset">รีเซ็ต</button>
    `;
    ui.actions.querySelector('#btn-toggle-comp').onclick = () => { state.showComp = !state.showComp; };
    ui.actions.querySelector('#btn-perp').onclick = () => {
      state.aAng = 0; state.bAng = 90; state.aMag = 6; state.bMag = 8;
      ui.controls.querySelector('#ctrl-aang').value = 0; ui.controls.querySelector('#val-aang').textContent = '0 °';
      ui.controls.querySelector('#ctrl-bang').value = 90; ui.controls.querySelector('#val-bang').textContent = '90 °';
      ui.controls.querySelector('#ctrl-amag').value = 6; ui.controls.querySelector('#val-amag').textContent = '6 N';
      ui.controls.querySelector('#ctrl-bmag').value = 8; ui.controls.querySelector('#val-bmag').textContent = '8 N';
    };
    ui.actions.querySelector('#btn-reset').onclick = () => { initVectors(ui); };

    let phase = 0;
    function render() {
      phase += 0.04;
      const { ctx, w, h } = setupCanvas(ui.canvas);
      ctx.fillStyle = '#090e1a';
      ctx.fillRect(0, 0, w, h);
      drawGrid(ctx, w, h, 28);

      const ox = w * 0.5, oy = h * 0.54;
      const scale = Math.min(w, h) / 22;

      // Axes
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(20, oy); ctx.lineTo(w - 20, oy);
      ctx.moveTo(ox, 20); ctx.lineTo(ox, h - 20);
      ctx.stroke();
      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px "JetBrains Mono", sans-serif';
      ctx.fillText('+x', w - 34, oy - 8);
      ctx.fillText('+y', ox + 8, 28);

      const aRad = state.aAng * Math.PI / 180;
      const bRad = state.bAng * Math.PI / 180;
      const ax = state.aMag * Math.cos(aRad), ay = state.aMag * Math.sin(aRad);
      const bx = state.bMag * Math.cos(bRad), by = state.bMag * Math.sin(bRad);
      const rx = ax + bx, ry = ay + by;
      const rMag = Math.hypot(rx, ry);
      const rAng = Math.atan2(ry, rx) * 180 / Math.PI;
      const dot = ax * bx + ay * by;

      const pA = { x: ox + ax * scale, y: oy - ay * scale };
      const pB = { x: ox + bx * scale, y: oy - by * scale };
      const pR = { x: ox + rx * scale, y: oy - ry * scale };

      if (state.showComp) {
        ctx.save();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
        ctx.beginPath();
        ctx.moveTo(pA.x, pA.y); ctx.lineTo(pA.x, oy);
        ctx.moveTo(pA.x, pA.y); ctx.lineTo(ox, pA.y);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(52, 211, 153, 0.45)';
        ctx.beginPath();
        ctx.moveTo(pR.x, pR.y); ctx.lineTo(pR.x, oy);
        ctx.moveTo(pR.x, pR.y); ctx.lineTo(ox, pR.y);
        ctx.stroke();
        ctx.restore();
      }

      if (state.mode === 'para') {
        ctx.save();
        ctx.setLineDash([6, 5]);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(pA.x, pA.y); ctx.lineTo(pR.x, pR.y);
        ctx.moveTo(pB.x, pB.y); ctx.lineTo(pR.x, pR.y);
        ctx.stroke();
        ctx.restore();

        drawArrow(ctx, ox, oy, pA.x, pA.y, '#38bdf8', 3, `A (${state.aMag})`);
        drawArrow(ctx, ox, oy, pB.x, pB.y, '#a78bfa', 3, `B (${state.bMag})`);
      } else {
        drawArrow(ctx, ox, oy, pA.x, pA.y, '#38bdf8', 3, `A (${state.aMag})`);
        drawArrow(ctx, pA.x, pA.y, pR.x, pR.y, '#a78bfa', 3, `B (${state.bMag})`);
      }

      // Pulsing resultant
      const glow = 3.5 + 0.7 * Math.sin(phase);
      drawArrow(ctx, ox, oy, pR.x, pR.y, '#34d399', glow, `R = ${rMag.toFixed(2)}`, { x: 10, y: 14 });

      setReadouts(ui.readouts, [
        { label: 'เวกเตอร์ลัพธ์ |R|', value: `${rMag.toFixed(2)} N`, color: '#34d399' },
        { label: 'มุมของ R (เทียบ +x)', value: `${rAng.toFixed(1)}°`, color: '#34d399' },
        { label: 'องค์ประกอบ R = (Rx, Ry)', value: `(${rx.toFixed(1)}, ${ry.toFixed(1)})`, color: '#38bdf8' },
        { label: 'ผลคูณดอท (A · B)', value: `${dot.toFixed(2)}`, color: Math.abs(dot) < 0.05 ? '#fbbf24' : '#a78bfa' }
      ]);

      rafId = requestAnimationFrame(render);
    }
    render();
  }

  /* ================= SIM 2: KINEMATICS & FREE FALL ================= */
  function initKinematics(ui) {
    let mode = 'car';
    const car = { u: 12, a: -2, t: 0, running: true, history: [] };
    const fall = { vacuum: false, t: 0, running: true, yCoin: 0, yFeather: 0, vCoin: 0, vFeather: 0 };

    ui.modes.innerHTML = `
      <button class="mode-btn active" data-m="car">🚗 รถวิ่งแนวตรง + กราฟ s–t, v–t</button>
      <button class="mode-btn" data-m="fall">🪶 หลอดสุญญากาศกาลิเลโอ (เหรียญ vs ขนนก)</button>
    `;

    function buildUI() {
      ui.controls.innerHTML = '';
      if (mode === 'car') {
        ui.controls.append(
          makeSlider('u', 'ความเร็วต้น u', -15, 25, 1, car.u, 'm/s', v => { car.u = v; resetCar(); }),
          makeSlider('a', 'ความเร่ง a', -6, 6, 0.5, car.a, 'm/s²', v => { car.a = v; resetCar(); })
        );
        ui.actions.innerHTML = `
          <button class="btn btn-sm btn-primary" id="btn-play">⏯ เล่น / หยุด</button>
          <button class="btn btn-sm" id="btn-reset">🔄 เริ่มใหม่</button>
        `;
        ui.actions.querySelector('#btn-play').onclick = () => { car.running = !car.running; };
        ui.actions.querySelector('#btn-reset').onclick = resetCar;
      } else {
        ui.controls.innerHTML = `
          <div class="control-group">
            <div class="control-label"><span>สภาพแวดล้อมในหลอดแก้ว</span><span class="val" id="vac-lbl">${fall.vacuum ? 'สุญญากาศ (Vacuum)' : 'มีอากาศ (Air Resistance)'}</span></div>
            <div style="display:flex;gap:8px;margin-top:4px;">
              <button class="btn btn-sm ${!fall.vacuum ? 'btn-primary' : ''}" id="btn-air">💨 มีอากาศ</button>
              <button class="btn btn-sm ${fall.vacuum ? 'btn-primary' : ''}" id="btn-vac">🌌 ดูดอากาศออก (สุญญากาศ)</button>
            </div>
          </div>
        `;
        ui.controls.querySelector('#btn-air').onclick = () => { fall.vacuum = false; resetFall(); buildUI(); };
        ui.controls.querySelector('#btn-vac').onclick = () => { fall.vacuum = true; resetFall(); buildUI(); };
        ui.actions.innerHTML = `
          <button class="btn btn-sm btn-primary" id="btn-drop">⬇️ ปล่อยตกพร้อมกัน!</button>
        `;
        ui.actions.querySelector('#btn-drop').onclick = resetFall;
      }
    }

    function resetCar() { car.t = 0; car.history = []; car.running = true; }
    function resetFall() { fall.t = 0; fall.yCoin = 0; fall.yFeather = 0; fall.vCoin = 0; fall.vFeather = 0; fall.running = true; }

    ui.modes.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        ui.modes.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        mode = btn.dataset.m;
        resetCar(); resetFall(); buildUI();
      });
    });
    buildUI();

    let last = performance.now();
    function render(now) {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const { ctx, w, h } = setupCanvas(ui.canvas);
      ctx.fillStyle = '#090e1a';
      ctx.fillRect(0, 0, w, h);

      if (mode === 'car') {
        if (car.running) {
          car.t += dt;
          if (car.t > 10) { car.t = 10; car.running = false; }
          const v = car.u + car.a * car.t;
          const s = car.u * car.t + 0.5 * car.a * car.t * car.t;
          car.history.push({ t: car.t, v, s });
        }
        const t = car.t;
        const v = car.u + car.a * t;
        const s = car.u * t + 0.5 * car.a * t * t;

        // Track at top
        const trackY = 74;
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(24, trackY + 12, w - 48, 12);
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.5)';
        ctx.setLineDash([10, 8]);
        ctx.beginPath(); ctx.moveTo(24, trackY + 18); ctx.lineTo(w - 24, trackY + 18); ctx.stroke();
        ctx.setLineDash([]);

        const originX = w * 0.25;
        const pxPerM = (w - 90) / 160;
        const carX = Math.max(36, Math.min(w - 56, originX + s * pxPerM));

        // Origin marker
        ctx.fillStyle = '#94a3b8';
        ctx.font = '11px "JetBrains Mono"';
        ctx.fillText('x=0', originX - 10, trackY + 38);
        ctx.fillRect(originX, trackY + 8, 2, 18);

        // Draw car
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.roundRect(carX - 24, trackY - 12, 48, 20, 6);
        ctx.fill();
        ctx.fillStyle = '#e0f2fe';
        ctx.beginPath();
        ctx.roundRect(carX - 13, trackY - 22, 26, 12, 4);
        ctx.fill();
        ctx.fillStyle = '#0f172a';
        ctx.beginPath(); ctx.arc(carX - 13, trackY + 10, 6, 0, Math.PI * 2); ctx.arc(carX + 13, trackY + 10, 6, 0, Math.PI * 2); ctx.fill();

        // Velocity vector on car
        drawArrow(ctx, carX, trackY - 30, carX + v * 2.5, trackY - 30, '#34d399', 2.5, `v=${v.toFixed(1)}`);

        // Two synchronized graphs below
        const gy = 135, gh = h - gy - 26;
        const gw = (w - 72) / 2;

        // Graph 1: s-t
        drawMiniGraph(ctx, 28, gy, gw, gh, car.history, 's', 'กราฟการกระจัด s(m) – เวลา t(s)', '#38bdf8', -80, 160);
        // Graph 2: v-t
        drawMiniGraph(ctx, 44 + gw, gy, gw, gh, car.history, 'v', 'กราฟความเร็ว v(m/s) – เวลา t(s)', '#34d399', -30, 45, true);

        setReadouts(ui.readouts, [
          { label: 'เวลา t', value: `${t.toFixed(2)} s` },
          { label: 'การกระจัด s', value: `${s.toFixed(1)} m`, color: '#38bdf8' },
          { label: 'ความเร็วขณะนี้ v', value: `${v.toFixed(1)} m/s`, color: '#34d399' },
          { label: 'สถานะการเคลื่อนที่', value: Math.abs(v) < 0.2 ? 'หยุดชั่วขณะ' : (v * car.a > 0 ? 'กำลังเร็วขึ้น' : (car.a === 0 ? 'ความเร็วคงที่' : 'กำลังช้าลง')), color: '#fbbf24' }
        ]);
      } else {
        // Galileo Vacuum Tube
        const g = 9.81;
        const tubeH_m = 20; // 20 meters
        if (fall.running) {
          fall.t += dt;
          if (fall.yCoin < tubeH_m) {
            const dragC = fall.vacuum ? 0 : 0.004 * fall.vCoin * fall.vCoin;
            fall.vCoin += (g - dragC) * dt;
            fall.yCoin = Math.min(tubeH_m, fall.yCoin + fall.vCoin * dt);
          }
          if (fall.yFeather < tubeH_m) {
            const dragF = fall.vacuum ? 0 : 1.15 * fall.vFeather * fall.vFeather;
            fall.vFeather += Math.max(0, g - dragF) * dt;
            fall.yFeather = Math.min(tubeH_m, fall.yFeather + fall.vFeather * dt);
          }
          if (fall.yCoin >= tubeH_m && fall.yFeather >= tubeH_m) fall.running = false;
        }

        drawGrid(ctx, w, h, 30);
        const tubeW = Math.min(260, w * 0.55);
        const tx = (w - tubeW) / 2, ty = 34, th = h - 68;

        // Glass tube
        ctx.fillStyle = fall.vacuum ? 'rgba(56, 189, 248, 0.05)' : 'rgba(148, 163, 184, 0.14)';
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.5)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(tx, ty, tubeW, th, 16);
        ctx.fill();
        ctx.stroke();

        // Air particles if not vacuum
        if (!fall.vacuum) {
          ctx.fillStyle = 'rgba(148, 163, 184, 0.35)';
          for (let i = 0; i < 32; i++) {
            const px = tx + 14 + ((i * 73) % (tubeW - 28));
            const py = ty + 18 + ((i * 59 + Math.floor(now * 0.02)) % (th - 36));
            ctx.beginPath(); ctx.arc(px, py, 2, 0, Math.PI * 2); ctx.fill();
          }
        }

        const topY = ty + 28, botY = ty + th - 26;
        const cy = topY + (fall.yCoin / tubeH_m) * (botY - topY);
        const fy = topY + (fall.yFeather / tubeH_m) * (botY - topY);

        // Coin
        const cx = tx + tubeW * 0.32;
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath(); ctx.arc(cx, cy, 13, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = '#78350f'; ctx.font = 'bold 11px sans-serif'; ctx.fillText('฿', cx - 3.5, cy + 4);

        // Feather
        const fx = tx + tubeW * 0.68;
        ctx.save();
        ctx.translate(fx, fy);
        ctx.rotate(fall.vacuum ? 0 : Math.sin(fall.t * 4) * 0.35);
        ctx.fillStyle = '#e2e8f0';
        ctx.beginPath();
        ctx.ellipse(0, 0, 20, 7, -0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(-22, 2); ctx.lineTo(20, -2); ctx.stroke();
        ctx.restore();

        // Labels
        ctx.fillStyle = '#f8fafc';
        ctx.font = '600 13px "Prompt", sans-serif';
        ctx.fillText(fall.vacuum ? '🌌 สุญญากาศ: ไม่มีแรงต้านอากาศ (a = g เท่ากัน!)' : '💨 มีอากาศ: ขนนกถึงความเร็วปลายเร็วมาก', 20, 22);

        setReadouts(ui.readouts, [
          { label: 'ระยะตกเหรียญ', value: `${fall.yCoin.toFixed(1)} / 20 m`, color: '#fbbf24' },
          { label: 'ความเร็วเหรียญ', value: `${fall.vCoin.toFixed(1)} m/s`, color: '#fbbf24' },
          { label: 'ระยะตกขนนก', value: `${fall.yFeather.toFixed(1)} / 20 m`, color: '#38bdf8' },
          { label: 'ความเร็วขนนก', value: `${fall.vFeather.toFixed(1)} m/s`, color: '#38bdf8' }
        ]);
      }

      rafId = requestAnimationFrame(render);
    }

    function drawMiniGraph(ctx, x, y, w, h, data, key, title, color, minVal, maxVal, fillArea = false) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(x, y, w, h, 10); ctx.fill(); ctx.stroke();

      ctx.fillStyle = '#cbd5e1';
      ctx.font = '600 12px "Prompt", sans-serif';
      ctx.fillText(title, x + 10, y + 18);

      const padL = 34, padR = 12, padT = 28, padB = 20;
      const gx = x + padL, gy = y + padT, gw = w - padL - padR, gh = h - padT - padB;
      const zeroY = gy + gh * (maxVal / (maxVal - minVal));

      ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
      ctx.beginPath();
      ctx.moveTo(gx, zeroY); ctx.lineTo(gx + gw, zeroY);
      ctx.moveTo(gx, gy); ctx.lineTo(gx, gy + gh);
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      ctx.font = '10px "JetBrains Mono"';
      ctx.fillText('0', gx - 14, zeroY + 3);
      ctx.fillText('10s', gx + gw - 16, gy + gh + 13);

      if (data.length > 1) {
        if (fillArea) {
          ctx.fillStyle = 'rgba(52, 211, 153, 0.16)';
          ctx.beginPath();
          ctx.moveTo(gx, zeroY);
          data.forEach(pt => {
            const px = gx + (pt.t / 10) * gw;
            const val = Math.max(minVal, Math.min(maxVal, pt[key]));
            const py = gy + gh * ((maxVal - val) / (maxVal - minVal));
            ctx.lineTo(px, py);
          });
          const lastX = gx + (data[data.length - 1].t / 10) * gw;
          ctx.lineTo(lastX, zeroY);
          ctx.closePath();
          ctx.fill();
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        data.forEach((pt, idx) => {
          const px = gx + (pt.t / 10) * gw;
          const val = Math.max(minVal, Math.min(maxVal, pt[key]));
          const py = gy + gh * ((maxVal - val) / (maxVal - minVal));
          if (idx === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        });
        ctx.stroke();
      }
    }

    rafId = requestAnimationFrame(render);
  }

  /* ================= SIM 3: PROJECTILE MOTION ================= */
  function initProjectile(ui) {
    const state = { v0: 28, angle: 45, h0: 0, showVec: true, dropRef: false, running: false, t: 0, trail: [], ghosts: [] };
    const g = 9.81;

    ui.modes.innerHTML = `<span class="meta-tag">g = 9.81 m/s² (ไม่คิดแรงต้านอากาศ)</span>`;
    ui.controls.innerHTML = '';
    ui.controls.append(
      makeSlider('v0', 'ความเร็วต้น v₀', 10, 40, 1, state.v0, 'm/s', v => { state.v0 = v; }),
      makeSlider('ang', 'มุมยิง θ', 0, 85, 5, state.angle, '°', v => { state.angle = v; }),
      makeSlider('h0', 'ความสูงหน้าผา h₀', 0, 45, 5, state.h0, 'm', v => { state.h0 = v; })
    );

    ui.actions.innerHTML = `
      <button class="btn btn-sm btn-primary" id="btn-fire">🚀 ยิงโพรเจกไทล์!</button>
      <button class="btn btn-sm" id="btn-dropref">⚪ เปิด/ปิด ลูกบอลตกเสรีเทียบ</button>
      <button class="btn btn-sm" id="btn-vec">↗️ เวกเตอร์ vx, vy</button>
      <button class="btn btn-sm btn-rose" id="btn-clear">🗑 ล้างเส้นเก่า</button>
    `;

    function fire() {
      if (state.trail.length > 2) {
        state.ghosts.push({ pts: [...state.trail], label: `${state.angle}° (${state.v0}m/s)` });
        if (state.ghosts.length > 4) state.ghosts.shift();
      }
      state.t = 0;
      state.trail = [];
      state.running = true;
    }

    ui.actions.querySelector('#btn-fire').onclick = fire;
    ui.actions.querySelector('#btn-dropref').onclick = () => { state.dropRef = !state.dropRef; fire(); };
    ui.actions.querySelector('#btn-vec').onclick = () => { state.showVec = !state.showVec; };
    ui.actions.querySelector('#btn-clear').onclick = () => { state.ghosts = []; state.trail = []; state.running = false; state.t = 0; };

    fire();

    let last = performance.now();
    function render(now) {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const { ctx, w, h } = setupCanvas(ui.canvas);
      ctx.fillStyle = '#090e1a';
      ctx.fillRect(0, 0, w, h);
      drawGrid(ctx, w, h, 32);

      const groundY = h - 36;
      const startX = 54;
      const maxRangeM = 170;
      const pxPerM = Math.min((w - 84) / maxRangeM, (groundY - 40) / 85);

      // Ground & Cliff
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, groundY, w, 36);
      if (state.h0 > 0) {
        ctx.fillStyle = '#334155';
        ctx.fillRect(0, groundY - state.h0 * pxPerM, startX, state.h0 * pxPerM);
      }

      const rad = state.angle * Math.PI / 180;
      const vx0 = state.v0 * Math.cos(rad);
      const vy0 = state.v0 * Math.sin(rad);
      const totalT = (vy0 + Math.sqrt(vy0 * vy0 + 2 * g * state.h0)) / g;
      const maxH = state.h0 + (vy0 * vy0) / (2 * g);
      const range = vx0 * totalT;

      if (state.running) {
        state.t += dt * 1.4;
        if (state.t >= totalT) {
          state.t = totalT;
          state.running = false;
        }
        const xm = vx0 * state.t;
        const ym = Math.max(0, state.h0 + vy0 * state.t - 0.5 * g * state.t * state.t);
        state.trail.push({ x: xm, y: ym });
      }

      // Draw ghost trails
      const ghostColors = ['rgba(167,139,250,0.55)', 'rgba(251,191,36,0.55)', 'rgba(251,113,133,0.55)', 'rgba(52,211,153,0.55)'];
      state.ghosts.forEach((gh, idx) => {
        ctx.save();
        ctx.strokeStyle = ghostColors[idx % ghostColors.length];
        ctx.setLineDash([5, 5]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        gh.pts.forEach((p, i) => {
          const px = startX + p.x * pxPerM, py = groundY - p.y * pxPerM;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        });
        ctx.stroke();
        const mid = gh.pts[Math.floor(gh.pts.length / 2)];
        if (mid) {
          ctx.fillStyle = ghostColors[idx % ghostColors.length];
          ctx.font = '11px "JetBrains Mono"';
          ctx.fillText(gh.label, startX + mid.x * pxPerM, groundY - mid.y * pxPerM - 8);
        }
        ctx.restore();
      });

      // Draw current trail
      if (state.trail.length > 1) {
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        state.trail.forEach((p, i) => {
          const px = startX + p.x * pxPerM, py = groundY - p.y * pxPerM;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        });
        ctx.stroke();
      }

      const curX = vx0 * state.t;
      const curY = Math.max(0, state.h0 + vy0 * state.t - 0.5 * g * state.t * state.t);
      const curVy = vy0 - g * state.t;
      const ballPx = startX + curX * pxPerM;
      const ballPy = groundY - curY * pxPerM;

      // Cannon barrel
      const cannonY = groundY - state.h0 * pxPerM;
      ctx.save();
      ctx.translate(startX, cannonY);
      ctx.rotate(-rad);
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(0, -6, 26, 12);
      ctx.restore();

      // Reference free fall ball
      if (state.dropRef) {
        const dropY = Math.max(0, state.h0 + vy0 * state.t - 0.5 * g * state.t * state.t);
        const dropPy = groundY - dropY * pxPerM;
        ctx.save();
        ctx.setLineDash([3, 4]);
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.45)';
        ctx.beginPath(); ctx.moveTo(startX, dropPy); ctx.lineTo(ballPx, ballPy); ctx.stroke();
        ctx.restore();
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath(); ctx.arc(startX, dropPy, 7, 0, Math.PI * 2); ctx.fill();
      }

      // Main projectile ball
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath(); ctx.arc(ballPx, ballPy, 8, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke();

      if (state.showVec && state.t < totalT) {
        const vs = 1.6;
        drawArrow(ctx, ballPx, ballPy, ballPx + vx0 * vs, ballPy, '#34d399', 2, 'vx', { x: 4, y: 14 });
        drawArrow(ctx, ballPx, ballPy, ballPx, ballPy - curVy * vs, '#fb7185', 2, 'vy', { x: -24, y: 0 });
        drawArrow(ctx, ballPx, ballPy, ballPx + vx0 * vs, ballPy - curVy * vs, '#fbbf24', 2.4, 'v', { x: 6, y: -6 });
      }

      // Distance scale ticks
      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px "JetBrains Mono"';
      for (let m = 0; m <= 160; m += 20) {
        const tx = startX + m * pxPerM;
        if (tx < w - 15) ctx.fillText(`${m}m`, tx - 8, groundY + 20);
      }

      setReadouts(ui.readouts, [
        { label: 'ระยะตกไกลสุด (Range)', value: `${range.toFixed(1)} m`, color: '#38bdf8' },
        { label: 'ความสูงสูงสุด (Hmax)', value: `${maxH.toFixed(1)} m`, color: '#34d399' },
        { label: 'เวลาลอยตัวทั้งหมด', value: `${totalT.toFixed(2)} s`, color: '#fbbf24' },
        { label: 'ความเร็ว (vx, vy) ขณะนี้', value: `(${vx0.toFixed(1)}, ${curVy.toFixed(1)}) m/s`, color: '#a78bfa' }
      ]);

      rafId = requestAnimationFrame(render);
    }
    rafId = requestAnimationFrame(render);
  }

  /* ================= SIM 4: NEWTON'S LAWS & INCLINED PLANE ================= */
  function initNewton(ui) {
    const state = { angle: 30, mass: 5, mu: 0.35, pushUp: 0, pos: 0.5, vel: 0, running: true };
    const g = 10;

    ui.modes.innerHTML = `<span class="meta-tag">g = 10 m/s² | แผนภาพวัตถุอิสระ (FBD) แบบเรียลไทม์</span>`;
    ui.controls.innerHTML = '';
    ui.controls.append(
      makeSlider('ang', 'มุมพื้นเอียง θ', 0, 60, 1, state.angle, '°', v => { state.angle = v; }),
      makeSlider('mass', 'มวลกล่อง m', 1, 15, 1, state.mass, 'kg', v => { state.mass = v; }),
      makeSlider('mu', 'สัมประสิทธิ์แรงเสียดทาน μ', 0, 1.0, 0.05, state.mu, '', v => { state.mu = v; }),
      makeSlider('push', 'แรงดึงขึ้นตามพื้นเอียง F', 0, 120, 5, state.pushUp, 'N', v => { state.pushUp = v; })
    );

    ui.actions.innerHTML = `
      <button class="btn btn-sm btn-primary" id="btn-reset">🔄 วางกล่องกลับตรงกลาง</button>
    `;
    ui.actions.querySelector('#btn-reset').onclick = () => { state.pos = 0.5; state.vel = 0; };

    let last = performance.now();
    function render(now) {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const { ctx, w, h } = setupCanvas(ui.canvas);
      ctx.fillStyle = '#090e1a';
      ctx.fillRect(0, 0, w, h);
      drawGrid(ctx, w, h, 30);

      const rad = state.angle * Math.PI / 180;
      const mg = state.mass * g;
      const mgSin = mg * Math.sin(rad);
      const mgCos = mg * Math.cos(rad);
      const N = mgCos;
      const fMax = state.mu * N;

      // Net tendency along slope (+ is UP slope, - is DOWN slope)
      const drive = state.pushUp - mgSin;
      let friction = 0; // + is UP slope, - is DOWN slope
      let acc = 0;
      let status = '';

      if (Math.abs(state.vel) < 0.05 && Math.abs(drive) <= fMax) {
        friction = -drive;
        acc = 0;
        state.vel = 0;
        status = 'หยุดนิ่ง (สมดุล — แรงเสียดทานสถิตต้านไว้)';
      } else {
        const dir = Math.abs(state.vel) >= 0.05 ? Math.sign(state.vel) : Math.sign(drive);
        friction = -dir * fMax;
        acc = (drive + friction) / state.mass;
        state.vel += acc * dt;
        state.pos += state.vel * dt * 0.04;
        if (state.pos < 0.14) { state.pos = 0.14; state.vel = 0; }
        if (state.pos > 0.86) { state.pos = 0.86; state.vel = 0; }
        status = acc > 0.05 ? 'ไถลขึ้นพื้นเอียง ↗️' : (acc < -0.05 ? 'ไถลลงพื้นเอียง ↙️' : 'เคลื่อนที่ความเร็วคงที่');
      }

      // Draw inclined plane
      const baseLen = Math.min(w * 0.68, 460);
      const slopeLen = baseLen;
      const x0 = (w - baseLen) / 2 + 20;
      const y0 = h - 55;
      const xTop = x0 + slopeLen * Math.cos(rad);
      const yTop = y0 - slopeLen * Math.sin(rad);

      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(xTop, y0);
      ctx.lineTo(xTop, yTop);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Angle arc
      ctx.strokeStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(x0, y0, 38, -rad, 0);
      ctx.stroke();
      ctx.fillStyle = '#fbbf24';
      ctx.font = '600 13px "JetBrains Mono"';
      ctx.fillText(`θ=${state.angle}°`, x0 + 44, y0 - 8);

      // Block center
      const bx = x0 + (xTop - x0) * state.pos;
      const by = y0 + (yTop - y0) * state.pos;
      const bSize = 44;
      const cx = bx - Math.sin(rad) * (bSize / 2);
      const cy = by - Math.cos(rad) * (bSize / 2);

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-rad);
      ctx.fillStyle = '#0284c7';
      ctx.strokeStyle = '#7dd3fc';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-bSize / 2, -bSize / 2, bSize, bSize, 6);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px "JetBrains Mono"';
      ctx.textAlign = 'center';
      ctx.fillText(`${state.mass}kg`, 0, 5);
      ctx.restore();

      // Force Vectors (scale)
      const fs = 1.3;
      // mg downward
      drawArrow(ctx, cx, cy, cx, cy + Math.min(115, mg * fs), '#fb7185', 2.8, `mg=${mg.toFixed(0)}N`, { x: 8, y: 12 });
      // Normal force N
      const nx = -Math.sin(rad) * Math.min(110, N * fs);
      const ny = -Math.cos(rad) * Math.min(110, N * fs);
      drawArrow(ctx, cx, cy, cx + nx, cy + ny, '#34d399', 2.8, `N=${N.toFixed(1)}N`, { x: -55, y: -6 });
      // Friction f
      if (Math.abs(friction) > 0.2) {
        const fx = Math.cos(rad) * friction * fs;
        const fy = -Math.sin(rad) * friction * fs;
        drawArrow(ctx, cx, cy, cx + fx, cy + fy, '#fbbf24', 2.8, `f=${Math.abs(friction).toFixed(1)}N`, { x: 6, y: -14 });
      }
      // Push F
      if (state.pushUp > 0) {
        const px = Math.cos(rad) * Math.min(115, state.pushUp * fs);
        const py = -Math.sin(rad) * Math.min(115, state.pushUp * fs);
        drawArrow(ctx, cx, cy, cx + px, cy + py, '#a78bfa', 3, `F=${state.pushUp}N`, { x: 10, y: 16 });
      }

      ctx.fillStyle = '#f8fafc';
      ctx.font = '600 14px "Prompt", sans-serif';
      ctx.fillText(`สถานะ: ${status}`, 20, 28);

      setReadouts(ui.readouts, [
        { label: 'แรงดึงลงตามพื้นเอียง (mg sin θ)', value: `${mgSin.toFixed(1)} N`, color: '#fb7185' },
        { label: 'แรงเสียดทานสูงสุด (μN)', value: `${fMax.toFixed(1)} N`, color: '#fbbf24' },
        { label: 'แรงแนวฉาก (N = mg cos θ)', value: `${N.toFixed(1)} N`, color: '#34d399' },
        { label: 'ความเร่งสุทธิ (a)', value: `${acc.toFixed(2)} m/s²`, color: '#38bdf8' }
      ]);

      rafId = requestAnimationFrame(render);
    }
    rafId = requestAnimationFrame(render);
  }

  /* ================= SIM 5: CIRCULAR MOTION & MOMENTS ================= */
  function initCircular(ui) {
    let mode = 'circle';
    const circ = { m: 2, v: 6, r: 2.5, theta: 0, cut: false, bx: 0, by: 0, vx: 0, vy: 0, trail: [] };
    const lever = { m1: 4, d1: 2.0, m2: 2, d2: 3.0, tilt: 0 };

    ui.modes.innerHTML = `
      <button class="mode-btn active" data-m="circle">🌀 แกว่งวงกลม & ทดลองตัดเชือก</button>
      <button class="mode-btn" data-m="lever">⚖️ คานสมดุล & กฎของโมเมนต์</button>
    `;

    function buildUI() {
      ui.controls.innerHTML = '';
      if (mode === 'circle') {
        ui.controls.append(
          makeSlider('cm', 'มวลลูกบอล m', 0.5, 5, 0.5, circ.m, 'kg', v => circ.m = v),
          makeSlider('cv', 'อัตราเร็ว v', 2, 12, 0.5, circ.v, 'm/s', v => circ.v = v),
          makeSlider('cr', 'รัศมีเชือก r', 1.0, 4.0, 0.25, circ.r, 'm', v => circ.r = v)
        );
        ui.actions.innerHTML = `
          <button class="btn btn-sm btn-rose" id="btn-cut">✂️ ตัดเชือกเดี๋ยวนี้!</button>
          <button class="btn btn-sm btn-primary" id="btn-reattach">🔄 ผูกเชือกใหม่</button>
        `;
        ui.actions.querySelector('#btn-cut').onclick = () => {
          if (!circ.cut) {
            circ.cut = true;
            circ.trail = [{ x: circ.bx, y: circ.by }];
          }
        };
        ui.actions.querySelector('#btn-reattach').onclick = () => { circ.cut = false; circ.trail = []; };
      } else {
        ui.controls.append(
          makeSlider('lm1', 'มวลฝั่งซ้าย m₁', 1, 10, 0.5, lever.m1, 'kg', v => lever.m1 = v),
          makeSlider('ld1', 'ระยะฝั่งซ้าย d₁', 0.5, 4.0, 0.25, lever.d1, 'm', v => lever.d1 = v),
          makeSlider('lm2', 'มวลฝั่งขวา m₂', 1, 10, 0.5, lever.m2, 'kg', v => lever.m2 = v),
          makeSlider('ld2', 'ระยะฝั่งขวา d₂', 0.5, 4.0, 0.25, lever.d2, 'm', v => lever.d2 = v)
        );
        ui.actions.innerHTML = `
          <button class="btn btn-sm btn-emerald" id="btn-bal">⚖️ จัดให้สมดุลอัตโนมัติ</button>
        `;
        ui.actions.querySelector('#btn-bal').onclick = () => {
          lever.d2 = Math.min(4, Math.max(0.5, Number(((lever.m1 * lever.d1) / lever.m2).toFixed(2))));
          buildUI();
        };
      }
    }

    ui.modes.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        ui.modes.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        mode = btn.dataset.m;
        circ.cut = false; circ.trail = [];
        buildUI();
      });
    });
    buildUI();

    let last = performance.now();
    function render(now) {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const { ctx, w, h } = setupCanvas(ui.canvas);
      ctx.fillStyle = '#090e1a';
      ctx.fillRect(0, 0, w, h);
      drawGrid(ctx, w, h, 30);

      if (mode === 'circle') {
        const cx = w * 0.5, cy = h * 0.5;
        const pxR = circ.r * 34;
        const omega = circ.v / circ.r;
        const ac = (circ.v * circ.v) / circ.r;
        const Fc = circ.m * ac;

        // Orbit guide
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.28)';
        ctx.setLineDash([6, 6]);
        ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(cx, cy, pxR, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);

        // Center pivot
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2); ctx.fill();

        if (!circ.cut) {
          circ.theta += omega * dt * 0.7;
          circ.bx = cx + pxR * Math.cos(circ.theta);
          circ.by = cy + pxR * Math.sin(circ.theta);
          // Tangent direction (clockwise in canvas y-down)
          circ.vx = -Math.sin(circ.theta) * circ.v * 24;
          circ.vy = Math.cos(circ.theta) * circ.v * 24;

          // String
          ctx.strokeStyle = '#e2e8f0';
          ctx.lineWidth = 2.4;
          ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(circ.bx, circ.by); ctx.stroke();

          // Fc arrow inward
          const fx = (cx - circ.bx) / pxR * Math.min(pxR - 14, Fc * 2.2);
          const fy = (cy - circ.by) / pxR * Math.min(pxR - 14, Fc * 2.2);
          drawArrow(ctx, circ.bx, circ.by, circ.bx + fx, circ.by + fy, '#fb7185', 2.8, 'Fc');
        } else {
          circ.bx += circ.vx * dt;
          circ.by += circ.vy * dt;
          circ.trail.push({ x: circ.bx, y: circ.by });
          if (circ.trail.length > 120) circ.trail.shift();

          ctx.strokeStyle = '#34d399';
          ctx.lineWidth = 2.4;
          ctx.beginPath();
          circ.trail.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
          ctx.stroke();

          ctx.fillStyle = '#34d399';
          ctx.font = '600 14px "Prompt", sans-serif';
          ctx.fillText('✂️ เชือกขาด! วัตถุพุ่งตรงตามแนวเส้นสัมผัส (กฎข้อ 1 นิวตัน)', 20, 28);
        }

        // Velocity tangent arrow
        const vNorm = Math.hypot(circ.vx, circ.vy) || 1;
        drawArrow(ctx, circ.bx, circ.by, circ.bx + (circ.vx / vNorm) * 52, circ.by + (circ.vy / vNorm) * 52, '#34d399', 2.6, 'v');

        // Ball
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath(); ctx.arc(circ.bx, circ.by, 12, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke();

        setReadouts(ui.readouts, [
          { label: 'ความเร่งสู่ศูนย์กลาง ac = v²/r', value: `${ac.toFixed(1)} m/s²`, color: '#fbbf24' },
          { label: 'แรงสู่ศูนย์กลาง Fc = mv²/r', value: `${Fc.toFixed(1)} N`, color: '#fb7185' },
          { label: 'คาบการหมุน T = 2πr/v', value: `${(2 * Math.PI * circ.r / circ.v).toFixed(2)} s`, color: '#38bdf8' },
          { label: 'สถานะเชือก', value: circ.cut ? 'ขาดแล้ว (วิ่งตรง!)' : 'ตึง (วงกลม)', color: circ.cut ? '#34d399' : '#a78bfa' }
        ]);
      } else {
        // See-Saw Law of Moments
        const g = 10;
        const mAnti = lever.m1 * g * lever.d1;
        const mClock = lever.m2 * g * lever.d2;
        const diff = mClock - mAnti;
        const balanced = Math.abs(diff) < 1.5;
        const targetTilt = balanced ? 0 : Math.max(-0.28, Math.min(0.28, diff * 0.004));
        lever.tilt += (targetTilt - lever.tilt) * 0.1;

        const cx = w * 0.5, cy = h * 0.62;
        const halfLen = Math.min(w * 0.42, 240);
        const pxPerM = halfLen / 4.2;

        // Fulcrum triangle
        ctx.fillStyle = balanced ? '#34d399' : '#94a3b8';
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx - 26, cy + 54);
        ctx.lineTo(cx + 26, cy + 54);
        ctx.closePath();
        ctx.fill();

        // Beam
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(lever.tilt);
        ctx.fillStyle = balanced ? '#059669' : '#334155';
        ctx.strokeStyle = balanced ? '#6ee7b7' : '#64748b';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.roundRect(-halfLen, -8, halfLen * 2, 16, 6); ctx.fill(); ctx.stroke();

        // Ruler ticks
        ctx.fillStyle = '#cbd5e1'; ctx.font = '10px "JetBrains Mono"';
        for (let d = 1; d <= 4; d++) {
          ctx.fillRect(-d * pxPerM, -8, 1.5, 6);
          ctx.fillRect(d * pxPerM, -8, 1.5, 6);
          ctx.fillText(`${d}m`, -d * pxPerM - 8, 22);
          ctx.fillText(`${d}m`, d * pxPerM - 8, 22);
        }

        // Left mass m1
        const s1 = 24 + lever.m1 * 2.5;
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath(); ctx.roundRect(-lever.d1 * pxPerM - s1 / 2, -8 - s1, s1, s1, 6); ctx.fill();
        ctx.fillStyle = '#0b1120'; ctx.font = 'bold 12px "JetBrains Mono"'; ctx.textAlign = 'center';
        ctx.fillText(`${lever.m1}kg`, -lever.d1 * pxPerM, -8 - s1 / 2 + 4);

        // Right mass m2
        const s2 = 24 + lever.m2 * 2.5;
        ctx.fillStyle = '#a78bfa';
        ctx.beginPath(); ctx.roundRect(lever.d2 * pxPerM - s2 / 2, -8 - s2, s2, s2, 6); ctx.fill();
        ctx.fillStyle = '#0b1120';
        ctx.fillText(`${lever.m2}kg`, lever.d2 * pxPerM, -8 - s2 / 2 + 4);
        ctx.restore();

        ctx.fillStyle = balanced ? '#34d399' : '#fbbf24';
        ctx.font = '600 15px "Prompt", sans-serif';
        ctx.fillText(balanced ? '✅ คานอยู่ในสมดุลกล! (ΣMทวน = ΣMตาม)' : (diff > 0 ? '↘️ เอียงตามเข็มนาฬิกา (ฝั่งขวามากกว่า)' : '↙️ เอียงทวนเข็มนาฬิกา (ฝั่งซ้ายมากกว่า)'), 20, 30);

        setReadouts(ui.readouts, [
          { label: 'โมเมนต์ทวนเข็ม (ซ้าย)', value: `${mAnti.toFixed(1)} N·m`, color: '#38bdf8' },
          { label: 'โมเมนต์ตามเข็ม (ขวา)', value: `${mClock.toFixed(1)} N·m`, color: '#a78bfa' },
          { label: 'แรงปฏิกิริยาที่จุดหมุน R', value: `${((lever.m1 + lever.m2) * g).toFixed(0)} N`, color: '#fbbf24' },
          { label: 'สถานะสมดุล', value: balanced ? 'สมดุล (Equilibrium)' : 'ไม่สมดุล', color: balanced ? '#34d399' : '#fb7185' }
        ]);
      }

      rafId = requestAnimationFrame(render);
    }
    rafId = requestAnimationFrame(render);
  }

  /* ================= SIM 6: ENERGY & COLLISIONS ================= */
  function initEnergy(ui) {
    let mode = 'roller';
    const roller = { hStart: 0.9, friction: 0.0, s: 0.08, v: 0, thermal: 0, m: 2 };
    const col = { m1: 3, v1: 6, m2: 3, v2: 0, elastic: true, x1: 0.22, x2: 0.62, collided: false, curV1: 6, curV2: 0, running: true };

    ui.modes.innerHTML = `
      <button class="mode-btn active" data-m="roller">🎢 รถไฟเหาะอนุรักษ์พลังงาน</button>
      <button class="mode-btn" data-m="collision">💥 การชน 1 มิติ & โมเมนตัม</button>
    `;

    function trackY(u) {
      // Smooth rollercoaster curve u in [0, 1], height in [0, 1]
      return 0.45 * Math.cos(Math.PI * 2 * u) + 0.5 + 0.12 * Math.sin(Math.PI * 3 * u);
    }
    function trackSlope(u) {
      const eps = 0.001;
      return (trackY(u + eps) - trackY(u - eps)) / (2 * eps);
    }

    function resetRoller() {
      roller.s = 0.04 + (1 - roller.hStart) * 0.2;
      roller.v = 0;
      roller.thermal = 0;
    }
    function resetCol() {
      col.x1 = 0.20; col.x2 = 0.60;
      col.curV1 = col.v1; col.curV2 = col.v2;
      col.collided = false; col.running = true;
    }

    function buildUI() {
      ui.controls.innerHTML = '';
      if (mode === 'roller') {
        ui.controls.append(
          makeSlider('rh', 'ความสูงจุดปล่อย', 0.3, 1.0, 0.05, roller.hStart, 'ระดับ', v => { roller.hStart = v; resetRoller(); }),
          makeSlider('rf', 'แรงเสียดทานราง', 0, 0.25, 0.02, roller.friction, '', v => { roller.friction = v; })
        );
        ui.actions.innerHTML = `<button class="btn btn-sm btn-primary" id="btn-rel">🔄 ปล่อยลูกบอลใหม่</button>`;
        ui.actions.querySelector('#btn-rel').onclick = resetRoller;
      } else {
        ui.controls.append(
          makeSlider('cm1', 'มวลก้อนที่ 1 (m₁)', 1, 10, 1, col.m1, 'kg', v => { col.m1 = v; resetCol(); }),
          makeSlider('cv1', 'ความเร็วก่อนชน v₁', 1, 10, 1, col.v1, 'm/s', v => { col.v1 = v; resetCol(); }),
          makeSlider('cm2', 'มวลก้อนที่ 2 (m₂)', 1, 10, 1, col.m2, 'kg', v => { col.m2 = v; resetCol(); }),
          makeSlider('cv2', 'ความเร็วก่อนชน v₂', -6, 4, 1, col.v2, 'm/s', v => { col.v2 = v; resetCol(); })
        );
        ui.actions.innerHTML = `
          <button class="btn btn-sm ${col.elastic ? 'btn-primary' : ''}" id="btn-el">🟢 ชนยืดหยุ่น (Elastic)</button>
          <button class="btn btn-sm ${!col.elastic ? 'btn-primary' : ''}" id="btn-inel">🟠 ชนติดกันไป (Inelastic)</button>
          <button class="btn btn-sm" id="btn-recol">🔄 ทดลองชนใหม่</button>
        `;
        ui.actions.querySelector('#btn-el').onclick = () => { col.elastic = true; resetCol(); buildUI(); };
        ui.actions.querySelector('#btn-inel').onclick = () => { col.elastic = false; resetCol(); buildUI(); };
        ui.actions.querySelector('#btn-recol').onclick = resetCol;
      }
    }

    ui.modes.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        ui.modes.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        mode = btn.dataset.m;
        resetRoller(); resetCol(); buildUI();
      });
    });
    buildUI();

    let last = performance.now();
    function render(now) {
      const dt = Math.min((now - last) / 1000, 0.04);
      last = now;
      const { ctx, w, h } = setupCanvas(ui.canvas);
      ctx.fillStyle = '#090e1a';
      ctx.fillRect(0, 0, w, h);
      drawGrid(ctx, w, h, 30);

      if (mode === 'roller') {
        const g = 10, maxH = 12; // 12 meters scale
        const trackW = w * 0.66;
        const tx0 = 28, baseY = h - 42, heightPx = h - 105;

        // Physics sub-steps
        for (let k = 0; k < 4; k++) {
          const dts = dt / 4;
          const slope = trackSlope(roller.s);
          const angle = Math.atan(slope * 0.7);
          const aTan = -g * Math.sin(angle) - roller.friction * g * Math.cos(angle) * Math.sign(roller.v);
          const prevV = roller.v;
          roller.v += aTan * dts;
          if (roller.friction > 0 && prevV * roller.v < 0 && Math.abs(Math.sin(angle)) < roller.friction) {
            roller.v = 0;
          }
          roller.s += roller.v * dts * 0.032;
          if (roller.s < 0.03) { roller.s = 0.03; roller.v = Math.abs(roller.v) * 0.9; }
          if (roller.s > 0.97) { roller.s = 0.97; roller.v = -Math.abs(roller.v) * 0.9; }
        }

        // Draw track
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 5;
        ctx.beginPath();
        for (let i = 0; i <= 100; i++) {
          const u = i / 100;
          const px = tx0 + u * trackW;
          const py = baseY - trackY(u) * heightPx;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke();

        const curH = trackY(roller.s) * maxH;
        const Ep = roller.m * g * curH;
        const Ek = 0.5 * roller.m * roller.v * roller.v;
        const startH = trackY(0.04 + (1 - roller.hStart) * 0.2) * maxH;
        const Etot = Math.max(Ep + Ek, roller.m * g * startH);
        const Etherm = Math.max(0, Etot - (Ep + Ek));

        // Draw ball
        const bx = tx0 + roller.s * trackW;
        const by = baseY - trackY(roller.s) * heightPx - 12;
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath(); ctx.arc(bx, by, 11, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke();

        // Live Energy Bar Chart on right
        const chartX = tx0 + trackW + 26;
        const chartW = w - chartX - 18;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
        ctx.beginPath(); ctx.roundRect(chartX, 28, chartW, h - 56, 12); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#e2e8f0'; ctx.font = '600 12px "Prompt"';
        ctx.fillText('กราฟพลังงาน (J)', chartX + 12, 50);

        const bars = [
          { lbl: 'Ek', val: Ek, col: '#34d399' },
          { lbl: 'Ep', val: Ep, col: '#38bdf8' },
          { lbl: 'ความร้อน', val: Etherm, col: '#fb7185' },
          { lbl: 'รวม', val: Etot, col: '#a78bfa' }
        ];
        const barMaxH = h - 130;
        const bw = Math.max(18, (chartW - 44) / 4 - 6);
        bars.forEach((b, idx) => {
          const x = chartX + 16 + idx * (bw + 8);
          const bh = Math.min(barMaxH, (b.val / Math.max(Etot, 1)) * barMaxH);
          ctx.fillStyle = b.col;
          ctx.beginPath(); ctx.roundRect(x, h - 56 - bh, bw, bh, 5); ctx.fill();
          ctx.fillStyle = '#cbd5e1'; ctx.font = '10px "Prompt"';
          ctx.fillText(b.lbl, x, h - 38);
        });

        setReadouts(ui.readouts, [
          { label: 'พลังงานจลน์ (Ek)', value: `${Ek.toFixed(1)} J`, color: '#34d399' },
          { label: 'พลังงานศักย์ (Ep)', value: `${Ep.toFixed(1)} J`, color: '#38bdf8' },
          { label: 'พลังงานความร้อน', value: `${Etherm.toFixed(1)} J`, color: '#fb7185' },
          { label: 'พลังงานรวม (Etotal)', value: `${Etot.toFixed(1)} J`, color: '#a78bfa' }
        ]);
      } else {
        // 1D Collision
        const trackY = h * 0.56;
        const w1 = 38 + col.m1 * 4;
        const w2 = 38 + col.m2 * 4;
        const pxPerUnit = w;

        if (col.running) {
          col.x1 += col.curV1 * dt * 0.045;
          col.x2 += col.curV2 * dt * 0.045;

          const right1 = col.x1 * pxPerUnit + w1 / 2;
          const left2 = col.x2 * pxPerUnit - w2 / 2;

          if (!col.collided && right1 >= left2) {
            col.collided = true;
            if (col.elastic) {
              const v1f = ((col.m1 - col.m2) * col.v1 + 2 * col.m2 * col.v2) / (col.m1 + col.m2);
              const v2f = ((col.m2 - col.m1) * col.v2 + 2 * col.m1 * col.v1) / (col.m1 + col.m2);
              col.curV1 = v1f; col.curV2 = v2f;
            } else {
              const vf = (col.m1 * col.v1 + col.m2 * col.v2) / (col.m1 + col.m2);
              col.curV1 = vf; col.curV2 = vf;
            }
          }
          if (col.x1 < 0.04 || col.x2 > 0.96 || col.x1 > 0.96 || col.x2 < 0.04) col.running = false;
        }

        // Rail
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(20, trackY + 26, w - 40, 10);

        const c1x = col.x1 * pxPerUnit, c2x = col.x2 * pxPerUnit;
        // Cart 1
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath(); ctx.roundRect(c1x - w1 / 2, trackY - 24, w1, 48, 8); ctx.fill();
        ctx.fillStyle = '#0b1120'; ctx.font = 'bold 13px "JetBrains Mono"'; ctx.textAlign = 'center';
        ctx.fillText(`${col.m1}kg`, c1x, trackY + 5);
        drawArrow(ctx, c1x, trackY - 38, c1x + col.curV1 * 8, trackY - 38, '#38bdf8', 2.6, `${col.curV1.toFixed(1)}m/s`);

        // Cart 2
        ctx.fillStyle = '#a78bfa';
        ctx.beginPath(); ctx.roundRect(c2x - w2 / 2, trackY - 24, w2, 48, 8); ctx.fill();
        ctx.fillStyle = '#0b1120';
        ctx.fillText(`${col.m2}kg`, c2x, trackY + 5);
        drawArrow(ctx, c2x, trackY - 38, c2x + col.curV2 * 8, trackY - 38, '#a78bfa', 2.6, `${col.curV2.toFixed(1)}m/s`);
        ctx.textAlign = 'left';

        const pInit = col.m1 * col.v1 + col.m2 * col.v2;
        const pNow = col.m1 * col.curV1 + col.m2 * col.curV2;
        const keInit = 0.5 * col.m1 * col.v1 * col.v1 + 0.5 * col.m2 * col.v2 * col.v2;
        const keNow = 0.5 * col.m1 * col.curV1 * col.curV1 + 0.5 * col.m2 * col.curV2 * col.curV2;

        ctx.fillStyle = col.collided ? '#34d399' : '#fbbf24';
        ctx.font = '600 14px "Prompt"';
        ctx.fillText(col.collided ? (col.elastic ? '💥 ชนยืดหยุ่นแล้ว! โมเมนตัมและ Ek คงที่ทั้งคู่' : '💥 ชนติดกันแล้ว! โมเมนตัมคงที่ แต่ Ek ลดลงเป็นความร้อน') : 'กำลังเคลื่อนที่เข้าชนกัน...', 20, 30);

        setReadouts(ui.readouts, [
          { label: 'โมเมนตัมรวม (ก่อน → หลัง)', value: `${pInit.toFixed(1)} → ${pNow.toFixed(1)} kg·m/s`, color: '#34d399' },
          { label: 'พลังงานจลน์รวม (ก่อน → หลัง)', value: `${keInit.toFixed(1)} → ${keNow.toFixed(1)} J`, color: col.elastic ? '#38bdf8' : '#fb7185' },
          { label: 'ความเร็ว v₁ ขณะนี้', value: `${col.curV1.toFixed(2)} m/s`, color: '#38bdf8' },
          { label: 'ความเร็ว v₂ ขณะนี้', value: `${col.curV2.toFixed(2)} m/s`, color: '#a78bfa' }
        ]);
      }

      rafId = requestAnimationFrame(render);
    }
    rafId = requestAnimationFrame(render);
  }

  /* ================= SIM 7: FLUID PRESSURE & HYDRAULICS ================= */
  function initPressure(ui) {
    let mode = 'tank';
    const tank = { level: 0.85, liquid: 'water' };
    const hyd = { f1: 20, ratio: 10, press: 0 };
    const liquids = {
      oil: { name: 'น้ำมัน (800 kg/m³)', rho: 800, color: 'rgba(251, 191, 36, 0.72)' },
      water: { name: 'น้ำจืด (1,000 kg/m³)', rho: 1000, color: 'rgba(56, 189, 248, 0.72)' },
      mercury: { name: 'ปรอท (13,600 kg/m³)', rho: 13600, color: 'rgba(203, 213, 225, 0.82)' }
    };

    ui.modes.innerHTML = `
      <button class="mode-btn active" data-m="tank">💧 แทงก์น้ำ 3 รู (P = ρgh)</button>
      <button class="mode-btn" data-m="hydraulic">🚗 เครื่องอัดไฮดรอลิก (กฎปาสคาล)</button>
    `;

    function buildUI() {
      ui.controls.innerHTML = '';
      if (mode === 'tank') {
        ui.controls.append(
          makeSlider('tlvl', 'ระดับความสูงของเหลว', 0.35, 1.0, 0.05, tank.level, '(×10m)', v => tank.level = v)
        );
        ui.actions.innerHTML = `
          <button class="btn btn-sm ${tank.liquid === 'oil' ? 'btn-primary' : ''}" data-l="oil">🛢 น้ำมัน</button>
          <button class="btn btn-sm ${tank.liquid === 'water' ? 'btn-primary' : ''}" data-l="water">💧 น้ำ</button>
          <button class="btn btn-sm ${tank.liquid === 'mercury' ? 'btn-primary' : ''}" data-l="mercury">🌡 ปรอท</button>
        `;
        ui.actions.querySelectorAll('button').forEach(b => {
          b.onclick = () => { tank.liquid = b.dataset.l; buildUI(); };
        });
      } else {
        ui.controls.append(
          makeSlider('hf1', 'แรงกดลูกสูบเล็ก f₁', 10, 200, 10, hyd.f1, 'N', v => hyd.f1 = v),
          makeSlider('hr', 'อัตราส่วนพื้นที่ A₂ / A₁', 2, 50, 2, hyd.ratio, 'เท่า', v => hyd.ratio = v)
        );
        ui.actions.innerHTML = `
          <button class="btn btn-sm btn-primary" id="btn-pump">⬇️ กดลูกสูบเล็กลง / ปล่อย</button>
        `;
        ui.actions.querySelector('#btn-pump').onclick = () => { hyd.press = hyd.press > 0.5 ? 0 : 1; };
      }
    }

    ui.modes.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        ui.modes.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        mode = btn.dataset.m;
        buildUI();
      });
    });
    buildUI();

    let animPress = 0;
    let phase = 0;
    function render() {
      phase += 0.12;
      const { ctx, w, h } = setupCanvas(ui.canvas);
      ctx.fillStyle = '#090e1a';
      ctx.fillRect(0, 0, w, h);
      drawGrid(ctx, w, h, 30);

      if (mode === 'tank') {
        const liq = liquids[tank.liquid];
        const tx = 60, ty = 46, tw = 160, th = h - 92;
        const groundY = ty + th;
        const liqH = th * tank.level;
        const surfY = groundY - liqH;

        // Liquid fill
        ctx.fillStyle = liq.color;
        ctx.fillRect(tx + 3, surfY, tw - 6, liqH - 2);

        // Tank outline
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(tx, ty); ctx.lineTo(tx, groundY); ctx.lineTo(tx + tw, groundY); ctx.lineTo(tx + tw, ty);
        ctx.stroke();

        // 3 holes at heights 25%, 50%, 75% from bottom
        const holes = [
          { name: 'รูบน', frac: 0.72 },
          { name: 'รูกลาง', frac: 0.48 },
          { name: 'รูล่างสุด', frac: 0.22 }
        ];
        const pressures = [];

        holes.forEach(ho => {
          const hy = groundY - th * ho.frac;
          const depthPx = hy - surfY;
          const depthM = Math.max(0, (depthPx / th) * 10);
          const P = liq.rho * 10 * depthM; // Pa
          pressures.push({ name: ho.name, P, depthM });

          ctx.fillStyle = '#090e1a';
          ctx.fillRect(tx + tw - 3, hy - 4, 8, 8);

          if (depthPx > 4) {
            const v0 = Math.sqrt(2 * 9.8 * depthM);
            const dropM = ho.frac * 10;
            const tHit = Math.sqrt(2 * dropM / 9.8);
            const reachPx = Math.min(w - (tx + tw) - 30, v0 * tHit * 24);

            ctx.strokeStyle = liq.color;
            ctx.lineWidth = 4;
            ctx.beginPath();
            for (let i = 0; i <= 30; i++) {
              const s = i / 30;
              const px = tx + tw + 4 + s * reachPx;
              const py = hy + s * s * (groundY - hy);
              if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
            ctx.stroke();

            // Moving droplets
            ctx.fillStyle = '#ffffff';
            const dFrac = (phase * 0.08 + ho.frac) % 1;
            const dpx = tx + tw + 4 + dFrac * reachPx;
            const dpy = hy + dFrac * dFrac * (groundY - hy);
            ctx.beginPath(); ctx.arc(dpx, dpy, 3, 0, Math.PI * 2); ctx.fill();
          }
        });

        ctx.fillStyle = '#e2e8f0'; ctx.font = '600 13px "Prompt"';
        ctx.fillText(`ของเหลว: ${liq.name} — ยิ่งลึก ความดัน P = ρgh ยิ่งสูง!`, 20, 26);

        setReadouts(ui.readouts, [
          { label: 'ความดันรูบน', value: `${(pressures[0].P / 1000).toFixed(1)} kPa`, color: '#38bdf8' },
          { label: 'ความดันรูกลาง', value: `${(pressures[1].P / 1000).toFixed(1)} kPa`, color: '#34d399' },
          { label: 'ความดันรูล่างสุด', value: `${(pressures[2].P / 1000).toFixed(1)} kPa`, color: '#fbbf24' },
          { label: 'ความหนาแน่น ρ', value: `${liq.rho} kg/m³`, color: '#a78bfa' }
        ]);
      } else {
        // Hydraulic Lift
        animPress += (hyd.press - animPress) * 0.08;
        const A1 = 0.05; // m²
        const A2 = A1 * hyd.ratio;
        const P = hyd.f1 / A1;
        const F2 = hyd.f1 * hyd.ratio;

        const baseY = h - 42;
        const leftX = w * 0.22, rightX = w * 0.62;
        const w1 = 44, w2 = Math.min(180, 68 + hyd.ratio * 2.2);
        const drop1 = animPress * 58;
        const lift2 = animPress * (58 / Math.sqrt(hyd.ratio)) * 1.4;

        // Fluid U-chamber
        ctx.fillStyle = 'rgba(56, 189, 248, 0.55)';
        ctx.beginPath();
        ctx.rect(leftX, 150 + drop1, w1, baseY - (150 + drop1));
        ctx.rect(leftX, baseY - 46, rightX - leftX + w2, 46);
        ctx.rect(rightX, 180 - lift2, w2, baseY - (180 - lift2));
        ctx.fill();

        // Walls
        ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 4;
        ctx.strokeRect(leftX, 110, w1, baseY - 110);
        ctx.strokeRect(rightX, 110, w2, baseY - 110);

        // Small piston
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(leftX + 2, 140 + drop1, w1 - 4, 14);
        drawArrow(ctx, leftX + w1 / 2, 95 + drop1, leftX + w1 / 2, 138 + drop1, '#fbbf24', 3, `f₁=${hyd.f1}N`, { x: -42, y: 0 });

        // Big piston + Car load
        const p2y = 170 - lift2;
        ctx.fillStyle = '#34d399';
        ctx.fillRect(rightX + 2, p2y, w2 - 4, 16);
        // Car silhouette on big piston
        ctx.fillStyle = '#fb7185';
        ctx.beginPath(); ctx.roundRect(rightX + w2 * 0.15, p2y - 34, w2 * 0.7, 26, 7); ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.font = 'bold 12px "JetBrains Mono"'; ctx.textAlign = 'center';
        ctx.fillText(`F₂ = ${F2} N`, rightX + w2 / 2, p2y - 16);
        ctx.textAlign = 'left';

        ctx.fillStyle = '#e2e8f0'; ctx.font = '600 13px "Prompt"';
        ctx.fillText(`กฎของปาสคาล: ความดัน P = ${(P / 1000).toFixed(2)} kPa ส่งผ่านของเหลวเท่ากันทุกจุด!`, 20, 26);

        setReadouts(ui.readouts, [
          { label: 'แรงกดลูกสูบเล็ก (f₁)', value: `${hyd.f1} N`, color: '#fbbf24' },
          { label: 'แรงยกลูกสูบใหญ่ (F₂)', value: `${F2.toLocaleString()} N`, color: '#34d399' },
          { label: 'ความดันในน้ำมัน (P)', value: `${(P / 1000).toFixed(2)} kPa`, color: '#38bdf8' },
          { label: 'ตัวคูณแรง (A₂ / A₁)', value: `${hyd.ratio} เท่า`, color: '#a78bfa' }
        ]);
      }

      rafId = requestAnimationFrame(render);
    }
    rafId = requestAnimationFrame(render);
  }

  /* ================= SIM 8: KINETIC GAS & MECHANICAL WAVES ================= */
  function initThermalWave(ui) {
    let mode = 'gas';
    const gas = { tempK: 300, volPct: 100, particles: [] };
    const wave = { type: 'transverse', amp: 46, freq: 1.5, speed: 140, phase: 0 };

    for (let i = 0; i < 42; i++) {
      const ang = Math.random() * Math.PI * 2;
      gas.particles.push({
        x: Math.random(), y: Math.random(),
        vx: Math.cos(ang), vy: Math.sin(ang)
      });
    }

    ui.modes.innerHTML = `
      <button class="mode-btn active" data-m="gas">🔥 ทฤษฎีจลน์ก๊าซ (กฎบอยล์ & อุณหภูมิ)</button>
      <button class="mode-btn" data-m="wave">🌊 เครื่องกำเนิดคลื่นกล (v = fλ)</button>
    `;

    function buildUI() {
      ui.controls.innerHTML = '';
      if (mode === 'gas') {
        ui.controls.append(
          makeSlider('gt', 'อุณหภูมิสัมบูรณ์ T', 100, 900, 25, gas.tempK, 'K', v => gas.tempK = v),
          makeSlider('gv', 'ปริมาตรกระบอกสูบ V', 35, 100, 5, gas.volPct, '%', v => gas.volPct = v)
        );
        ui.actions.innerHTML = `<span class="meta-tag">สังเกต: T (°C) = T(K) − 273 | ลด V ครึ่งหนึ่ง → P เพิ่ม 2 เท่า!</span>`;
      } else {
        ui.controls.append(
          makeSlider('wa', 'แอมพลิจูด A', 15, 75, 5, wave.amp, 'px', v => wave.amp = v),
          makeSlider('wf', 'ความถี่ f', 0.5, 4.0, 0.25, wave.freq, 'Hz', v => wave.freq = v),
          makeSlider('wv', 'อัตราเร็วคลื่น v', 80, 260, 20, wave.speed, 'px/s', v => wave.speed = v)
        );
        ui.actions.innerHTML = `
          <button class="btn btn-sm ${wave.type === 'transverse' ? 'btn-primary' : ''}" id="btn-wt">〰️ คลื่นตามขวาง (Transverse)</button>
          <button class="btn btn-sm ${wave.type === 'longitudinal' ? 'btn-primary' : ''}" id="btn-wl">🔊 คลื่นตามยาว (Longitudinal)</button>
        `;
        ui.actions.querySelector('#btn-wt').onclick = () => { wave.type = 'transverse'; buildUI(); };
        ui.actions.querySelector('#btn-wl').onclick = () => { wave.type = 'longitudinal'; buildUI(); };
      }
    }

    ui.modes.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        ui.modes.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        mode = btn.dataset.m;
        buildUI();
      });
    });
    buildUI();

    let last = performance.now();
    function render(now) {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const { ctx, w, h } = setupCanvas(ui.canvas);
      ctx.fillStyle = '#090e1a';
      ctx.fillRect(0, 0, w, h);
      drawGrid(ctx, w, h, 30);

      if (mode === 'gas') {
        const boxX = 54, boxY = 58, maxBoxW = w - 130, boxH = h - 104;
        const curW = maxBoxW * (gas.volPct / 100);
        const speedFactor = Math.sqrt(gas.tempK / 300) * 1.1;

        // Cylinder chamber
        ctx.fillStyle = 'rgba(30, 41, 59, 0.7)';
        ctx.fillRect(boxX, boxY, curW, boxH);
        ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 4;
        ctx.strokeRect(boxX, boxY, maxBoxW, boxH);

        // Movable piston
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(boxX + curW, boxY + 2, 16, boxH - 4);
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(boxX + curW + 16, boxY + boxH / 2 - 8, w - (boxX + curW + 24), 16);

        // Particle color by temperature
        const pCol = gas.tempK < 250 ? '#38bdf8' : (gas.tempK < 550 ? '#34d399' : '#fb7185');

        gas.particles.forEach(p => {
          p.x += p.vx * dt * speedFactor * 0.45;
          p.y += p.vy * dt * speedFactor * 0.45;
          if (p.x < 0.02) { p.x = 0.02; p.vx = Math.abs(p.vx); }
          if (p.x > 0.98) { p.x = 0.98; p.vx = -Math.abs(p.vx); }
          if (p.y < 0.03) { p.y = 0.03; p.vy = Math.abs(p.vy); }
          if (p.y > 0.97) { p.y = 0.97; p.vy = -Math.abs(p.vy); }

          const px = boxX + 8 + p.x * (curW - 16);
          const py = boxY + 8 + p.y * (boxH - 16);
          ctx.fillStyle = pCol;
          ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2); ctx.fill();
        });

        const pressureAtm = (gas.tempK / 300) * (100 / gas.volPct);
        const tempC = gas.tempK - 273;

        ctx.fillStyle = '#e2e8f0'; ctx.font = '600 13px "Prompt"';
        ctx.fillText(`กฎรวมก๊าซ PV/T = คงที่ — โมเลกุลชนผนังถี่และแรงขึ้นเมื่อลด V หรือเพิ่ม T`, 20, 30);

        setReadouts(ui.readouts, [
          { label: 'ความดันก๊าซ P', value: `${pressureAtm.toFixed(2)} atm`, color: '#fbbf24' },
          { label: 'อุณหภูมิ (K / °C)', value: `${gas.tempK} K (${tempC}°C)`, color: pCol },
          { label: 'ปริมาตร V', value: `${gas.volPct} %`, color: '#38bdf8' },
          { label: 'ค่าคงที่ PV / T', value: `${((pressureAtm * gas.volPct) / gas.tempK).toFixed(3)}`, color: '#34d399' }
        ]);
      } else {
        // Mechanical Wave
        wave.phase += 2 * Math.PI * wave.freq * dt;
        const lambda = wave.speed / wave.freq;
        const k = (2 * Math.PI) / lambda;
        const midY = h * 0.54;

        ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
        ctx.setLineDash([5, 5]);
        ctx.beginPath(); ctx.moveTo(20, midY); ctx.lineTo(w - 20, midY); ctx.stroke();
        ctx.setLineDash([]);

        if (wave.type === 'transverse') {
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 3;
          ctx.beginPath();
          for (let x = 24; x <= w - 24; x += 3) {
            const y = midY - wave.amp * Math.sin(k * (x - 24) - wave.phase);
            if (x === 24) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.stroke();

          // Particles on rope
          for (let x = 40; x <= w - 40; x += 24) {
            const y = midY - wave.amp * Math.sin(k * (x - 24) - wave.phase);
            const isTracer = Math.abs(x - w * 0.45) < 13;
            ctx.fillStyle = isTracer ? '#fb7185' : '#93c5fd';
            ctx.beginPath(); ctx.arc(x, y, isTracer ? 8 : 4, 0, Math.PI * 2); ctx.fill();
            if (isTracer) {
              ctx.strokeStyle = 'rgba(251, 113, 133, 0.4)';
              ctx.beginPath(); ctx.moveTo(x, midY - wave.amp - 10); ctx.lineTo(x, midY + wave.amp + 10); ctx.stroke();
            }
          }
        } else {
          // Longitudinal wave (sound / slinky dots)
          const rows = 5;
          for (let r = 0; r < rows; r++) {
            const py = midY - 60 + r * 30;
            for (let x0 = 40; x0 <= w - 40; x0 += 18) {
              const disp = (wave.amp * 0.32) * Math.sin(k * (x0 - 24) - wave.phase);
              const isTracer = r === 2 && Math.abs(x0 - w * 0.45) < 10;
              ctx.fillStyle = isTracer ? '#fb7185' : '#38bdf8';
              ctx.beginPath(); ctx.arc(x0 + disp, py, isTracer ? 7 : 3.5, 0, Math.PI * 2); ctx.fill();
            }
          }
        }

        ctx.fillStyle = '#e2e8f0'; ctx.font = '600 13px "Prompt"';
        ctx.fillText('🔴 จ้องที่จุดสีแดง: ตัวกลางแค่สั่นกลับไปกลับมา ไม่ได้เดินทางไปกับคลื่น!', 20, 30);

        setReadouts(ui.readouts, [
          { label: 'อัตราเร็วคลื่น (v)', value: `${wave.speed} px/s`, color: '#38bdf8' },
          { label: 'ความถี่ (f)', value: `${wave.freq.toFixed(2)} Hz`, color: '#34d399' },
          { label: 'ความยาวคลื่น λ = v/f', value: `${lambda.toFixed(1)} px`, color: '#fbbf24' },
          { label: 'คาบเวลา T = 1/f', value: `${(1 / wave.freq).toFixed(2)} s`, color: '#a78bfa' }
        ]);
      }

      rafId = requestAnimationFrame(render);
    }
    rafId = requestAnimationFrame(render);
  }

  const registry = {
    vectors: initVectors,
    kinematics: initKinematics,
    projectile: initProjectile,
    newton: initNewton,
    circular: initCircular,
    energy: initEnergy,
    pressure: initPressure,
    thermal_wave: initThermalWave
  };

  return {
    mount(simId, ui) {
      stopCurrent();
      const fn = registry[simId];
      if (fn) fn(ui);
    },
    unmount: stopCurrent
  };
})();
