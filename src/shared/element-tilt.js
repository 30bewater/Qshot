const DEFAULTS = {
  xMultPos: 14,
  xMultNeg: 8,
  yMult: 12,
  scale: 1.04,
  shadowOffset: 10,
  shadowBlur1: 14,
  shadowAlpha1: 0.08,
  shadowBlur2: 26,
  shadowAlpha2: 0.12,
  /** 0 = 全区域倾斜；>0 时仅外缘带触发，中心阅读区保持平整 */
  edgeInset: 0,
};

function computeEdgeAxes(xPos, yPos, edgeInset) {
  if (!edgeInset || edgeInset <= 0) {
    return { fx: 1, fy: 1, xPos, yPos };
  }
  const threshold = 0.5 - edgeInset;
  if (threshold <= 0) return { fx: 1, fy: 1, xPos, yPos };
  const fx = Math.abs(xPos) > threshold ? (Math.abs(xPos) - threshold) / edgeInset : 0;
  const fy = Math.abs(yPos) > threshold ? (Math.abs(yPos) - threshold) / edgeInset : 0;
  return { fx, fy, xPos, yPos };
}

/** @returns {number} 0 = 中心死区，1 = 贴边 */
function getEdgeTiltFactor(xPos, yPos, edgeInset, edgeProfile = "default") {
  const axes = computeEdgeAxes(xPos, yPos, edgeInset);
  const { fx, fy, xPos: xp, yPos: yp } = axes;
  if (edgeProfile === "summaryModal") {
    const side = fx;
    const top = yp < 0 ? fy : 0;
    let bottomCorner = 0;
    if (yp > 0 && edgeInset > 0) {
      const cornerRadius = edgeInset * 0.95;
      const blDist = Math.hypot(xp + 0.5, yp - 0.5);
      const brDist = Math.hypot(xp - 0.5, yp - 0.5);
      const minDist = Math.min(blDist, brDist);
      if (minDist <= cornerRadius) {
        bottomCorner = 1 - minDist / cornerRadius;
      }
    }
    return Math.min(1, Math.max(side, top, bottomCorner));
  }
  if (!edgeInset || edgeInset <= 0) return 1;
  return Math.min(1, Math.max(fx, fy));
}

/** 鼠标在元素上移动时产生 3D 倾斜（参考八大块.html） */
export function attachElementTilt(element, getIsActive, options = {}) {
  const cfg = { ...DEFAULTS, ...options };
  let armed = false;
  let hovering = false;

  function reset() {
    element.style.removeProperty("transform");
    element.style.removeProperty("box-shadow");
    hovering = false;
  }

  function applyTilt(clientX, clientY) {
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const xPos = (clientX - rect.left) / rect.width - 0.5;
    const yPos = (clientY - rect.top) / rect.height - 0.5;
    const factor = getEdgeTiltFactor(xPos, yPos, cfg.edgeInset, cfg.edgeProfile);
    if (factor <= 0) {
      reset();
      return;
    }

    const xDeg = (yPos < 0 ? -yPos * cfg.xMultPos : -yPos * cfg.xMultNeg) * factor;
    const yDeg = xPos * cfg.yMult * factor;
    const scale = 1 + (cfg.scale - 1) * factor;
    const shadowOff = cfg.shadowOffset * factor;

    element.style.setProperty(
      "transform",
      `rotateX(${xDeg}deg) rotateY(${yDeg}deg) scale3d(${scale}, ${scale}, ${scale})`,
      "important"
    );
    element.style.setProperty(
      "box-shadow",
      `${-xPos * shadowOff}px ${-yPos * shadowOff + 6}px ${cfg.shadowBlur1}px rgba(0, 0, 0, ${cfg.shadowAlpha1 * factor}), 0 ${cfg.shadowBlur2}px ${cfg.shadowBlur2}px rgba(0, 0, 0, ${cfg.shadowAlpha2 * factor})`,
      "important"
    );
  }

  function isInside(clientX, clientY) {
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height) return false;
    return (
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom
    );
  }

  function onPointerMove(e) {
    if (!getIsActive()) {
      if (hovering) reset();
      return;
    }
    if (typeof cfg.yieldsTo === "function" && cfg.yieldsTo(e.clientX, e.clientY)) {
      if (hovering) reset();
      return;
    }
    if (!isInside(e.clientX, e.clientY)) {
      if (hovering) reset();
      return;
    }
    hovering = true;
    applyTilt(e.clientX, e.clientY);
  }

  function enable() {
    if (armed) return;
    armed = true;
    window.addEventListener("pointermove", onPointerMove, true);
  }

  function disable() {
    if (!armed) return;
    armed = false;
    window.removeEventListener("pointermove", onPointerMove, true);
    reset();
  }

  return { enable, disable, reset };
}
