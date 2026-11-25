// 列表翻页组件：学员名单与学分总表共用。

import { html, raw } from '../lib/dom.js';

/**
 * 渲染分页条。
 * @param {object} options
 * @param {number} options.total 记录总数
 * @param {number} options.page 当前页（从 0 开始）
 * @param {number} options.pageSize 每页数量
 * @param {string} options.action 翻页动作名，按钮会带上 data-delta
 * @param {string} [options.unit] 数量单位
 */
export function pager({ total, page, pageSize, action, unit = '名学员' }) {
  const last = Math.max(0, Math.ceil(total / pageSize) - 1);
  const current = Math.min(page, last);

  return html`
    <div class="pager">
      <span>共 ${total} ${unit}</span>
      <div class="pager-controls">
        <button class="btn" data-action="${action}" data-delta="-1" ${raw(current === 0 ? 'disabled' : '')}>上一页</button>
        <span>${current + 1} / ${last + 1}</span>
        <button class="btn" data-action="${action}" data-delta="1" ${raw(current === last ? 'disabled' : '')}>下一页</button>
      </div>
    </div>
  `;
}
