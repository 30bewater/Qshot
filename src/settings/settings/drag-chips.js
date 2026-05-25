/**
 * drag-chips.js
 * Drag-and-drop for site chips (group-bound and generic callback variants).
 */

import { getGroupById } from "./utils.js";
import { persistAll } from "./store.js";

export function attachChipDrag(chipsWrap, group) {
  chipsWrap.addEventListener("pointerdown", onPointerDown);

  function onPointerDown(e) {
    const chip = e.target.closest(".selected-chip");
    if (!chip || e.target.closest(".chip-remove-btn")) return;

    e.preventDefault();

    const rect = chip.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    const clone = chip.cloneNode(true);
    clone.style.cssText = [
      `position:fixed`,
      `left:${rect.left}px`,
      `top:${rect.top}px`,
      `min-width:${rect.width}px`,
      `width:max-content`,
      `height:${rect.height}px`,
      `margin:0`,
      `pointer-events:none`,
      `z-index:9999`,
      `box-shadow:0 6px 20px rgba(0,0,0,0.18)`,
      `opacity:1`,
      `cursor:grabbing`,
      `transition:none`
    ].join(";");
    const cloneLabel = clone.querySelector(".site-chip-label");
    if (cloneLabel) {
      cloneLabel.style.maxWidth = "none";
    }
    document.body.appendChild(clone);

    chip.classList.add("is-chip-placeholder");
    chipsWrap.classList.add("is-chip-dragging-active");

    let lastInsertBefore = null;

    function onMove(ev) {
      clone.style.left = `${ev.clientX - offsetX}px`;
      clone.style.top = `${ev.clientY - offsetY}px`;

      const cloneCenterX = ev.clientX - offsetX + rect.width / 2;
      const cloneCenterY = ev.clientY - offsetY + rect.height / 2;

      const otherChips = Array.from(chipsWrap.querySelectorAll(".selected-chip")).filter((c) => c !== chip);
      const addWrap = chipsWrap.querySelector(".inline-add-wrap");
      let newInsertBefore = addWrap;

      for (const other of otherChips) {
        const r = other.getBoundingClientRect();
        const midX = r.left + r.width / 2;
        const midY = r.top + r.height / 2;
        if (
          cloneCenterY < midY - r.height * 0.4 ||
          (Math.abs(cloneCenterY - midY) <= r.height * 0.6 && cloneCenterX < midX)
        ) {
          newInsertBefore = other;
          break;
        }
      }

      if (newInsertBefore !== lastInsertBefore) {
        const allChips = Array.from(chipsWrap.querySelectorAll(".selected-chip"));
        const firstPositions = new Map();
        allChips.forEach((el) => firstPositions.set(el, el.getBoundingClientRect()));

        chipsWrap.insertBefore(chip, newInsertBefore);
        lastInsertBefore = newInsertBefore;

        allChips
          .filter((el) => el !== chip)
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
                el.style.transition = "transform 180ms cubic-bezier(0.2,0,0,1)";
                el.style.transform = "";
              });
            });
          });
      }
    }

    function onUp() {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);

      const finalRect = chip.getBoundingClientRect();
      clone.style.transition = "left 150ms ease, top 150ms ease, box-shadow 150ms ease, opacity 150ms ease";
      clone.style.left = `${finalRect.left}px`;
      clone.style.top = `${finalRect.top}px`;
      clone.style.boxShadow = "none";
      clone.style.opacity = "0";

      setTimeout(() => {
        clone.remove();
        chip.classList.remove("is-chip-placeholder");
        chipsWrap.classList.remove("is-chip-dragging-active");

        Array.from(chipsWrap.querySelectorAll(".selected-chip")).forEach((el) => {
          el.style.transition = "";
          el.style.transform = "";
        });

        const newSiteIds = Array.from(chipsWrap.querySelectorAll(".selected-chip")).map((c) => c.dataset.siteId);
        const currentGroup = getGroupById(group.id);
        if (currentGroup) {
          currentGroup.siteIds = newSiteIds;
          persistAll();
        }
      }, 150);
    }

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  }
}

