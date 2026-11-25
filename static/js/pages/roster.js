// 学员名单：名单浏览、学员详情与资料编辑、Excel/CSV 名单导入向导。

import { esc, html, raw } from '../lib/dom.js';
import { openModal, toast } from '../lib/ui.js';
import { creditTotals, store } from '../lib/store.js';
import { perform } from '../lib/actions.js';
import { parseCsv, parseWorkbook } from '../lib/xlsx-read.js';
import { columnName, download } from '../lib/xlsx-write.js';
import { crumb } from './home.js';

/** 名单字段、中文表头与是否必填。 */
const FIELDS = [
  ['id', '学号', true],
  ['name', '姓名', true],
  ['dept', '学院', true],
  ['cls', '班级', true],
  ['grade', '年级', false],
  ['gender', '性别', false],
  ['phone', '联系方式', false],
  ['email', '邮箱', false],
];

/** 必填字段数量，其余字段可在导入时选择「不导入」。 */
const REQUIRED_FIELDS = 4;

/** 每页显示的学员数量，名单与学分总表保持一致。 */
const PAGE_SIZE = 15;

/** 导入向导状态。 */
const state = {
  sheets: null,
  activeSheet: 0,
  headerRow: 0,
  mapping: Array(8).fill(-1),
  snapshot: '',
  query: '',
  filterClass: '',
  page: 0,
};

/** 规范化文本，便于表头匹配。 */
function normalize(text) {
  return String(text ?? '').replace(/\s/g, '').trim();
}

/** 猜测表头中各字段所在的列。 */
function guessColumns(cells) {
  const rules = [
    /^学号$|学生学号/, /姓名/, /院系|学院|系所/, /班级|分班/,
    /年级/, /性别/, /联系方式|手机|电话/, /邮箱|邮件/,
  ];
  return rules.map((rule) => cells.findIndex((value) => rule.test(normalize(value))));
}

/** 四个必填字段是否都已映射，且没有重复使用同一列。 */
function mappingReady() {
  const required = FIELDS.slice(0, REQUIRED_FIELDS).every((_, index) => state.mapping[index] >= 0);
  const used = state.mapping.filter((value) => value >= 0);
  return required && new Set(used).size === used.length;
}

/** 表头行是否包含全部必填字段。 */
function headerReady(cells) {
  return guessColumns(cells).slice(0, REQUIRED_FIELDS).every((index) => index >= 0);
}

/** 渲染学员名单页面。 */
export function renderRoster() {
  const classOptions = [...new Set((store.db?.students ?? []).map((student) => student.cls))]
    .sort((a, b) => String(a).localeCompare(b, 'zh-CN'));

  return html`
    ${raw(crumb('学员名单'))}
    <div class="pagehead pagehead-row">
      <div>
        <h2>学员名单</h2>
        <p class="muted">${store.db?.name ?? ''}</p>
      </div>
      <button class="btn primary" data-action="import-roster">导入名单</button>
    </div>
    <div class="filterbar">
      <div class="search">
        <input type="search" aria-label="搜索姓名、学号、学院或班级" placeholder="搜索姓名、学号、学院或班级" value="${state.query}" data-action="roster-search">
        <span class="search-icon" aria-hidden="true"></span>
      </div>
      <select aria-label="按班级筛选" data-action="roster-filter">
        <option value="">全部班级</option>
        ${raw(classOptions.map((item) => `<option ${item === state.filterClass ? 'selected' : ''}>${esc(item)}</option>`).join(''))}
      </select>
    </div>
    <div id="ro-results">${raw(rosterTable())}</div>
  `;
}

/** 名单表格。 */
function rosterTable() {
  const students = (store.db?.students ?? []).filter((student) =>
    (!state.filterClass || state.filterClass === student.cls)
    && [student.name, student.id, student.dept, student.cls, student.grade, student.phone, student.email]
      .some((value) => String(value ?? '').toLowerCase().includes(state.query.trim().toLowerCase())));

  const last = Math.max(0, Math.ceil(students.length / PAGE_SIZE) - 1);
  state.page = Math.min(state.page, last);
  const rows = students.slice(state.page * PAGE_SIZE, state.page * PAGE_SIZE + PAGE_SIZE);

  const body = rows.map((student) => '<tr>'
    + `<td>${esc(String(student.id ?? ''))}</td>`
    + `<td><button class="ro-name" data-view-student="${esc(String(student.id))}">${esc(String(student.name ?? ''))}</button></td>`
    + `<td>${esc(String(student.dept ?? ''))}</td>`
    + `<td>${esc(String(student.cls ?? ''))}</td>`
    + `<td><button class="ro-btn" data-edit="${esc(String(student.id))}">编辑资料</button></td></tr>`).join('');

  return '<div class="ro-wrap"><table><thead><tr><th>学号</th><th>姓名</th><th>学院</th><th>培训班班级</th><th>操作</th></tr></thead>'
    + `<tbody>${body}${rows.length ? '' : '<tr><td colspan="5">未找到匹配的学员</td></tr>'}</tbody></table></div>`
    + `<div class="pager"><span>共 ${students.length} 名学员</span><div class="pager-controls">`
    + `<button class="btn" ${state.page === 0 ? 'disabled' : ''} data-turn="-1">上一页</button> `
    + `<span>${state.page + 1} / ${last + 1}</span> `
    + `<button class="btn" ${state.page === last ? 'disabled' : ''} data-turn="1">下一页</button>`
    + '</div></div>';
}

