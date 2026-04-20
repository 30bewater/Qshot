/**
 * shared/prompt-item.js
 * 统一的提示词条目工厂 + 预览卡片管理器。
 * 在三处使用：顶部弹窗 (popup.js)、全局搜索浮层 (overlay.js)、搜索结果页 (iframe.js)
 * 修改此文件即可同步更新三处行为与外观。
 *
 * 设计：
 *   - 条目右侧只保留一个「眼睛」按钮。
 *   - 鼠标移到眼睛上 → 锚定在眼睛附近弹出预览卡片（离开延迟隐藏）。
 *   - 预览卡片顶部左侧为「复制 / 编辑」两个按钮，右侧为关闭按钮。
 */
(function initPromptItemUI() {
  'use strict';

  // ── SVG 图标 ───────────────────────────────────────────────────────────────
  const _EYE = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`;
  const _CLOSE = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

  // ── 预览卡片 CSS（供 shadow DOM 上下文 overlay.js 引用）────────────────────
  // popup.css / iframe.css 也复制了同一套样式，用于各自的非 shadow DOM 场景。
  const PREVIEW_CSS = `
.qshot-preview-card {
  position: fixed;
  z-index: 2147483647;
  width: 340px;
  max-width: calc(100vw - 20px);
  max-height: 360px;
  background: #ffffff;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 14px;
  box-shadow: 0 14px 40px rgba(15, 23, 42, 0.18);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: "Segoe UI", "Microsoft YaHei UI", "PingFang SC", Arial, sans-serif;
}
.qshot-preview-card[hidden] { display: none; }
.qshot-preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.07);
  flex-shrink: 0;
}
.qshot-preview-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}
.qshot-preview-btn {
  height: 28px;
  padding: 0 12px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 140ms ease, color 140ms ease, border-color 140ms ease;
  white-space: nowrap;
  font-family: inherit;
  line-height: 1;
}
.qshot-preview-btn--copy {
  border: none;
  background: #111111;
  color: #ffffff;
}
.qshot-preview-btn--copy:hover { background: #333333; }
.qshot-preview-btn--copy.is-copied { background: #2dbf62; }
.qshot-preview-btn--edit {
  border: 1px solid #dcdcdc;
  background: #ffffff;
  color: #333333;
}
.qshot-preview-btn--edit:hover {
  background: #f5f5f5;
  border-color: #c0c0c0;
}
.qshot-preview-close-btn {
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  border-radius: 50%;
  color: #666666;
  cursor: pointer;
  flex-shrink: 0;
  padding: 0;
  transition: background 120ms ease, color 120ms ease;
}
.qshot-preview-close-btn:hover {
  background: #f5f5f5;
  color: #111111;
}
.qshot-preview-title {
  padding: 10px 14px 0;
  font-size: 14px;
  font-weight: 600;
  color: #111111;
  line-height: 1.4;
  flex-shrink: 0;
}
.qshot-preview-body {
  flex: 1;
  overflow-y: auto;
  padding: 6px 14px 12px;
  font-size: 13px;
  line-height: 1.65;
  color: #444444;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
}
.qshot-preview-body::-webkit-scrollbar { width: 5px; }
.qshot-preview-body::-webkit-scrollbar-track { background: transparent; }
.qshot-preview-body::-webkit-scrollbar-thumb {
  background: #dcdcdc;
  border-radius: 3px;
}
`.trim();

  // ── 预览卡片管理器 ────────────────────────────────────────────────────────
  /**
   * @param {ShadowRoot|null} shadowRoot
   *   传入 ShadowRoot 则将卡片挂到 shadow DOM（overlay 场景）；
   *   传入 null 则挂到 document.body（popup / iframe 场景）。
   */
  function createPreviewManager(shadowRoot) {
    let cardEl = null;
    let hideTimer = null;
    let currentOnEdit = null;
    let currentPrompt = null;

    function getHost() {
      return shadowRoot || document.body;
    }

    function fallbackCopy(text) {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      } catch (_) { /* 静默失败 */ }
    }

    function ensureCard() {
      const host = getHost();
      if (!cardEl || !host.contains(cardEl)) {
        cardEl = document.createElement('div');
        cardEl.className = 'qshot-preview-card';
        cardEl.hidden = true;
        cardEl.addEventListener('mouseenter', () => {
          if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
        });
        cardEl.addEventListener('mouseleave', () => scheduleHide());
        host.appendChild(cardEl);
      }
      return cardEl;
    }

    /**
     * @param {HTMLElement} anchorEl
     * @param {{title?:string, content?:string}} prompt
     * @param {{ onEdit?: (p:any)=>void }} [opts]
     */
    function show(anchorEl, prompt, opts) {
      if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
      const card = ensureCard();
      card.innerHTML = '';
      currentPrompt = prompt;
      currentOnEdit = (opts && typeof opts.onEdit === 'function') ? opts.onEdit : null;

      // Header：左侧 复制 + 编辑，右侧 关闭
      const header = document.createElement('div');
      header.className = 'qshot-preview-header';

      const actions = document.createElement('div');
      actions.className = 'qshot-preview-actions';

      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'qshot-preview-btn qshot-preview-btn--copy';
      copyBtn.textContent = '复制';
      copyBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const text = (currentPrompt && currentPrompt.content) || '';
        const markCopied = () => {
          copyBtn.textContent = '✓ 已复制';
          copyBtn.classList.add('is-copied');
          setTimeout(() => {
            copyBtn.textContent = '复制';
            copyBtn.classList.remove('is-copied');
          }, 1500);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(markCopied).catch(() => {
            fallbackCopy(text);
            markCopied();
          });
        } else {
          fallbackCopy(text);
          markCopied();
        }
      });

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'qshot-preview-btn qshot-preview-btn--edit';
      editBtn.textContent = '编辑';
      editBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const cb = currentOnEdit;
        const p = currentPrompt;
        hide();
        if (cb) cb(p);
      });

      actions.appendChild(copyBtn);
      actions.appendChild(editBtn);

      const closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'qshot-preview-close-btn';
      closeBtn.setAttribute('aria-label', '关闭');
      closeBtn.innerHTML = _CLOSE;
      closeBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        hide();
      });

      header.appendChild(actions);
      header.appendChild(closeBtn);

      const titleRow = document.createElement('div');
      titleRow.className = 'qshot-preview-title';
      titleRow.textContent = (prompt && prompt.title) || '未命名提示词';

      const body = document.createElement('p');
      body.className = 'qshot-preview-body';
      body.textContent = (prompt && prompt.content) || '（暂无内容）';

      card.appendChild(header);
      card.appendChild(titleRow);
      card.appendChild(body);
      card.hidden = false;

      // 定位：优先在锚点下方，空间不足则翻转到上方
      requestAnimationFrame(() => {
        const rect = anchorEl.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const cardW = card.offsetWidth || 340;
        const cardH = card.offsetHeight || 200;
        let top = rect.bottom + 6;
        let left = rect.left;
        if (top + cardH > vh - 8) top = rect.top - cardH - 6;
        if (top < 8) top = 8;
        if (left + cardW > vw - 8) left = vw - cardW - 8;
        if (left < 8) left = 8;
        card.style.top = `${top}px`;
        card.style.left = `${left}px`;
      });
    }

    function hide() {
      if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
      if (cardEl) cardEl.hidden = true;
      currentOnEdit = null;
      currentPrompt = null;
    }

    function scheduleHide() {
      if (hideTimer) { clearTimeout(hideTimer); }
      hideTimer = setTimeout(() => hide(), 260);
    }

    function destroy() {
      hide();
      if (cardEl && cardEl.parentNode) cardEl.parentNode.removeChild(cardEl);
      cardEl = null;
    }

    return { show, hide, scheduleHide, destroy };
  }

  // ── 提示词条目工厂 ──────────────────────────────────────────────────────────
  /**
   * 创建一个完整的提示词条目 DOM 元素（标题 + 眼睛图标）。
   * 复制/编辑操作已统一迁移到预览卡片内，此处不再渲染对应图标。
   *
   * @param {Object} prompt        - { title, content }
   * @param {Object} opts
   *   - onFill(p)       点击标题时回调（填入输入框）
   *   - onEdit(p)       预览卡片内「编辑」按钮点击时回调
   *   - previewManager  createPreviewManager() 的返回值
   *   - itemClass       条目容器 CSS 类（默认匹配 popup/iframe 的样式）
   *   - labelClass      标题 CSS 类
   *   - iconsClass      图标区域 CSS 类
   *   - iconBtnClass    每个图标按钮 CSS 类
   */
  function createItem(prompt, {
    onFill,
    onEdit,
    previewManager,
    itemClass    = 'popup-prompt-item',
    labelClass   = 'popup-prompt-item-label',
    iconsClass   = 'popup-prompt-edit-wrap',
    iconBtnClass = 'popup-prompt-icon-btn',
  } = {}) {
    const item = document.createElement('div');
    item.className = itemClass;

    const label = document.createElement('span');
    label.className = labelClass;
    label.textContent = prompt.title || '未命名提示词';
    label.addEventListener('click', () => onFill && onFill(prompt));

    const icons = document.createElement('div');
    icons.className = iconsClass;

    // 仅保留「眼睛」图标：悬停 → 弹出预览（内置复制/编辑按钮）
    const eyeBtn = document.createElement('button');
    eyeBtn.type = 'button';
    eyeBtn.className = iconBtnClass;
    eyeBtn.setAttribute('aria-label', '预览');
    eyeBtn.title = '预览';
    eyeBtn.innerHTML = _EYE;
    if (previewManager) {
      eyeBtn.addEventListener('mouseenter', () => {
        previewManager.show(eyeBtn, prompt, { onEdit });
      });
      eyeBtn.addEventListener('mouseleave', () => previewManager.scheduleHide());
      eyeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        previewManager.show(eyeBtn, prompt, { onEdit });
      });
    }

    icons.appendChild(eyeBtn);
    item.appendChild(label);
    item.appendChild(icons);
    return item;
  }

  window.PromptItemUI = { createItem, createPreviewManager, PREVIEW_CSS };
})();
