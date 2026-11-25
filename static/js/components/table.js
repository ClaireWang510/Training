// 表格组件：统一表头、空状态与滚动容器。
// 表头与行内容由调用方负责转义（通常已经过 esc()/html() 处理）。

import { esc, html, raw } from '../lib/dom.js';

/**
 * 渲染表格。
 * @param {object} options
 * @param {string[]} options.headers 表头 HTML 片段
 * @param {string[]} options.rows 每行的 <tr> HTML 片段
 * @param {string} [options.wrapClass] 外层容器类名
 * @param {string} [options.tbodyId] tbody 的 id，便于局部刷新
 * @param {string} [options.empty] 无数据时的提示文案
 * @param {number} [options.colspan] 空状态占用的列数
 */
export function table({
  headers,
  rows,
  wrapClass = 'tablewrap',
  tbodyId = '',
  empty = '暂无数据',
  colspan = headers.length,
}) {
  const head = headers.map((cell) => `<th>${cell}</th>`).join('');
  const body = rows.length
    ? rows.join('')
    : `<tr><td colspan="${colspan}">${esc(empty)}</td></tr>`;

  return html`
    <div class="${wrapClass}">
      <table>
        <thead><tr>${raw(head)}</tr></thead>
        <tbody${raw(tbodyId ? ` id="${esc(tbodyId)}"` : '')}>${raw(body)}</tbody>
      </table>
    </div>
  `;
}
