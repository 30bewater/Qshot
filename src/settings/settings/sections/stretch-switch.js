/** Shared stretch toggle markup (Uiverse-style checkbox switch). */
export function renderStretchSwitchMarkup(isOn) {
  return `
    <label class="other-setting-switch--stretch">
      <input type="checkbox" class="other-setting-switch--stretch-input"${isOn ? " checked" : ""} />
      <span class="other-setting-switch--stretch-slider"></span>
    </label>
  `;
}