/** 刷新名单表格内容。 */
export function refreshRosterResults() {
  const container = document.getElementById('ro-results');
  if (container) container.innerHTML = rosterTable();
}

/** 按关键字搜索学员。 */
export function searchRoster(keyword) {
  state.query = keyword;
  state.page = 0;
  refreshRosterResults();
}

/** 按班级筛选学员。 */
export function filterRoster(cls) {
  state.filterClass = cls;
  state.page = 0;
  refreshRosterResults();
}

/** 翻页。 */
export function turnPage(delta) {
  state.page = Math.max(0, state.page + delta);
  refreshRosterResults();
}

/** 查看学员详情。 */
export function showStudent(studentId) {
  const student = (store.db?.students ?? []).find((item) => String(item.id) === studentId);
  if (!student) return;

  const [required, elective, total] = creditTotals(student.id);
  const value = (text) => (text
    ? raw(esc(String(text)))
    : raw('<span class="muted">未填写</span>'));

  openModal('学员详情', html`
    <div class="stu-profile">
      <div class="stu-profile-head">
        <span class="stu-avatar" aria-hidden="true">${esc(String(student.name || '?').slice(0, 1))}</span>
        <div>
          <h3>${student.name}</h3>
          <p class="muted">${student.id} · ${student.cls}</p>
        </div>
      </div>
      <dl class="stu-facts">
        <div><dt>学院</dt><dd>${value(student.dept)}</dd></div>
        <div><dt>年级</dt><dd>${value(student.grade)}</dd></div>
        <div><dt>性别</dt><dd>${value(student.gender)}</dd></div>
        <div><dt>联系方式</dt><dd>${value(student.phone)}</dd></div>
        <div><dt>邮箱</dt><dd>${value(student.email)}</dd></div>
        <div><dt>培训班班级</dt><dd>${value(student.cls)}</dd></div>
      </dl>
      <div class="stu-credit">
        <span>总学分 <strong>${total}</strong></span>
        <small>必修 ${required} 分　／　选修 ${elective} 分</small>
      </div>
      <div class="actions">
        <button class="btn" data-action="close-modal">关闭</button>
        <button class="btn primary" data-edit="${esc(String(student.id))}">编辑资料</button>
      </div>
    </div>
  `);
}

/** 编辑学员资料（姓名、学院、班级及联系方式等）。 */
export function editStudentInfo(studentId) {
  const student = (store.db?.students ?? []).find((item) => String(item.id) === studentId);
  if (!student) return;

  const genders = ['', '男', '女', '其他'];
  openModal('编辑学员资料', html`
    <form id="ro-edit" class="ro-form">
      <div class="ro-form-grid">
        <label class="ro-input-label">学号<input class="ro-sel" value="${student.id}" disabled></label>
        <label class="ro-input-label">姓名<input class="ro-sel" name="name" value="${student.name}" maxlength="80" required></label>
        <label class="ro-input-label">学院<input class="ro-sel" name="dept" value="${student.dept}" maxlength="160" required></label>
        <label class="ro-input-label">培训班班级<input class="ro-sel" name="cls" value="${student.cls}" maxlength="80" required></label>
        <label class="ro-input-label">年级<input class="ro-sel" name="grade" value="${student.grade ?? ''}" maxlength="40" placeholder="例：2024 级"></label>
        <label class="ro-input-label">性别
          <select class="ro-sel" name="gender">
            ${raw(genders.map((item) => `<option value="${esc(item)}" ${String(student.gender ?? '') === item ? 'selected' : ''}>${esc(item || '未填写')}</option>`).join(''))}
          </select>
        </label>
        <label class="ro-input-label">联系方式<input class="ro-sel" name="phone" value="${student.phone ?? ''}" maxlength="40" placeholder="手机或其他联系方式"></label>
        <label class="ro-input-label">邮箱<input class="ro-sel" name="email" type="email" value="${student.email ?? ''}" maxlength="160" placeholder="name@example.com"></label>
      </div>
      <div class="ro-actions">
        <button class="btn" type="button" data-action="close-modal">取消</button>
        <button class="primary">保存资料</button>
      </div>
    </form>
  `);

  const form = document.getElementById('ro-edit');
  form.onsubmit = (event) => {
    event.preventDefault();
    const field = (name) => String(form.elements[name].value ?? '').trim();
    const row = {
      id: studentId,
      name: field('name'),
      dept: field('dept'),
      cls: field('cls'),
      grade: field('grade'),
      gender: field('gender'),
      phone: field('phone'),
      email: field('email'),
    };
    if (!row.name || !row.dept || !row.cls) {
      toast('请填写姓名、学院和培训班班级');
      return;
    }
    perform('student', { student: row });
  };
}

