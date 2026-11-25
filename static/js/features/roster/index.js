// 学员名单：名单浏览、搜索、筛选与翻页。

import { esc, html, raw, updateRegion } from '../../lib/dom.js';
import { filterStudents, store, studentClasses } from '../../lib/store.js';
import { filterbar } from '../../components/filterbar.js';
import { pager } from '../../components/pager.js';
import { table } from '../../components/table.js';
import { crumb } from '../home/index.js';

/** 每页显示的学员数量，与学分总表保持一致。 */
const PAGE_SIZE = 15;

/** 计算当前筛选条件下的学员与分页。 */
function rosterView() {
  const state = store.ui.roster;
  const matched = filterStudents(state);
  const last = Math.max(0, Math.ceil(matched.length / PAGE_SIZE) - 1);
  state.page = Math.min(state.page, last);
  return {
    matched,
    rows: matched.slice(state.page * PAGE_SIZE, state.page * PAGE_SIZE + PAGE_SIZE),
  };
}

/** 渲染学员名单页面。 */
export function renderRoster() {
  return html`
    ${raw(crumb('学员名单'))}
    <div class="pagehead pagehead-row">
      <div>
        <h2>学员名单</h2>
        <p class="muted">${store.db?.name ?? ''}</p>
      </div>
      <button class="btn primary" data-action="import-roster">导入名单</button>
    </div>
    ${raw(filterbar({
      search: {
        value: store.ui.roster.query,
        action: 'roster-search',
        label: '搜索姓名、学号、学院或班级',
      },
      select: {
        value: store.ui.roster.filterClass,
        action: 'roster-filter',
        label: '按班级筛选',
        options: [{ value: '', label: '全部班级' }, ...studentClasses().map((item) => ({ value: item, label: item }))],
      },
    }))}
    <div id="roster-results">${raw(rosterResults())}</div>
  `;
}

/** 表格与分页条。 */
function rosterResults() {
  const view = rosterView();

  const rows = view.rows.map((student) => `<tr>`
    + `<td>${esc(String(student.id ?? ''))}</td>`
    + `<td><button class="ro-name" data-action="view-student" data-id="${esc(String(student.id))}">${esc(String(student.name ?? ''))}</button></td>`
    + `<td>${esc(String(student.dept ?? ''))}</td>`
    + `<td>${esc(String(student.cls ?? ''))}</td>`
    + `<td><button class="ro-btn" data-action="edit-student" data-id="${esc(String(student.id))}">编辑资料</button></td></tr>`);

  return html`
    ${raw(table({
      wrapClass: 'ro-wrap',
      headers: ['学号', '姓名', '学院', '培训班班级', '操作'],
      rows,
      empty: '未找到匹配的学员',
    }))}
    ${raw(pager({
      total: view.matched.length,
      page: store.ui.roster.page,
      pageSize: PAGE_SIZE,
      action: 'roster-turn',
    }))}
  `;
}

/** 刷新名单表格与分页条。 */
export function refreshRosterResults() {
  updateRegion('roster-results', rosterResults());
}

/** 按关键字搜索学员。 */
export function searchRoster(keyword) {
  store.ui.roster.query = keyword;
  store.ui.roster.page = 0;
  refreshRosterResults();
}

/** 按班级筛选学员。 */
export function filterRoster(cls) {
  store.ui.roster.filterClass = cls;
  store.ui.roster.page = 0;
  refreshRosterResults();
}

/** 翻页。 */
export function turnRosterPage(delta) {
  store.ui.roster.page = Math.max(0, store.ui.roster.page + delta);
  refreshRosterResults();
}
