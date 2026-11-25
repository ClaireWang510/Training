// 学分总表：按学员列出各活动的参与状态与学分，支持补修与更正登记。

import { esc, html, raw, updateRegion } from '../../lib/dom.js';
import { creditTotals, filterStudents, markText, store, studentClasses } from '../../lib/store.js';
import { filterbar } from '../../components/filterbar.js';
import { pager } from '../../components/pager.js';
import { table } from '../../components/table.js';
import { crumb } from '../home/index.js';

/** 每页显示的学员数量，与学员名单保持一致。 */
const PAGE_SIZE = 15;

/** 计算当前筛选条件下的学员与分页。 */
function ledgerView() {
  const state = store.ui.ledger;
  const matched = filterStudents(state);
  const last = Math.max(0, Math.ceil(matched.length / PAGE_SIZE) - 1);
  state.page = Math.min(state.page, last);
  return {
    matched,
    last,
    rows: matched.slice(state.page * PAGE_SIZE, state.page * PAGE_SIZE + PAGE_SIZE),
  };
}

/** 渲染学分总表页面。 */
export function renderLedger() {
  const cohort = store.db;
  if (!cohort) return '';

  const headers = cohort.events.map((event) => `<button class="link" data-action="open-event" data-id="${esc(event.id)}">${esc(event.title)}</button><small>${esc(event.type)} · ${esc(String(event.points))} 学分</small>`);
  const view = ledgerView();

  return html`
    ${raw(crumb('学分总表'))}
    <div class="pagehead pagehead-row">
      <div><h1>学分总表</h1><p class="muted">${cohort.name}</p></div>
      <button class="btn" data-action="export-ledger">导出学分表</button>
    </div>
    ${raw(filterbar({
      search: {
        value: store.ui.ledger.query,
        action: 'ledger-search',
        label: '搜索姓名、学号、学院或班级',
      },
      select: {
        value: store.ui.ledger.filterClass,
        action: 'ledger-filter',
        label: '按班级筛选',
        options: [{ value: '', label: '全部班级' }, ...studentClasses().map((item) => ({ value: item, label: item }))],
      },
    }))}
    ${raw(table({
      wrapClass: 'tablewrap ledger',
      tbodyId: 'ledgerBody',
      headers: ['学员', '班级', ...headers, '必修', '选修', '总学分'],
      rows: ledgerRows(view.rows),
      empty: '没有匹配的学员',
    }))}
    <div id="ledgerPager">${raw(ledgerPager(view))}</div>
    <p class="fine">单元格显示该活动获得的学分（未参加为 0）；点击学员姓名查看资料，点击活动单元格可更正学分。</p>
  `;
}

/** 表格主体行。 */
function ledgerRows(students) {
  const cohort = store.db;
  return students.map((student) => {
    const cells = cohort.events.map((event) => {
      const mark = event.marks?.[student.id];
      const points = String(Number(mark?.points ?? 0));
      return `<td><button class="ledgercell${points === '0' ? ' is-zero' : ''}" data-action="edit-mark" data-student="${esc(student.id)}" data-event="${esc(event.id)}" aria-label="${esc(student.name)}在${esc(event.title)}获得的学分">${esc(points)}</button></td>`;
    }).join('');

    const totals = creditTotals(student.id);
    return `<tr><td><button class="ro-name" data-action="view-student" data-id="${esc(student.id)}">${esc(student.name)}</button><small>${esc(student.id)}</small></td>`
      + `<td>${esc(student.cls)}</td>`
      + cells
      + totals.map((value) => `<td>${esc(String(value))}</td>`).join('')
      + '</tr>';
  });
}

/** 分页条。 */
function ledgerPager(view) {
  return pager({
    total: view.matched.length,
    page: store.ui.ledger.page,
    pageSize: PAGE_SIZE,
    action: 'ledger-turn',
  });
}

/** 只刷新表格主体与分页条。 */
function refreshLedger() {
  const view = ledgerView();
  updateRegion('ledgerBody', ledgerRows(view.rows).join(''));
  updateRegion('ledgerPager', ledgerPager(view));
}

/** 按关键字搜索学员。 */
export function searchLedger(keyword) {
  store.ui.ledger.query = keyword;
  store.ui.ledger.page = 0;
  refreshLedger();
}

/** 按班级筛选学员。 */
export function filterLedger(cls) {
  store.ui.ledger.filterClass = cls;
  store.ui.ledger.page = 0;
  refreshLedger();
}

/** 翻页。 */
export function turnLedgerPage(delta) {
  store.ui.ledger.page = Math.max(0, store.ui.ledger.page + delta);
  refreshLedger();
}

/** 导出学分总表为 Excel。 */
export function exportLedger() {
  const cohort = store.db;
  const header = ['姓名', '学号', '学院', '班级', '年级', '性别', '联系方式', '邮箱',
    ...cohort.events.flatMap((event) => [`${event.title} 状态`, `${event.title} 得分`]), '必修', '选修', '总学分'];

  const rows = cohort.students.map((student) => [
    student.name,
    student.id,
    student.dept,
    student.cls,
    student.grade ?? '',
    student.gender ?? '',
    student.phone ?? '',
    student.email ?? '',
    ...cohort.events.flatMap((event) => [markText(event, student.id), event.marks?.[student.id]?.points ?? '']),
    ...creditTotals(student.id),
  ]);

  import('../../lib/xlsx-write.js').then((module) => module.download('本期学分总表', [header, ...rows]));
}
