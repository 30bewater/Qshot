## Qshot Privacy Policy

**Effective Date:** 2026-05-25  
**Applies to:** Qshot browser extension version **1.1.5** and later (Chrome Web Store release)

Qshot is a locally-running browser extension that opens multiple AI/search sites side by side in a single page. When you explicitly trigger an action, it helps you fill in the same query into the input fields of those sites and submit them, so you can compare results easily.

This policy applies to the Qshot browser extension (hereinafter referred to as "the Extension").

---

### 1. What Information Do We Collect?

**We do not collect, operate, or upload any personal or device information to developer-controlled servers.**

Specifically, the Extension:

- Does not provide an account login/registration system with the developer
- Does not connect to any self-built backend service operated by the developer
- Does not include third-party analytics, advertising, or tracking SDKs
- Does not send your input content, browsing history, account information, or page content to any developer-controlled server

**Important distinction:** Features you choose to use may still send data **directly from your browser** to **third-party websites or AI API providers** (see Sections 4, 5, and 6). That is not collection by the developer, but you should review those third parties' privacy policies.

---

### 2. Does the Extension Share Information with Third Parties?

**The developer does not sell, rent, or transfer your locally stored data to advertising platforms, data brokers, or other organizations.**

However, when **you explicitly trigger** certain features, your browser may send data **directly** to third parties:

| Triggered by you | Sent to | Not sent to developer server |
|---|---|---|
| Search / send query | AI/search sites you selected (e.g., ChatGPT, DeepSeek) | Yes |
| AI one-click summary (after you enter an API Key) | The AI provider you configured (e.g., DeepSeek, Kimi, OpenRouter) | Yes |
| Pre-warming (optional, can be disabled) | Built-in target sites | Yes |

The developer does not receive, store, or process the content of those requests on its own servers.

---

### 3. What Does the Extension Store Locally? (Local Only)

To provide its features, the Extension stores configuration and usage data in your browser's local storage (e.g., `chrome.storage.local`), which may include but is not limited to:

- **Search groups & custom sites**: Enabled sites, group layout, and custom URL templates you add
- **Prompt library**: Prompt groups and prompt text you create, edit, or import
- **Search history (optional)**: Past queries and comparison sessions for review within the Extension
- **Quick-access sites**: Sites pinned for fast access in the overlay / global search bar
- **Selection context groups**: Right-click menu entries that attach a prompt to selected text
- **AI summary settings (optional)**: Provider choice, model names, summary prompt templates, and **API Keys you enter** — stored locally only
- **UI preferences**: Layout, card size, dark mode, shortcut keys, overlay/context-menu toggles, pre-warm setting, etc.
- **Import/export files**: When you export settings to a JSON file, the file is saved to a location you choose on your device; the developer does not receive it

All of the above is **stored locally on your device only**. The Extension does not provide cloud sync by the developer. If you use your browser's own sync, that behavior is governed by your browser/account provider.

**Sensitive data note:** API Keys you enter for AI summary are stored locally like other settings. Protect your device and avoid sharing exported JSON files that contain keys.

---

### 4. Interaction with Third-Party Websites (Only When You Trigger It)

When you use the Extension to open an AI or search site, your browser directly accesses those sites. They may process your data (login status, cookies, content you submit) under their own privacy policies.

Core interactions:

- **Side-by-side loading**: Selected sites load in iframes/cards inside the Extension's compare page
- **Auto-fill and submit**: When you click Send (or equivalent), your input is written into the target site's field and submitted **from your browser to that site**
- **On-site prompt launcher (optional)**: On supported AI sites, a small Qshot entry may appear near the input box so you can open your prompt library. This runs locally in the page context and does not upload data to the developer
- **Selection search bubble (optional, off by default)**: When enabled, selecting text on a page may show a Qshot bubble; using it sends the selected text to sites you configured — same as typing in the popup

> **Important:** "Not uploaded to the developer's server" does **not** mean your query stays private on the internet. When you send a query to a third-party site, that site receives it.

---

### 5. Content Extraction (Export / Copy — Local Processing)

When you use **Export** or **Copy** on the compare page, the Extension may extract readable text from open target pages to build Markdown or clipboard content.

- **Trigger**: Only when you perform export/copy — no background collection
- **Processing**: Done locally in your browser
- **Upload**: Not sent to the developer's server

---

### 6. AI One-Click Summary (Optional — Third-Party API)

When you configure an AI summary provider and API Key in Settings, you can summarize extracted multi-model answers on the compare page.

- **Trigger**: Only when you click to run AI summary
- **What is sent**: The Extension builds a text payload from extracted compare-page content (and your configured summary prompt) and sends it **directly from your browser** to the **third-party API endpoint** you chose (e.g., DeepSeek, Kimi, OpenRouter, SiliconFlow, Zhipu, or a custom OpenAI-compatible URL)
- **API Key**: Stored locally; sent only in the `Authorization` header to your chosen provider — **not** to the developer's server
- **Developer role**: The developer does not proxy, log, or store these requests on its own infrastructure

