/** 长按拖动 Q 钮转圈彩蛋：火焰拖尾 + 越转越大的火环 */
export function createLauncherSpinFx({ host, fab, iconSize = 30 }) {
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reducedMotion) {
    return { onDragStart() {}, onDragMove() {}, onDragEnd() {} };
  }

  let canvas = null;
  let ctx = null;
  let rafId = 0;
  let fading = false;
  let fadeUntil = 0;
  let particles = [];
  let samples = [];
  let totalRotation = 0;
  let lastAngle = null;
  let intensity = 0;

  const TRIGGER_RAD = Math.PI * 1.4;
  const MAX_RAD = Math.PI * 7;
  const half = iconSize / 2;

  function ensureCanvas() {
    if (canvas && host.contains(canvas)) return;
    canvas = document.createElement("canvas");
    canvas.className = "launcher-spin-canvas";
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    ctx = canvas.getContext("2d");
    host.insertBefore(canvas, fab || null);
  }

  function resizeCanvas() {
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function fabCenter(left, top) {
    return { x: left + half, y: top + half };
  }

  function spinCenter() {
    if (!samples.length) return null;
    let x = 0;
    let y = 0;
    for (const p of samples) {
      x += p.x;
      y += p.y;
    }
    return { x: x / samples.length, y: y / samples.length };
  }

  function emitTrail(x, y, power) {
    const n = 2 + Math.floor(power * 5);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (0.8 + Math.random() * 2.2) * (0.45 + power);
      particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 0.6,
        life: 1,
        decay: 0.028 + Math.random() * 0.035,
        size: (2.5 + Math.random() * 4) * (0.55 + power * 0.9),
      });
    }
  }

  function drawParticle(p) {
    const a = p.life;
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
    g.addColorStop(0, `rgba(255, 245, 200, ${a})`);
    g.addColorStop(0.45, `rgba(255, 150, 40, ${a * 0.85})`);
    g.addColorStop(1, "rgba(255, 40, 0, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    p.x += p.vx;
    p.y += p.vy;
    p.vy -= 0.04;
  }

  function drawFireRing(cx, cy, radius, power) {
    const pulse = 1 + Math.sin(performance.now() * 0.012) * 0.06 * power;
    const r = radius * (0.82 + power * 0.35) * pulse;
    const now = performance.now() * 0.004;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    for (let ring = 0; ring < 3; ring++) {
      const rr = r * (1 + ring * 0.08);
      const alpha = (0.18 + power * 0.35) / (ring + 1);
      ctx.beginPath();
      ctx.arc(cx, cy, rr, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, ${120 - ring * 30}, 20, ${alpha})`;
      ctx.lineWidth = 4 + power * 10 - ring * 2;
      ctx.shadowColor = "rgba(255, 120, 0, 0.9)";
      ctx.shadowBlur = 8 + power * 22;
      ctx.stroke();
    }

    const tongues = 12 + Math.floor(power * 28);
    for (let i = 0; i < tongues; i++) {
      const ang = (i / tongues) * Math.PI * 2 + now;
      const len = (6 + power * 18) * (0.7 + Math.sin(now * 2 + i) * 0.3);
      const x1 = cx + Math.cos(ang) * r;
      const y1 = cy + Math.sin(ang) * r;
      const x2 = cx + Math.cos(ang) * (r + len);
      const y2 = cy + Math.sin(ang) * (r + len);
      const g = ctx.createLinearGradient(x1, y1, x2, y2);
      g.addColorStop(0, `rgba(255, 220, 100, ${0.5 + power * 0.4})`);
      g.addColorStop(1, "rgba(255, 50, 0, 0)");
      ctx.strokeStyle = g;
      ctx.lineWidth = 2 + power * 3;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function updateFabGlow() {
    if (!fab) return;
    if (intensity > 0.35) {
      fab.classList.add("spin-fire");
      const glow = 6 + intensity * 20;
      fab.style.boxShadow = `0 0 ${glow}px rgba(255, 120, 30, ${0.35 + intensity * 0.45}), 0 0 ${glow * 1.6}px rgba(255, 60, 0, ${0.2 + intensity * 0.3})`;
    } else {
      fab.classList.remove("spin-fire");
      fab.style.removeProperty("box-shadow");
    }
  }

  function frame() {
    rafId = 0;
    if (!ctx || !canvas) return;

    const alive = particles.length > 0 || intensity > 0.02 || fading;
    if (!alive) {
      canvas.remove();
      canvas = null;
      ctx = null;
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (fading && performance.now() > fadeUntil) {
      intensity *= 0.92;
      if (intensity < 0.03) intensity = 0;
    }

    const center = spinCenter();
    const latest = samples[samples.length - 1];
    if (intensity > 0.2 && center && latest) {
      const radius = Math.hypot(latest.x - center.x, latest.y - center.y);
      if (radius > 24) drawFireRing(center.x, center.y, radius, intensity);
    }

    for (const p of particles) drawParticle(p);
    particles = particles.filter((p) => {
      p.life -= p.decay;
      return p.life > 0;
    });

    updateFabGlow();
    rafId = requestAnimationFrame(frame);
  }

  function startLoop() {
    if (!rafId) rafId = requestAnimationFrame(frame);
  }

  function onDragStart() {
    samples = [];
    particles = [];
    totalRotation = 0;
    lastAngle = null;
    intensity = 0;
    fading = false;
    ensureCanvas();
    resizeCanvas();
    fab?.classList.remove("spin-fire");
    startLoop();
  }

  function onDragMove(left, top) {
    const pt = fabCenter(left, top);
    samples.push(pt);
    if (samples.length > 36) samples.shift();

    const center = spinCenter();
    if (!center) return;

    const angle = Math.atan2(pt.y - center.y, pt.x - center.x);
    if (lastAngle !== null) {
      let delta = angle - lastAngle;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      if (Math.abs(delta) > 0.03) totalRotation += Math.abs(delta);
    }
    lastAngle = angle;

    const ramp = Math.max(0, totalRotation - TRIGGER_RAD * 0.35);
    intensity = Math.min(1, ramp / (MAX_RAD - TRIGGER_RAD * 0.35));

    if (intensity > 0.08) emitTrail(pt.x, pt.y, intensity);
    if (!rafId) startLoop();
  }

  function onDragEnd() {
    lastAngle = null;
    fading = true;
    fadeUntil = performance.now() + 700;
    if (fab) {
      fab.classList.remove("spin-fire");
      fab.style.removeProperty("box-shadow");
    }
    startLoop();
  }

  const onResize = () => resizeCanvas();
  window.addEventListener("resize", onResize, { passive: true });

  return {
    onDragStart,
    onDragMove,
    onDragEnd,
    destroy() {
      window.removeEventListener("resize", onResize);
      if (rafId) cancelAnimationFrame(rafId);
      canvas?.remove();
      canvas = null;
      ctx = null;
    },
  };
}
