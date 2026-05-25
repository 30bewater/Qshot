import { attachElementTilt } from "../../shared/element-tilt.js";

function isPointerInRect(clientX, clientY, rect) {
  return (
    clientX >= rect.left &&
    clientX <= rect.right &&
    clientY >= rect.top &&
    clientY <= rect.bottom
  );
}

function isPointerOverActionsButton(modalEl, clientX, clientY) {
  const actions = modalEl.querySelector(".ai-summary-actions");
  if (!actions || actions.hidden) return false;
  const buttons = actions.querySelectorAll("button");
  for (const btn of buttons) {
    if (btn.hidden) continue;
    const rect = btn.getBoundingClientRect();
    if (!rect.width || !rect.height) continue;
    if (isPointerInRect(clientX, clientY, rect)) return true;
  }
  return false;
}

/** AI 总结弹窗玻璃卡片：边角/侧缘轻倾斜，阅读区与底部操作栏保持平整 */
export function attachAiSummaryModalTilt(modalEl, contentEl) {
  const tilt = attachElementTilt(contentEl, () => modalEl.isConnected, {
    edgeInset: 0.30,
    edgeProfile: "summaryModal",
    scale: 1.005,
    xMultPos: 5,
    xMultNeg: 3,
    yMult: 4,
    shadowOffset: 4,
    shadowBlur1: 10,
    shadowAlpha1: 0.04,
    shadowBlur2: 18,
    shadowAlpha2: 0.06,
    yieldsTo(clientX, clientY) {
      return isPointerOverActionsButton(modalEl, clientX, clientY);
    },
  });
  tilt.enable();
  return tilt;
}
