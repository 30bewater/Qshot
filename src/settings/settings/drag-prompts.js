/**
 * drag-prompts.js
 * Drag-and-drop for prompt card items (single group and "All" aggregate view).
 */

import { state } from "./state.js";
import { persistAll } from "./store.js";

export function attachPromptItemDrag(listEl, group) {
  listEl.addEventListener("pointerdown", onPromptPointerDown);

  function onPromptPointerDown(e) {
    const handle = e.target.closest(".prompt-card-drag-handle");
    if (!handle) return;
    const card = handle.closest(".prompt-card-item");
    if (!card) return;

    e.preventDefault();

    const rect = card.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;

    const clone = card.cloneNode(true);
    clone.style.cssText = [
      "position:fixed",
      `left:${rect.left}px`,
      `top:${rect.top}px`,
      `width:${rect.width}px`,
      "pointer-events:none",
      "z-index:9999",
      "box-shadow:0 8px 28px rgba(0,0,0,0.13)",
      "opacity:0.95",
      "transition:none",
      "border-radius:8px",
      "background:#fff"
    ].join(";");
    document.body.appendChild(clone);

    card.style.opacity = "0";
    card.style.pointerEvents = "none";

    let lastInsertBefore = null;

    function onMove(ev) {
      clone.style.top = `${ev.clientY - offsetY}px`;

      const cloneCenterY = ev.clientY - offsetY + rect.height / 2;
      const otherCards = Array.from(listEl.querySelectorAll(".prompt-card-item")).filter((c) => c !== card);
      let newInsertBefore = null;

      for (const other of otherCards) {
        const r = other.getBoundingClientRect();
        if (cloneCenterY < r.top + r.height / 2) {
          newInsertBefore = other;
          break;
        }
      }

      if (newInsertBefore !== lastInsertBefore) {
        const allCards = Array.from(listEl.querySelectorAll(".prompt-card-item"));
        const firstPositions = new Map();
        allCards.forEach((el) => firstPositions.set(el, el.getBoundingClientRect()));

        listEl.insertBefore(card, newInsertBefore);
        lastInsertBefore = newInsertBefore;

        allCards
          .filter((el) => el !== card)
          .forEach((el) => {
            const first = firstPositions.get(el);
            if (!first) return;
            const last = el.getBoundingClientRect();
            const dy = first.top - last.top;
            if (Math.abs(dy) < 1) return;
            el.style.transition = "none";
            el.style.transform = `translateY(${dy}px)`;
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                el.style.transition = "transform 200ms cubic-bezier(0.2,0,0,1)";
                el.style.transform = "";
              });
            });
          });
      }
    }

    function onUp() {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);

      const finalRect = card.getBoundingClientRect();
      clone.style.transition = "top 160ms ease, box-shadow 160ms ease, opacity 160ms ease";
      clone.style.top = `${finalRect.top}px`;
      clone.style.boxShadow = "none";
      clone.style.opacity = "0";

      setTimeout(() => {
        clone.remove();
        card.style.opacity = "";
        card.style.pointerEvents = "";

        Array.from(listEl.querySelectorAll(".prompt-card-item")).forEach((el) => {
          el.style.transition = "";
          el.style.transform = "";
        });

        const newPromptIds = Array.from(listEl.querySelectorAll(".prompt-card-item")).map((c) => c.dataset.promptId);
        const reordered = newPromptIds.map((id) => group.prompts.find((p) => p.id === id)).filter(Boolean);
        if (reordered.length === group.prompts.length) {
          group.prompts = reordered;
          persistAll();
        }
      }, 160);
    }

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  }
}

// "全部"聚合视图专用拖拽：按 data-group-id 分桶更新各分组提示词顺序。
export function attachPromptItemDragAll(listEl) {
  listEl.addEventListener("pointerdown", onPromptPointerDown);

  function onPromptPointerDown(e) {
    const handle = e.target.closest(".prompt-card-drag-handle");
    if (!handle) return;
    const card = handle.closest(".prompt-card-item");
    if (!card) return;

    e.preventDefault();

    const rect = card.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;

    const clone = card.cloneNode(true);
    clone.style.cssText = [
      "position:fixed",
      `left:${rect.left}px`,
      `top:${rect.top}px`,
      `width:${rect.width}px`,
      "pointer-events:none",
      "z-index:9999",
      "box-shadow:0 8px 28px rgba(0,0,0,0.13)",
      "opacity:0.95",
      "transition:none",
      "border-radius:8px",
      "background:#fff"
    ].join(";");
    document.body.appendChild(clone);

    card.style.opacity = "0";
    card.style.pointerEvents = "none";

    let lastInsertBefore = null;

    function onMove(ev) {
      clone.style.top = `${ev.clientY - offsetY}px`;

      const cloneCenterY = ev.clientY - offsetY + rect.height / 2;
      const otherCards = Array.from(listEl.querySelectorAll(".prompt-card-item")).filter((c) => c !== card);
      let newInsertBefore = null;

      for (const other of otherCards) {
        const r = other.getBoundingClientRect();
        if (cloneCenterY < r.top + r.height / 2) {
          newInsertBefore = other;
          break;
        }
      }

      if (newInsertBefore !== lastInsertBefore) {
        const allCards = Array.from(listEl.querySelectorAll(".prompt-card-item"));
        const firstPositions = new Map();
        allCards.forEach((el) => firstPositions.set(el, el.getBoundingClientRect()));

        listEl.insertBefore(card, newInsertBefore);
        lastInsertBefore = newInsertBefore;

        allCards
          .filter((el) => el !== card)
          .forEach((el) => {
            const first = firstPositions.get(el);
            if (!first) return;
            const last = el.getBoundingClientRect();
            const dy = first.top - last.top;
            if (Math.abs(dy) < 1) return;
            el.style.transition = "none";
            el.style.transform = `translateY(${dy}px)`;
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                el.style.transition = "transform 200ms cubic-bezier(0.2,0,0,1)";
                el.style.transform = "";
              });
            });
          });
      }
    }

    function onUp() {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);

      const finalRect = card.getBoundingClientRect();
      clone.style.transition = "top 160ms ease, box-shadow 160ms ease, opacity 160ms ease";
      clone.style.top = `${finalRect.top}px`;
      clone.style.boxShadow = "none";
      clone.style.opacity = "0";

      setTimeout(() => {
        clone.remove();
        card.style.opacity = "";
        card.style.pointerEvents = "";

        Array.from(listEl.querySelectorAll(".prompt-card-item")).forEach((el) => {
          el.style.transition = "";
          el.style.transform = "";
        });

        const groupOrderMap = new Map();
        Array.from(listEl.querySelectorAll(".prompt-card-item")).forEach((el) => {
          const gId = el.dataset.groupId;
          if (!groupOrderMap.has(gId)) groupOrderMap.set(gId, []);
          groupOrderMap.get(gId).push(el.dataset.promptId);
        });

        let changed = false;
        groupOrderMap.forEach((promptIds, gId) => {
          const group = state.promptGroups.find((g) => g.id === gId);
          if (!group) return;
          const reordered = promptIds.map((id) => group.prompts.find((p) => p.id === id)).filter(Boolean);
          if (reordered.length === group.prompts.length) {
            group.prompts = reordered;
            changed = true;
          }
        });

        if (changed) persistAll();
      }, 160);
    }

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  }
}