Please review your chosen AI provider's terms and privacy policy before entering an API Key or sending sensitive content.

---

### 7. Pre-warming Requests (Optional — Can Be Disabled)

To reduce initial load time for some heavy sites, the Extension may send lightweight **pre-warming requests** to certain built-in sites when you open the popup or overlay.

- **Trigger**: Local, on extension use; can be disabled in Settings → Other
- **Data**: Requests go directly to target sites; no upload to the developer's server

---

### 8. Config Import / Export (Local Files)

Settings allow you to export selected modules (search groups, custom sites, quick-access sites, selection context groups, AI summary settings) to a JSON file, and import them later.

- **Scope**: You choose what to export/import
- **Storage**: Files remain on your device unless you share them yourself
- **Overwrite**: Import replaces only the modules you select — it does not automatically clear unrelated local data such as search history unless that module is included

---

### 9. Permissions and Usage (Item by Item)

The Extension follows a minimum-necessary permission model. Permissions in the **1.1.5 store release** include:

#### 9.1 `storage`

- **Purpose**: Persist groups, prompts, history, preferences, optional API Keys, and related settings locally
- **Data flow**: Local only

#### 9.2 `activeTab`

- **Purpose**: Run overlay/quick actions on the tab you are actively using when you trigger an action
- **Data flow**: Local page context only

#### 9.3 `tabs`

- **Purpose**: Open/coordinate compare pages, site tabs, and tab state needed for user-triggered search/send flows
- **Data flow**: Local only

#### 9.4 `windows`

- **Purpose**: Open the Extension popup UI in a small window when keyboard shortcuts cannot use the toolbar popup (e.g., on restricted pages such as `chrome://`)
- **Data flow**: Local UI only; no data upload

#### 9.5 `declarativeNetRequest`

- **Purpose**: Apply declarative rules (e.g., adjust response headers like `content-security-policy` / `x-frame-options`) so selected third-party sites can render inside compare-page iframe cards
- **Data flow**: Local network stack only; not forwarded to the developer

#### 9.6 `host_permissions: <all_urls>` (and matching content scripts)

- **Purpose**: Run content scripts on pages you visit to:
  - Show/hide the Ctrl+Q overlay
  - Find input fields, fill text, and trigger send
  - Show optional selection-search bubble (when enabled)
  - Extract readable text when you export/copy/summarize
  - Support user-defined custom site URLs
- **Why all URLs**: Custom sites and varied AI/search domains require on-page automation; scripts run only in your browser
- **Data flow**: Local execution; not uploaded to the developer

#### 9.7 `commands` (keyboard shortcuts)

- **Purpose**: Invoke the overlay or popup entry via shortcuts (default: `Ctrl+Q`)
- **Data flow**: Local only

#### 9.8 `alarms`

- **Purpose**: Keep the MV3 service worker responsive (e.g., context menu rebuild, shortcut sync) via periodic local wake-ups — timers only, no outbound data
- **Data flow**: Local only

#### 9.9 `contextMenus`

- **Purpose**: Add Qshot entries when you select text — search groups, quick-access sites, and optional prompt-attached context groups
- **Data flow**: Selected text is processed locally and sent **only to sites you configured**, directly from your browser

---

### 10. Updates and Existing Local Data

When you update the Extension through the browser store, your existing local data (prompts, search history, groups, settings, etc.) is generally **retained** by the browser in `chrome.storage.local`.

Built-in default presets apply only when corresponding data is **missing** on first install. Updating does **not** reset your prompts or history to factory defaults.

Uninstalling the Extension typically removes its local storage.

---

### 11. Data Security

Because the developer does not operate a centralized data store for Extension usage, there is no developer-side database breach surface for your Extension data.

Your local data security depends on your device, OS account, browser profile, and which third-party sites/APIs you use.

We recommend:

- Install only from trusted sources (e.g., Chrome Web Store)
- Keep your browser and extensions updated
- Treat API Keys like passwords; do not share exported JSON containing keys
- Be cautious submitting sensitive content to third-party AI/search sites or summary APIs

---

### 12. Your Rights and Choices

You may at any time:

- **View and manage data** in the Extension settings (groups, prompts, shortcuts, AI summary, etc.)
- **Disable optional features**: pre-warming, context menu, selection bubble, on-site prompt launcher, etc.
- **Clear or remove data**: use in-app clear options where available, import/export to backup, uninstall the Extension, or delete extension data via browser settings
- **Restrict permissions**: adjust site access in the browser's extension management page

---

### 13. Children's Privacy

This Extension is not directed at children under 13. The developer does not knowingly collect personal information from children through its own servers. Minors should use the Extension with parental guidance and understand that third-party sites they interact with have their own policies.

---

### 14. How This Policy Is Updated

We may update this policy when features or compliance requirements change. The Effective Date at the top will be revised accordingly. Material changes will be noted in release notes or on the extension listing where applicable.

---

### 15. Contact

For privacy-related inquiries:

- **Email**: 1938686623@qq.com
- **GitHub**: Submit an Issue in the extension's project repository (link on the extension homepage)
