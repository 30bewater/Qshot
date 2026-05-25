/**
 * drag-groups.js
 * Drag-and-drop for settings group cards and prompt-group nav items.
 */

import { DEFAULT_PROMPT_GROUP_ID } from "../../shared/storage-keys.js";
import { state } from "./state.js";
import { persistAll } from "./store.js";

export function attachGroupDrag(container) {
  container.addEventListener("pointerdown", onGroupPointerDown);

  function onGroupPointerDown(e) {
    const handle = e.target.closest(".group-drag-handle");
    if (!handle) return;
    const card = handle.closest(".settings-group-card");
    if (!card) return;

    e.preventDefault();

    const rect = card.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;
    const cardBorderRadius = window.getComputedStyle(card).borderRadius || "18px";

    const clone = card.cloneNode(true);
    clone.classList.add("is-group-drag-clone");
    clone.style.cssText = [
      "position:fixed",
      `left:${rect.left}px`,
      `top:${rect.top}px`,
      `width:${rect.width}px`,
      "pointer-events:none",
      "z-index:9999",
      "box-shadow:0 12px 40px rgba(0,0,0,0.16)",
      "opacity:0.96",
      "transition:none",
      `border-radius:${cardBorderRadius}`
    ].join(";");
    document.body.appendChild(clone);

    card.style.opacity = "0";
    card.style.pointerEvents = "none";

    const lockedGroupId = state.groups[0]?.id;
    let lastInsertBefore = null;

    function onMove(ev) {
      clone.style.left = `${ev.clientX - offsetX}px`;
      clone.style.top = `${ev.clientY - offsetY}px`;

      const cloneCenterX = ev.clientX - offsetX + rect.width / 2;
      const cloneCenterY = ev.clientY - offsetY + rect.height / 2;
      const otherCards = Array.from(container.querySelectorAll(".settings-group-card")).filter((c) => c !== card);
      const addCard = container.querySelector(".settings-add-card");
      let newInsertBefore = addCard;

      for (const other of otherCards) {
        const r = other.getBoundingClientRect();
        const midX = r.left + r.width / 2;
        const midY = r.top + r.height / 2;
        if (
          cloneCenterY < midY - r.height * 0.35 ||
          (Math.abs(cloneCenterY - midY) <= r.height * 0.7 && cloneCenterX < midX)
        ) {
          newInsertBefore = other;
          break;
        }
      }

      if (newInsertBefore && newInsertBefore.dataset && newInsertBefore.dataset.groupId === lockedGroupId) {
        newInsertBefore = newInsertBefore.nextElementSibling || addCard;
      }

      if (newInsertBefore !== lastInsertBefore) {
        const allCards = Array.from(container.querySelectorAll(".settings-group-card"));
        const firstPositions = new Map();
        allCards.forEach((el) => firstPositions.set(el, el.getBoundingClientRect()));

        container.insertBefore(card, newInsertBefore);
        lastInsertBefore = newInsertBefore;

        allCards
          .filter((el) => el !== card)
          .forEach((el) => {
            const first = firstPositions.get(el);
            if (!first) return;
            const last = el.getBoundingClientRect();
            const dx = first.left - last.left;
            const dy = first.top - last.top;
            if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
            el.style.transition = "none";
            el.style.transform = `translate(${dx}px,${dy}px)`;
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
      clone.style.transition = "left 160ms ease, top 160ms ease, box-shadow 160ms ease, opacity 160ms ease";
      clone.style.left = `${finalRect.left}px`;
      clone.style.top = `${finalRect.top}px`;
      clone.style.boxShadow = "none";
      clone.style.opacity = "0";

      setTimeout(() => {
        clone.remove();
        card.style.opacity = "";
        card.style.pointerEvents = "";

        Array.from(container.querySelectorAll(".settings-group-card")).forEach((el) => {
          el.style.transition = "";
          el.style.transform = "";
        });

        const newGroupIds = Array.from(container.querySelectorAll(".settings-group-card")).map((c) => c.dataset.groupId);
        const reordered = newGroupIds.map((id) => state.groups.find((g) => g.id === id)).filter(Boolean);
        if (reordered.length === state.groups.length) {
          state.groups = reordered;
          persistAll();
        }
      }, 160);
    }

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  }
}

export function attachPromptGroupDrag(container) {
  container.addEventListener("pointerdown", onPointerDown);

  function onPointerDown(e) {
    const handle = e.target.closest(".prompt-group-nav-drag");
    if (!handle) return;
    const item = handle.closest(".prompt-group-nav-item");
    if (!item) return;
    if (item.dataset.groupId === DEFAULT_PROMPT_GROUP_ID) return;

    e.preventDefault();

    const rect = item.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const cardBorderRadius = window.getComputedStyle(item).borderRadius || "12px";

    const clone = item.cloneNode(true);
    clone.style.cssText = [
      "position:fixed",
      `left:${rect.left}px`,
      `top:${rect.top}px`,
      `width:${rect.width}px`,
      "pointer-events:none",
      "z-index:9999",
      "box-shadow:0 12px 32px rgba(0,0,0,0.18)",
      "opacity:0.96",
      "transition:none",
      `border-radius:${cardBorderRadius}`,
      "background:#ffffff"
    ].join(";");
    document.body.appendChild(clone);

    item.style.opacity = "0";
    item.style.pointerEvents = "none";

    let lastInsertBefore = null;

    function onMove(ev) {
      clone.style.top = `${ev.clientY - offsetY}px`;

      const cloneCenterY = ev.clientY - offsetY + rect.height / 2;
      const otherItems = Array.from(container.querySelectorAll(".prompt-group-nav-item")).filter((c) => c !== item);
      let newInsertBefore = null;

      for (const other of otherItems) {
        const r = other.getBoundingClientRect();
        if (cloneCenterY < r.top + r.height / 2) {
          newInsertBefore = other;
          break;
        }
      }

      if (newInsertBefore && newInsertBefore.dataset && newInsertBefore.dataset.groupId === DEFAULT_PROMPT_GROUP_ID) {
        newInsertBefore = newInsertBefore.nextElementSibling;
      }

      if (newInsertBefore !== lastInsertBefore) {
        const allItems = Array.from(container.querySelectorAll(".prompt-group-nav-item"));
        const firstPositions = new Map();
        allItems.forEach((el) => firstPositions.set(el, el.getBoundingClientRect()));

        if (newInsertBefore) {
          container.insertBefore(item, newInsertBefore);
        } else {
          container.appendChild(item);
        }
        lastInsertBefore = newInsertBefore;

        allItems
          .filter((el) => el !== item)
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

      const finalRect = item.getBoundingClientRect();
      clone.style.transition = "top 160ms ease, box-shadow 160ms ease, opacity 160ms ease";
      clone.style.top = `${finalRect.top}px`;
      clone.style.boxShadow = "none";
      clone.style.opacity = "0";

      setTimeout(async () => {
        clone.remove();
        item.style.opacity = "";
        item.style.pointerEvents = "";

        Array.from(container.querySelectorAll(".prompt-group-nav-item")).forEach((el) => {
          el.style.transition = "";
          el.style.transform = "";
        });

        const newGroupIds = Array.from(container.querySelectorAll(".prompt-group-nav-item")).map((c) => c.dataset.groupId);
        const reordered = newGroupIds.map((id) => state.promptGroups.find((g) => g.id === id)).filter(Boolean);
        if (reordered.length === state.promptGroups.length) {
          state.promptGroups = reordered;
          await persistAll();
          state.renderPromptsSection();
        }
      }, 160);
    }

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  }
}
