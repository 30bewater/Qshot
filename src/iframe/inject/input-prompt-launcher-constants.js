export const HOST_ID = "qshot-input-prompt-launcher";
export const ICON_SIZE = 30;
export const GAP_ABOVE = 6;
export const PANEL_HEIGHT_PX = 214;

export const Q_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 113 133" fill="currentColor" width="16" height="16" aria-hidden="true">
  <path d="M56.0371 6.96199C74.4324 6.96199 88.0516 12.8731 96.8946 24.6953C103.799 33.9166 107.251 45.7151 107.251 60.0909C107.251 75.6489 103.302 88.5823 95.405 98.8913C86.1364 110.997 72.9192 117.05 55.7534 117.05C39.7225 117.05 27.1201 111.754 17.9461 101.161C9.76512 90.9468 5.67465 78.0369 5.67465 62.4317C5.67465 48.3396 9.17401 36.281 16.1727 26.2558C25.1576 13.3933 38.4457 6.96199 56.0371 6.96199ZM57.4558 104.424C69.8927 104.424 78.8776 99.9789 84.4104 91.0886C89.9904 82.151 92.7805 71.8894 92.7805 60.3037C92.7805 48.0559 89.5648 38.1962 83.1336 30.7246C76.7496 23.253 68.0012 19.5171 56.8883 19.5171C46.1065 19.5171 37.3108 23.2293 30.5012 30.6536C23.6916 38.0307 20.2869 48.9307 20.2869 63.3538C20.2869 74.8922 23.1951 84.6337 29.0116 92.5782C34.8754 100.475 44.3568 104.424 57.4558 104.424Z"/>
  <path d="M85.6722 120.993L99.8913 108.913L103.658 113.929C103.793 114.103 103.894 114.304 103.954 114.52C104.015 114.737 104.034 114.965 104.01 115.19C103.962 115.621 103.751 116.034 103.387 116.343L91.7391 126.299C91.574 126.446 91.383 126.556 91.1774 126.623C90.9719 126.691 90.7562 126.713 90.5435 126.689C90.3307 126.665 90.1253 126.596 89.9397 126.485C89.7542 126.374 89.5923 126.224 89.464 126.044L85.6722 120.993Z"/>
  <path d="M70.1657 86.8584C70.2721 85.91 71.0905 85.216 71.9842 85.3163C79.1344 86.1186 85.5494 89.8069 90.0587 95.8135L97.9945 106.387L83.7734 118.466L75.7928 107.833C71.2738 101.913 69.3143 94.4462 70.1657 86.8584Z"/>
</svg>`;

export const DEFAULT_INPUT_FALLBACK = [
  "#prompt-textarea",
  "textarea",
  "motion-prompt textarea",
  "div.ProseMirror[contenteditable='true']",
  "div[contenteditable='true']",
  "[contenteditable='true']",
];

export const DEFAULT_ANCHOR_SELECTORS = [
  "form[data-type='unified-composer']",
  "footer form",
  "footer",
  "form",
  "[class*='composer']",
  "[class*='input-area']",
  "[class*='chat-input']",
];

export const SITE_INPUT_EXTRAS = {
  deepseek: ["[placeholder*='\u53d1\u9001']", "[placeholder*='\u95ee\u70b9']"],
  doubao: ["[data-testid*='chat-input']"],
  kimi: [
    "div.chat-input-editor[contenteditable='true']",
    "[data-lexical-editor='true'][contenteditable='true']",
    "[class*='chat-input'] [contenteditable='true']",
  ],
  qianwen: [
    ".t-chat__sender div[contenteditable='true']",
    ".t-chat-sender div[contenteditable='true']",
    "[class*='sender'] div[contenteditable='true']",
    "[data-slate-editor='true']",
    "[class*='chat-input'] div[contenteditable='true']",
  ],
  qwen: [
    "textarea",
    "div[contenteditable='true']",
    "[role='textbox']",
    "[class*='chat-input'] div[contenteditable='true']",
  ],
  grok: [
    "textarea[placeholder*='\u77e5\u9053']",
    "textarea[placeholder*='know']",
    "textarea[placeholder*='Ask']",
    "textarea",
    "[contenteditable='plaintext-only']",
    "[contenteditable='true'][role='textbox']",
    "[contenteditable='true']",
    "[class*='composer'] textarea",
    "[class*='composer'] [contenteditable]",
  ],
  copilot: [
    ".fai-EditorInput__input",
    "[class*='EditorInput'] [contenteditable='true']",
    "[class*='EditorInput'] textarea",
    "[class*='EditorInput'] [role='textbox']",
    "textarea[placeholder*='Copilot']",
    "textarea[placeholder*='\u53d1\u9001']",
    "[placeholder*='Copilot'][contenteditable]",
    "[role='textbox'][contenteditable='true']",
  ],
};

export const SITE_ANCHOR_EXTRAS = {
  chatgpt: ["form[data-type='unified-composer']", "form.stretch"],
  kimi: ["[class*='chat-input']", "[class*='composer']", "footer"],
  qianwen: [
    "[class*='chat-sender']",
    "[class*='sender']",
    "[class*='chat-input']",
    "footer",
  ],
  qwen: [
    "[class*='chat-input']",
    "[class*='composer']",
    "footer",
  ],
  grok: [
    "[class*='composer']",
    "form",
    "footer",
    "[class*='input']",
  ],
  copilot: [
    "[class*='EditorInput']",
    "[class*='composer']",
    "[class*='input']",
    "footer",
    "form",
  ],
};
