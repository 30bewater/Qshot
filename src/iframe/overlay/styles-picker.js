import { PROMPT_PICKER_STYLES } from "../../shared/prompt-picker-styles.js";

const OVERLAY_PANEL_STYLES = `
  .panel-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    animation: qshotPopIn 180ms cubic-bezier(.2,.9,.3,1.1) forwards;
    transform: translateY(var(--qshot-panel-offset-y)) scale(var(--qshot-panel-scale));
  }
  .hint-row {
    display: flex;
    justify-content: center;
    color: rgba(255, 255, 255, 0.78);
    font-size: 12px;
    user-select: none;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
  }
  .kbd {
    display: inline-block;
    padding: 1px 6px;
    margin: 0 3px;
    border-radius: 3px;
    background: rgba(255, 255, 255, 0.18);
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 11px;
  }
  .panel { position: relative; }
  .settings-corner-btn {
    position: absolute;
    bottom: 5px;
    right: 5px;
    width: 24px;
    height: 24px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: #bbb;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: color 150ms ease, background 150ms ease, transform 150ms ease;
  }
  .settings-corner-btn:hover {
    color: #555;
    background: rgba(0, 0, 0, 0.06);
    transform: rotate(30deg);
  }
  .settings-corner-btn svg {
    width: 13px;
    height: 13px;
    display: block;
    flex-shrink: 0;
  }
`;

export const OVERLAY_PICKER_STYLES = PROMPT_PICKER_STYLES + OVERLAY_PANEL_STYLES;
