// 学分总表：按学员列出各活动的参与状态与学分，支持补修与更正登记。

import { esc, html, raw } from '../lib/dom.js';
import { openModal, toast } from '../lib/ui.js';
import { creditTotals, findEvent, findStudent, markText, store } from '../lib/store.js';
import { perform } from '../lib/actions.js';
import { crumb } from './home.js';

/** 渲染学分总表页面。 */
export function renderLedger() {
  const cohort = store.db;
  if (!cohort) return '';

  const headers = cohort.events
    .map((event) => `<th><button class="link" data-event="${esc(event.id)}">${esc(event.title)}</button><small>${esc(event.type)} · ${esc(String(event.points))} 学分</small></th>`)
    .join('');

  return html`
    ${raw(crumb('学分总表'))}
    <div class="pagehead"><h1>学分总表</h1><p class="muted">${cohort.name}</p></div>
    <div class="toolbar">
      <input id="searchLedger" aria-label="搜索姓名、学号、班级或院系" placeholder="搜索姓名、学号、班级或院系">
      <button class="btn" data-action="export-ledger">导出学分表</button>
    </div>
    <div class="tablewrap ledger">
      <table>
        <thead><tr><th>学员</th><th>班级</th>${raw(headers)}<th>必修</th><th>选修</th><th>总学分</th></tr></thead>
        <tbody id="ledgerBody"></tbody>
      </table>
    </div>
    <p class="fine">点击活动单元格，可登记补修或更正学分。</p>
  `;
}

/** 根据搜索条件刷新表格主体。 */
export function renderLedgerRows() {
  const body = document.getElementById('ledgerBody');
  if (!body) return;

  const keyword = (document.getElementById('searchLedger')?.value ?? '').trim();
  const cohort = store.db;
  const matched = cohort.students.filter((student) =>
    [student.name, student.id, student.cls, student.dept].some((value) => String(value ?? '').includes(keyword)));

  body.innerHTML = matched.map((student) => {
    const cells = cohort.events.map((event) => {
      const mark = event.marks?.[student.id];
      const suffix = mark ? ` · ${mark.points}` : '';
      return `<td><button class="ledgercell" data-student="${esc(student.id)}" data-event="${esc(event.id)}">${esc(markText(event, student.id))}${esc(suffix)}</button></td>`;
    }).join('');

    const totals = creditTotals(student.id);
    return `<tr><td>${esc(student.name)}<small>${esc(student.id)}</small></td><td>${esc(student.cls)}</td>`
      + cells
      + totals.map((value) => `<td>${esc(String(value))}</td>`).join('')
      + '</tr>';
  }).join('') || '<tr><td colspan="20">没有匹配的学员</td></tr>';
}

/** 导出学分总表为 Excel。 */
export function exportLedger() {
  const cohort = store.db;
  const header = ['姓名', '学号', '院系', '班级', ...cohort.events.flatMap((event) => [`${event.title} 状态`, `${event.title} 得分`]), '必修', '选修', '总学分'];

  const rows = cohort.students.map((student) => [
    student.name,
    student.id,
    student.dept,
    student.cls,
    ...cohort.events.flatMap((event) => [markText(event, student.id), event.marks?.[student.id]?.points ?? '']),
    ...creditTotals(student.id),
  ]);

  import('../lib/xlsx-write.js').then((module) => module.download('本期学分总表', [header, ...rows]));
}

/** 打开登记与更正学分弹窗。 */
export function editMark(studentId, eventId) {
  const student = findStudent(studentId);
  const event = findEvent(eventId);
  if (!student || !event) return;

  const mark = event.marks?.[studentId];
  const statuses = event.type === '必修' ? ['已补修', '已到课', '缺席'] : ['已到课', '缺席'];

  openModal('登记与更正学分', html`
    <p>${student.name} · ${event.title}</p>
    <form id="markForm">
      <label class="field">参与情况<select name="status">${raw(statuses
        .map((status) => `<option ${status === mark?.status ? 'selected' : ''}>${esc(status)}</option>`)
        .join(''))}</select></label>
      <label class="field">获得学分<input name="points" type="number" step="0.01" min="0" required max="${event.points}" value="${mark?.points ?? event.points}"></label>
      <label class="field">登记说明<textarea name="reason" required placeholder="例：已提交补修学习记录"></textarea></label>
      <div class="actions"><button class="primary">保存登记</button></div>
    </form>
  `);

  const form = document.getElementById('markForm');
  form.elements.status.onchange = () => {
    form.elements.points.value = form.elements.status.value === '缺席' ? 0 : event.points;
  };

  form.onsubmit = (submitEvent) => {
    submitEvent.preventDefault();
    const data = new FormData(form);
    const reason = String(data.get('reason') ?? '').trim();
    if (!reason) {
      toast('请填写登记说明');
      return;
    }
    const status = data.get('status');
    perform('marks', {
      event: eventId,
      rows: [{
        id: studentId,
        status,
        points: status === '缺席' ? 0 : Number(data.get('points')),
        reason,
      }],
    });
  };
}