// Generic variant: calls onReorder(newSiteIds) instead of writing to a group directly.
export function attachChipDragGeneric(chipsWrap, onReorder) {
  chipsWrap.addEventListener("pointerdown", onPointerDown);

  function onPointerDown(e) {
    const chip = e.target.closest(".selected-chip");
    if (!chip || e.target.closest(".chip-remove-btn")) return;
    e.preventDefault();

    const rect = chip.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    const clone = chip.cloneNode(true);
    clone.style.cssText = [
      `position:fixed`, `left:${rect.left}px`, `top:${rect.top}px`,
      `width:${rect.width}px`, `height:${rect.height}px`, `margin:0`,
      `pointer-events:none`, `z-index:9999`,
      `box-shadow:0 6px 20px rgba(0,0,0,0.18)`,
      `opacity:1`, `cursor:grabbing`, `transition:none`
    ].join(";");
    document.body.appendChild(clone);
    chip.classList.add("is-chip-placeholder");
    chipsWrap.classList.add("is-chip-dragging-active");

    let lastInsertBefore = null;

    function onMove(ev) {
      clone.style.left = `${ev.clientX - offsetX}px`;
      clone.style.top = `${ev.clientY - offsetY}px`;
      const cloneCenterX = ev.clientX - offsetX + rect.width / 2;
      const cloneCenterY = ev.clientY - offsetY + rect.height / 2;
      const otherChips = Array.from(chipsWrap.querySelectorAll(".selected-chip")).filter((c) => c !== chip);
      const addWrap = chipsWrap.querySelector(".inline-add-wrap");
      let newInsertBefore = addWrap;
      for (const other of otherChips) {
        const r = other.getBoundingClientRect();
        const midX = r.left + r.width / 2;
        const midY = r.top + r.height / 2;
        if (cloneCenterY < midY - r.height * 0.4 || (Math.abs(cloneCenterY - midY) <= r.height * 0.6 && cloneCenterX < midX)) {
          newInsertBefore = other;
          break;
        }
      }
      if (newInsertBefore !== lastInsertBefore) {
        const allChips = Array.from(chipsWrap.querySelectorAll(".selected-chip"));
        const firstPositions = new Map();
        allChips.forEach((el) => firstPositions.set(el, el.getBoundingClientRect()));
        chipsWrap.insertBefore(chip, newInsertBefore);
        lastInsertBefore = newInsertBefore;
        allChips.filter((el) => el !== chip).forEach((el) => {
          const first = firstPositions.get(el);
          if (!first) return;
          const last = el.getBoundingClientRect();
          const dx = first.left - last.left;
          const dy = first.top - last.top;
          if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
          el.style.transition = "none";
          el.style.transform = `translate(${dx}px,${dy}px)`;
          requestAnimationFrame(() => requestAnimationFrame(() => {
            el.style.transition = "transform 180ms cubic-bezier(0.2,0,0,1)";
            el.style.transform = "";
          }));
        });
      }
    }

    function onUp() {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      const finalRect = chip.getBoundingClientRect();
      clone.style.transition = "left 150ms ease, top 150ms ease, box-shadow 150ms ease, opacity 150ms ease";
      clone.style.left = `${finalRect.left}px`;
      clone.style.top = `${finalRect.top}px`;
      clone.style.boxShadow = "none";
      clone.style.opacity = "0";
      setTimeout(() => {
        clone.remove();
        chip.classList.remove("is-chip-placeholder");
        chipsWrap.classList.remove("is-chip-dragging-active");
        Array.from(chipsWrap.querySelectorAll(".selected-chip")).forEach((el) => {
          el.style.transition = "";
          el.style.transform = "";
        });
        const newSiteIds = Array.from(chipsWrap.querySelectorAll(".selected-chip")).map((c) => c.dataset.siteId).filter(Boolean);
        onReorder(newSiteIds);
      }, 150);
    }

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  }
}