/** 打开导入名单弹窗。 */
export function openImport() {
  state.sheets = null;
  state.snapshot = '';

  openModal('导入学员名单', html`
    <div class="ro-upload">
      <label class="ro-input-label">选择 Excel 或 UTF-8 CSV 文件<input type="file" accept=".xlsx,.csv,.tsv" data-action="roster-file"></label>
    </div>
    <p class="ro-note">系统会先预览学号、姓名、学院和班级四个必填字段；年级、性别、联系方式与邮箱可选填，未提供的列可设置为「不导入」。</p>
    <button class="ro-btn" data-action="roster-sample">下载示例名单</button>
  `);
}

/** 读取名单文件并进入核对步骤。 */
export async function loadFile(file) {
  if (!file) return;
  if (file.size > 16 * 1024 * 1024) {
    toast('请选择小于 16 MB 的文件');
    return;
  }

  try {
    const data = new Uint8Array(await file.arrayBuffer());
    state.sheets = /\.xlsx$/i.test(file.name)
      ? await parseWorkbook(data)
      : parseCsv(new TextDecoder().decode(data).replace(/^\uFEFF/, ''));

    const best = state.sheets.findIndex((sheet) =>
      sheet.rows.slice(0, 10).some((row) => headerReady(row.cells)));
    selectSheet(Math.max(0, best));
  } catch (error) {
    toast(error.message || '无法读取文件，请检查格式');
  }
}

/** 选择工作表，并自动定位表头行。 */
export function selectSheet(index) {
  state.activeSheet = Number(index);
  state.headerRow = 0;
  let best = 0;
  state.sheets[state.activeSheet].rows.slice(0, 20).forEach((row, position) => {
    const score = guessColumns(row.cells).filter((value) => value >= 0).length;
    if (score > best) {
      best = score;
      state.headerRow = position;
    }
  });
  setHeader(state.headerRow);
}

/** 指定表头行。 */
export function setHeader(index) {
  state.headerRow = Number(index);
  state.mapping = guessColumns(state.sheets[state.activeSheet].rows[state.headerRow]?.cells ?? []);
  showPreview();
}

/** 手工指定某字段对应的列。 */
export function mapColumn(index, value) {
  state.mapping[index] = Number(value);
  showPreview();
}

/** 逐行映射结果，并标注新增、更新与异常。 */
function mappedRows() {
  const all = [];
  const byId = new Map((store.db?.students ?? []).map((student) => [String(student.id), student]));
  const rows = state.sheets[state.activeSheet].rows;

  for (const row of rows.slice(state.headerRow + 1)) {
    const item = Object.fromEntries(FIELDS.map(([key], index) => {
      const column = state.mapping[index];
      return [key, column >= 0 ? String(row.cells[column] ?? '').trim() : ''];
    }));
    const existing = byId.get(item.id);

    let type = '新增';
    if (!item.id || !item.name) type = '缺少学号或姓名';
    else if (Object.prototype.hasOwnProperty.call(Object.prototype, item.id)) type = '学号格式异常';
    else if (existing && existing.name !== item.name) type = '姓名与已有学号冲突';
    else if (!item.dept || !item.cls) type = '缺少学院或班级';
    else if (item.gender && !['男', '女', '其他'].includes(item.gender)) type = '性别填写有误';
    else if (existing) {
      const compared = FIELDS
        .filter((_, index) => index < REQUIRED_FIELDS || state.mapping[index] >= 0)
        .map(([key]) => key);
      const same = compared.every((key) => String(existing[key] ?? '') === item[key]);
      type = same ? '资料一致' : '更新资料';
    }

    all.push({ item, num: row.num, type });
  }

  const counts = new Map();
  for (const row of all) {
    if (row.item.id) counts.set(row.item.id, (counts.get(row.item.id) ?? 0) + 1);
  }
  for (const row of all) {
    if (counts.get(row.item.id) > 1) row.type = '表内学号重复';
  }
  return all;
}

