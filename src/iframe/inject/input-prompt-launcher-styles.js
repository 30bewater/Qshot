import { ICON_SIZE, PANEL_HEIGHT_PX } from "./input-prompt-launcher-constants.js";

export const LAUNCHER_SHELL_CSS = `
  :host { all: initial; }
  .root {
    position: fixed;
    z-index: 2147483646;
    font-family: "Segoe UI", "Microsoft YaHei UI", "PingFang SC", sans-serif;
    pointer-events: none;
  }
  .root.hidden { display: none; }
  .fab {
    position: fixed;
    z-index: 2147483647;
    width: ${ICON_SIZE}px;
    height: ${ICON_SIZE}px;
    border-radius: 50%;
    border: 1px solid #e0e0e0;
    background: #fff;
    color: #111;
    box-shadow: 0 2px 10px rgba(0,0,0,0.14);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    pointer-events: auto;
    padding: 0;
    transition: transform 0.12s, box-shadow 0.12s;
  }
  .fab:hover { transform: scale(1.06); box-shadow: 0 3px 14px rgba(0,0,0,0.18); }
  .fab.open { background: #111; color: #fff; border-color: #111; }
  .fab.dragging {
    cursor: grabbing;
    transition: none;
    transform: scale(1.08);
    box-shadow: 0 4px 16px rgba(0,0,0,0.22);
  }
  .fab.spin-fire {
    border-color: #ff8c32;
    color: #fff;
    background: radial-gradient(circle at 35% 30%, #fff6a8, #ff6a00 58%, #c41e00);
  }
  .launcher-spin-canvas {
    position: fixed;
    inset: 0;
    width: 100vw;
    height: 100vh;
    pointer-events: none;
    z-index: 2147483646;
  }
  .launcher-picker-shell {
    position: fixed !important;
    top: auto;
    left: auto;
    right: auto;
    bottom: auto;
    z-index: 2147483647 !important;
    perspective: 1200px;
    perspective-origin: center center;
    display: none;
    pointer-events: none;
  }
  .launcher-picker-shell.open {
    display: block;
    pointer-events: auto;
  }
  .launcher-picker-shell[hidden] { display: none !important; }
  .launcher-picker {
    position: relative !important;
    top: auto !important;
    left: auto !important;
    right: auto !important;
    bottom: auto !important;
    width: min(256px, calc(100vw - 24px));
    height: ${PANEL_HEIGHT_PX}px;
    min-height: ${PANEL_HEIGHT_PX}px;
    max-height: ${PANEL_HEIGHT_PX}px;
    grid-template-columns: 70px minmax(0, 1fr) !important;
    grid-template-rows: 1fr auto !important;
    display: none;
    pointer-events: auto !important;
    overflow: hidden;
    transform-style: preserve-3d;
    backface-visibility: hidden;
  }
  .launcher-picker.open {
    display: grid !important;
    pointer-events: auto !important;
    transition: transform 0.12s ease, box-shadow 0.12s ease;
    will-change: transform, box-shadow;
  }
  .launcher-picker .prompt-groups-col,
  .launcher-picker .prompt-list-col,
  .launcher-picker .prompt-picker-footer,
  .launcher-picker .prompt-item,
  .launcher-picker .prompt-group-item,
  .launcher-picker .prompt-picker-footer-btn {
    pointer-events: auto;
  }
  .launcher-picker[hidden] { display: none !important; }
  .launcher-backdrop {
    position: fixed;
    inset: 0;
    z-index: 2147483645;
    display: none;
    pointer-events: auto;
    background: transparent;
  }
  .launcher-backdrop.visible { display: block; }
  .launcher-picker .prompt-groups-col {
    padding: 6px;
    min-height: 0;
    max-height: none;
    overflow-y: auto;
    gap: 4px;
  }
  .launcher-picker .prompt-list-col {
    min-height: 0;
    max-height: none;
    overflow-y: auto;
    padding: 4px 0;
  }
  .launcher-picker .prompt-group-item {
    padding: 5px 6px;
    font-size: 10px;
    min-height: 26px;
  }
  .launcher-picker .prompt-item {
    min-height: 29px;
    padding: 3px 10px;
    font-size: 11px;
  }
  .launcher-picker .prompt-icon-btn {
    width: 18px;
    height: 18px;
  }
  .launcher-picker .prompt-empty {
    padding: 10px;
    font-size: 10px;
  }
  .launcher-picker .prompt-picker-footer {
    padding: 4px 0;
  }
  .launcher-picker .prompt-picker-footer-btn {
    font-size: 10px;
    padding: 2px 6px;
  }
  .fab.edge-left,
  .fab.edge-right {
    transition: transform 0.2s ease, box-shadow 0.12s;
  }
  .fab.edge-left:hover {
    transform: translateX(${Math.round(ICON_SIZE / 2)}px) scale(1.04);
    box-shadow: 0 3px 16px rgba(0,0,0,0.2);
  }
  .fab.edge-right:hover {
    transform: translateX(-${Math.round(ICON_SIZE / 2)}px) scale(1.04);
    box-shadow: 0 3px 16px rgba(0,0,0,0.2);
  }
  @media (prefers-color-scheme: dark) {
    .fab { background: #1e1e1e; border-color: #444; color: #fff; }
    .fab.open { background: #fff; color: #111; border-color: #fff; }
    .launcher-picker {
      border-color: #3f3f46;
      background: #27272a;
      box-shadow: 0 18px 34px rgba(0, 0, 0, 0.5);
    }
    .launcher-picker .prompt-groups-col {
      background: #2a2a2e;
      border-right-color: rgba(255, 255, 255, 0.08);
    }
    .launcher-picker .prompt-group-item { color: #d4d4d8; }
    .launcher-picker .prompt-group-item.is-active,
    .launcher-picker .prompt-group-item:hover {
      background: #f4f4f5;
      color: #18181b;
    }
    .launcher-picker .prompt-item {
      color: #f4f4f5;
      border-bottom-color: rgba(255, 255, 255, 0.07);
    }
    .launcher-picker .prompt-item:hover { background: #3f3f46; }
    .launcher-picker .prompt-icon-btn { color: #71717a; }
    .launcher-picker .prompt-icon-btn:hover {
      background: #3f3f46;
      color: #d4d4d8;
    }
    .launcher-picker .prompt-empty { color: #71717a; }
    .launcher-picker .prompt-picker-footer {
      border-top-color: rgba(255, 255, 255, 0.07);
      background: #2a2a2e;
    }
    .launcher-picker .prompt-picker-footer-btn { color: #71717a; }
    .launcher-picker .prompt-picker-footer-btn:hover {
      color: #d4d4d8;
      background: #3f3f46;
    }
  }
`;
