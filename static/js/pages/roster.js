// 学员名单：名单浏览、分班调整、Excel/CSV 名单导入向导。

import { esc, html, raw } from '../lib/dom.js';
import { openModal, toast } from '../lib/ui.js';
import { store } from '../lib/store.js';
import { perform } from '../lib/actions.js';
import { parseCsv, parseWorkbook } from '../lib/xlsx-read.js';
import { columnName, download } from '../lib/xlsx-write.js';

/** 名单字段与中文表头。 */
const FIELDS = [['id', '学号'], ['name', '姓名'], ['dept', '院系'], ['cls', '班级']];

/** 导入向导状态。 */
const state = {
  sheets: null,
  activeSheet: 0,
  headerRow: 0,
  mapping: [-1, -1, -1, -1],
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
  const rules = [/^学号$|学生学号/, /姓名/, /院系|学院|系所/, /班级|分班/];
  return rules.map((rule) => cells.findIndex((value) => rule.test(normalize(value))));
}

/** 渲染学员名单页面。 */
export function renderRoster() {
  const classOptions = [...new Set((store.db?.students ?? []).map((student) => student.cls))]
    .sort((a, b) => String(a).localeCompare(b, 'zh-CN'));

  return html`
    <div class="ro-bar">
      <h2>学员名单</h2>
      <button class="ro-main" data-action="import-roster">导入名单</button>
    </div>
    <div class="ro-filter">
      <input aria-label="搜索姓名、学号或院系" placeholder="搜索姓名、学号或院系" value="${state.query}" data-action="roster-search">
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
    && [student.name, student.id, student.dept].some((value) =>
      String(value).toLowerCase().includes(state.query.trim().toLowerCase())));

  const last = Math.max(0, Math.ceil(students.length / 15) - 1);
  state.page = Math.min(state.page, last);
  const rows = students.slice(state.page * 15, state.page * 15 + 15);

  const body = rows.map((student) => `<tr>`
    + FIELDS.map(([key]) => `<td>${esc(String(student[key] ?? ''))}</td>`).join('')
    + `<td><button class="ro-btn" data-edit="${esc(String(student.id))}">调整分班</button></td></tr>`).join('');

  return '<div class="ro-wrap"><table><thead><tr><th>学号</th><th>姓名</th><th>院系</th><th>培训班班级</th><th>操作</th></tr></thead>'
    + `<tbody>${body}${rows.length ? '' : '<tr><td colspan="5">未找到匹配的学员</td></tr>'}</tbody></table></div>`
    + `<div class="ro-pages"><span>共 ${students.length} 名学员</span><div>`
    + `<button class="ro-btn" ${state.page === 0 ? 'disabled' : ''} data-turn="-1">上一页</button> `
    + `${state.page + 1} / ${last + 1} `
    + `<button class="ro-btn" ${state.page === last ? 'disabled' : ''} data-turn="1">下一页</button>`
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

/** 调整培训班分班。 */
export function editStudentClass(studentId) {
  const student = (store.db?.students ?? []).find((item) => String(item.id) === studentId);
  if (!student) return;

  openModal('调整培训班分班', html`
    <p>${student.name} · ${student.id}</p>
    <form id="ro-edit">
      <label class="ro-input-label">培训班班级<input class="ro-sel" name="cls" value="${student.cls}" maxlength="50" required></label>
      <div class="ro-actions"><button class="ro-main">保存</button></div>
    </form>
  `);

  const form = document.getElementById('ro-edit');
  form.onsubmit = (event) => {
    event.preventDefault();
    const cls = form.elements.cls.value.trim();
    if (!cls) {
      toast('请输入班级');
      return;
    }
    perform('roster', { rows: [{ ...student, cls }] });
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
    <p class="ro-note">系统会先预览学号、姓名、院系和班级。确认后为本期学员开通查询和报名权限。</p>
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
      sheet.rows.slice(0, 10).some((row) => guessColumns(row.cells).every((index) => index >= 0)));
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
    const item = Object.fromEntries(FIELDS.map(([key], index) => [key, String(row.cells[state.mapping[index]] ?? '').trim()]));
    const existing = byId.get(item.id);

    let type = '新增';
    if (!item.id || !item.name) type = '缺少学号或姓名';
    else if (Object.prototype.hasOwnProperty.call(Object.prototype, item.id)) type = '学号格式异常';
    else if (existing && existing.name !== item.name) type = '姓名与已有学号冲突';
    else if (!item.dept || !item.cls) type = '缺少院系或班级';
    else if (existing) type = (existing.dept === item.dept && existing.cls === item.cls) ? '资料一致' : '更新资料';

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
  const valid = state.mapping.every((value) => value >= 0) && new Set(state.mapping).size === FIELDS.length;

  const data = valid ? mappedRows() : [];
  const good = data.filter(isEligible);
  const issues = data.filter((row) => !isEligible(row) && row.type !== '资料一致');

  const sheetOptions = state.sheets
    .map((item, index) => `<option value="${index}" ${index === state.activeSheet ? 'selected' : ''}>${esc(item.name)}</option>`).join('');
  const headerOptions = sheet.rows.slice(0, 20)
    .map((row, index) => `<option value="${index}" ${index === state.headerRow ? 'selected' : ''}>第 ${row.num} 行</option>`).join('');

  const columnOptions = (index) => `<option value="-1" ${state.mapping[index] === -1 ? 'selected' : ''}>选择列</option>`
    + Array.from(cells, (value, position) =>
      `<option value="${position}" ${state.mapping[index] === position ? 'selected' : ''}>${esc(columnName(position))} · ${esc(value ?? '')}</option>`).join('');

  const mapControls = FIELDS.map(([, label], index) =>
    `<label class="ro-input-label">${esc(label)}<select class="ro-sel" data-map="${index}">${columnOptions(index)}</select></label>`).join('');

  const issueRows = new Set(issues);
  const ordered = [...issues, ...data.filter((row) => !issueRows.has(row))];

  const preview = valid
    ? `<p class="ro-summary">新增 <strong>${data.filter((row) => row.type === '新增').length}</strong> 人 · `
      + `更新 <strong>${data.filter((row) => row.type === '更新资料').length}</strong> 人 · `
      + `资料一致 ${data.filter((row) => row.type === '资料一致').length} 人 · 异常 ${issues.length} 行</p>`
      + '<div class="ro-wrap ro-import-preview"><table><thead><tr><th>原行</th><th>姓名</th><th>学号</th><th>院系</th><th>班级</th><th>结果</th></tr></thead><tbody>'
      + ordered.map((row) => `<tr><td>${row.num}</td>`
        + ['name', 'id', 'dept', 'cls'].map((key) => `<td>${esc(row.item[key])}</td>`).join('')
        + `<td class="${issueRows.has(row) ? 'ro-issue' : ''}">${esc(row.type)}</td></tr>`).join('')
      + '</tbody></table></div>'
    : '<p class="ro-summary">请为四个字段分别选择对应列。</p>';

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
  if (!state.sheets || !state.mapping.every((value) => value >= 0) || new Set(state.mapping).size !== FIELDS.length) {
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
    ['学生骨干培训班报名信息表'],
    ['序号', '班级', '院系（请填写全称）', '学生党支部\n书记姓名', '学号'],
    [1, '一班', '中文系', '示例甲', '009001'],
    [2, '二班', '哲学系', '示例乙', '009002'],
  ]);
}