/** 可以导入的行。 */
function isEligible(row) {
  return row.type === '新增' || row.type === '更新资料';
}

/** 展示导入核对界面。 */
function showPreview() {
  const sheet = state.sheets[state.activeSheet];
  const cells = sheet.rows[state.headerRow]?.cells ?? [];
  const valid = mappingReady();

  const data = valid ? mappedRows() : [];
  const good = data.filter(isEligible);
  const issues = data.filter((row) => !isEligible(row) && row.type !== '资料一致');

  const sheetOptions = state.sheets
    .map((item, index) => `<option value="${index}" ${index === state.activeSheet ? 'selected' : ''}>${esc(item.name)}</option>`).join('');
  const headerOptions = sheet.rows.slice(0, 20)
    .map((row, index) => `<option value="${index}" ${index === state.headerRow ? 'selected' : ''}>第 ${row.num} 行</option>`).join('');

  const columnOptions = (index) => `<option value="-1" ${state.mapping[index] === -1 ? 'selected' : ''}>${index < REQUIRED_FIELDS ? '选择列' : '不导入'}</option>`
    + Array.from(cells, (value, position) =>
      `<option value="${position}" ${state.mapping[index] === position ? 'selected' : ''}>${esc(columnName(position))} · ${esc(value ?? '')}</option>`).join('');

  const mapControls = FIELDS.map(([, label, required], index) =>
    `<label class="ro-input-label">${esc(label)}${required ? '' : '（可选）'}<select class="ro-sel" data-map="${index}">${columnOptions(index)}</select></label>`).join('');

  const issueRows = new Set(issues);
  const ordered = [...issues, ...data.filter((row) => !issueRows.has(row))];
  const previewFields = FIELDS.filter((_, index) => index < REQUIRED_FIELDS || state.mapping[index] >= 0);

  const preview = valid
    ? `<p class="ro-summary">新增 <strong>${data.filter((row) => row.type === '新增').length}</strong> 人 · `
      + `更新 <strong>${data.filter((row) => row.type === '更新资料').length}</strong> 人 · `
      + `资料一致 ${data.filter((row) => row.type === '资料一致').length} 人 · 异常 ${issues.length} 行</p>`
      + '<div class="ro-wrap ro-import-preview"><table><thead><tr><th>原行</th>'
      + previewFields.map(([, label]) => `<th>${esc(label)}</th>`).join('')
      + '<th>结果</th></tr></thead><tbody>'
      + ordered.map((row) => `<tr><td>${row.num}</td>`
        + previewFields.map(([key]) => `<td>${esc(row.item[key])}</td>`).join('')
        + `<td class="${issueRows.has(row) ? 'ro-issue' : ''}">${esc(row.type)}</td></tr>`).join('')
      + '</tbody></table></div>'
    : '<p class="ro-summary">请至少为学号、姓名、学院和班级选择对应列。</p>';

  openModal('核对名单', html`
    <div class="ro-maps">
      <label class="ro-input-label">工作表<select class="ro-sel" data-action="select-sheet">${raw(sheetOptions)}</select></label>
      <label class="ro-input-label">表头位置<select class="ro-sel" data-action="set-header">${raw(headerOptions)}</select></label>
    </div>
    <div class="ro-maps">${raw(mapControls)}</div>
    ${raw(preview)}
    <div class="ro-actions">
      <button class="ro-main" ${good.length ? '' : 'disabled'} data-action="commit-roster">确认导入 ${good.length} 人</button>
      <button class="ro-btn" data-action="import-roster">重选文件</button>
    </div>
    ${raw(issues.length ? '<p class="ro-note">异常行将跳过。请在原表核对后重新导入。</p>' : '')}
  `);

  state.snapshot = JSON.stringify(store.db?.students ?? []);
}

/** 提交导入。 */
export function commitImport() {
  if (state.snapshot !== JSON.stringify(store.db?.students ?? [])) {
    showPreview();
    toast('名单已变动，请重新核对');
    return;
  }
  if (!state.sheets || !mappingReady()) {
    return;
  }

  const records = mappedRows().filter(isEligible).map((row) => row.item);
  perform('roster', { rows: records }, () => {
    state.sheets = null;
    toast('名单已更新');
  });
}

/** 下载示例名单。 */
export function downloadSample() {
  download('虚构学员示例名单', [
    ['学生骨干培训管理系统报名信息表'],
    ['学号', '姓名', '学院', '班级', '年级', '性别', '联系方式', '邮箱'],
    ['009001', '示例甲', '文学院', '一班', '2024 级', '女', '13800000000', 'example1@example.com'],
    ['009002', '示例乙', '历史学院', '二班', '2024 级', '男', '13800000001', 'example2@example.com'],
  ]);
}
