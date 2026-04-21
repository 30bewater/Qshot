## Qshot Privacy Policy

Effective Date: 2026-04-21

Qshot is a locally-running browser extension that opens multiple AI/search sites side by side in a single page. When you explicitly trigger an action, it helps you fill in the same query into the input fields of those sites and submit them, so you can compare results easily.

This policy applies to the Qshot browser extension (hereinafter referred to as "the Extension").

---

### 1. What Information Do We Collect?

**We do not collect or upload any personal or device information to developer servers.**

Specifically, the Extension:

- Does not provide an account login/registration system
- Does not connect to any self-built backend service
- Does not include third-party analytics or tracking SDKs
- Does not send your input content, browsing history, account information, or page content to any developer-controlled server

---

### 2. Does the Extension Share Information with Third Parties?

**No.**

The Extension does not sell, share, or transfer locally stored data to third-party advertising platforms, data brokers, or any other organizations.

---

### 3. What Does the Extension Store Locally? (Local Only)

To provide its features, the Extension stores usage-related configuration data in your browser's local storage (e.g., `chrome.storage.local`), which may include but is not limited to:

- **Sites/Groups and Enable Status**: Sites you have enabled/disabled, group information, and custom site URL templates you have added
- **Prompt Library**: Prompt groups and content you have created or imported
- **Search History (Optional)**: Used to review past queries and comparison sessions within the Extension
- **UI Preferences**: Such as layout, concurrent loading settings, shortcut key preferences, etc.

All of the above data is **stored locally on your device only**. The Extension does not provide cloud sync. If you have enabled your browser's own sync mechanism, that behavior is governed by the browser/account system and is unrelated to the Extension's servers.

---

### 4. Interaction with Third-Party Websites (Only When You Trigger It)

When you use the Extension to open an AI or search site, your browser directly accesses those sites (e.g., `chatgpt.com`, `claude.ai`). These third-party sites may process your data (e.g., login status, content you input on their site, cookies) according to their own privacy policies.

The Extension's core interactions are:

- **Side-by-side site loading**: The Extension loads your selected third-party sites in iframes/cards within the extension page
- **Auto-fill and submit (only when you click "Send" or similar actions)**: When you trigger a send action, your input is written into the target site's input field and submitted. The content is then sent **directly from your browser to the target site** — not to the developer's server.

> **Important**: "Not uploaded to the developer's server" does not mean "your input won't be sent to third-party sites." When you choose to send a query to a site, your content will necessarily be transmitted to that site — this is your voluntary use of a third-party service.

---

### 5. Content Extraction (For Export / Summary / Copy)

When you use features such as "Export / Summary / Copy" on the comparison page, the Extension may extract readable text from the open target site pages to generate exported Markdown or summarized results.

- **Trigger**: Only triggered when you perform export/summary/copy actions — no background collection occurs
- **Scope**: Processed and displayed/exported locally only; not uploaded to the developer's server

---

### 6. Pre-warming Requests (To Improve Load Speed, Can Be Disabled)

To reduce the initial load time for some heavy sites, the Extension may send **pre-warming requests** to certain built-in sites when you open the extension popup or invoke the overlay.

- **Trigger**: Triggered locally by the Extension; can be disabled in settings (if the option is available)
- **Data handling**: Network requests go directly to the target sites; the Extension does not upload any data to the developer's server

---

### 7. Permissions and Usage (Item by Item)

To implement the above features, the Extension may request or use the following permissions. We follow the principle of minimum necessary permissions.

#### 7.1 `storage`

- **Purpose**: Store your site configurations, groups, Prompts, preferences, and optional history locally in the browser
- **Data flow**: Local only; not uploaded to the developer's server

#### 7.2 `activeTab`

- **Purpose**: Inject/run scripts related to invoking the overlay and quick actions on the page you are currently visiting, based on your explicit actions (applies only to the currently active tab)
- **Data flow**: Executed only in the local page context; not uploaded to the developer's server

#### 7.3 `tabs`

- **Purpose**: Manage and coordinate interactions between the extension page and browser tabs (e.g., opening/focusing related pages, obtaining necessary tab state to complete user-triggered actions)
- **Data flow**: Local only; not uploaded to the developer's server

#### 7.4 `declarativeNetRequest`

- **Purpose**: Modify network response/request headers for certain sites using declarative rules (e.g., removing `content-security-policy` / `x-frame-options` restrictions) so that sites can be displayed within the Extension's iframe cards. This is solely used to enable proper rendering of third-party sites inside the Extension — it is not used to intercept, tamper with, or monitor user data.
- **Data flow**: Operates at the browser's local network stack level; the Extension does not forward any network content to the developer's server

#### 7.5 `host_permissions: <all_urls>` (and content script matching `<all_urls>`)

- **Purpose**: Allows the Extension to run content scripts on target site pages you open, in order to:
  - Invoke/display the overlay
  - Locate input fields on the page and write text into them
  - Trigger the send button or submit via Enter
  - Extract readable text from the page (only when you trigger export/summary features)
- **Why all sites**: The Extension supports user-selected and custom sites with URL templates. Since different sites have different input/button structures, content scripts need to run on the corresponding pages to perform automation steps.
- **Data flow**: Scripts execute in the local page context; not uploaded to the developer's server

#### 7.6 `commands` (Keyboard Shortcuts)

- **Purpose**: Allows you to invoke the extension overlay/feature entry via keyboard shortcuts (e.g., `Ctrl+Q`)
- **Data flow**: Local only; not uploaded to the developer's server

---

### 8. Data Security

Since the Extension does not upload data to the developer's server, there is no risk of server-side data breaches from centralized storage. The security of your local data depends primarily on your device and browser environment (e.g., OS account permissions, malware, browser extension ecosystem).

We recommend:

- Only install extensions from trusted sources
- Keep your browser and extensions up to date
- Be cautious about entering sensitive information into third-party sites (such data will be handled by those sites according to their own privacy policies)

---

### 9. Your Rights and Choices

You may at any time:

- **View and manage local data**: View/adjust sites, Prompts, and preferences in the extension settings page (if provided)
- **Delete local data**:
  - Clear relevant data in the extension's settings page (if a clear option is provided); or
  - Uninstall the Extension from the browser's extension management page (uninstalling typically removes the extension's local storage data); or
  - Delete the extension's data via the browser's site/extension data management (advanced)
- **Restrict permissions**: Adjust site access permissions in the browser's extension management page (controls may vary by browser)

---

### 10. Children's Privacy

**This Extension is not designed for or directed at children under the age of 13.**

We do not knowingly collect personal information from children. Since the Extension itself does not collect any personal data from users (see Section 1), no personal data will be collected from children by the developer when using this Extension.

If you are a minor, we recommend using this Extension under the guidance of a parent or guardian. Please also be aware that any content you input on third-party AI/search sites will be handled by those sites according to their own privacy policies.

---

### 11. How This Policy Is Updated

We may update this policy in response to feature changes or compliance requirements. The "Effective Date" at the top of this document will be updated accordingly. If an update involves a material change to how the Extension handles data, we will provide a more prominent notice in the release notes or on the extension page (where applicable).

---

### 12. Contact

For privacy-related inquiries, please contact us via:

- **Email**: 1938686623@qq.com
- **GitHub**: Please submit an Issue in the extension's project repository (link available on the extension homepage)