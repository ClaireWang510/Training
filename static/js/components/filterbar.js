// 搜索与班级筛选条：名单与学分总表共用。

import { esc, html, raw } from '../lib/dom.js';

/**
 * 渲染筛选条。
 * @param {object} options
 * @param {object} options.search { value, action, label, placeholder }
 * @param {object} options.select { value, action, label, options: [{ value, label }] }
 */
export function filterbar({ search, select }) {
  const placeholder = search.placeholder ?? search.label;
  const options = select.options
    .map((option) => `<option value="${esc(option.value)}" ${String(option.value) === String(select.value ?? '') ? 'selected' : ''}>${esc(option.label)}</option>`)
    .join('');

  return html`
    <div class="filterbar">
      <div class="search">
        <input type="search" aria-label="${search.label}" placeholder="${placeholder}" value="${search.value ?? ''}" data-action="${search.action}">
        <span class="search-icon" aria-hidden="true"></span>
      </div>
      <select aria-label="${select.label}" data-action="${select.action}">${raw(options)}</select>
    </div>
  `;
}
