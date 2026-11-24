// 活动管理：活动列表、活动详情、问卷编辑、报名名单、出勤登记、
// 报名入口分享、签到表导出与打印。

import { esc, html, raw, shiftedDate } from '../lib/dom.js';
import { openModal, toast } from '../lib/ui.js';
import { eventState, store } from '../lib/store.js';
import { qrSvg } from '../lib/qr.js';
import { perform } from '../lib/actions.js';
import { render } from '../lib/renderer.js';
import { crumb } from './home.js';

/** 当前活动详情页状态。 */
const state = {
  detailId: '',
  tab: '报名名单',
  filter: '全部',
  photoUrls: [],
};

/** 参与活动的学员，按班级与学号排序。 */
function enrolledStudents(event) {
  return (store.db?.students ?? [])
    .filter((student) => Object.prototype.hasOwnProperty.call(event.regs ?? {}, student.id))
    .sort((a, b) => a.cls.localeCompare(b.cls, 'zh-CN') || a.id.localeCompare(b.id));
}

/** 当前打开的活动。 */
export function currentEvent() {
  return (store.db?.events ?? []).find((event) => event.id === state.detailId) ?? null;
}

/** 返回活动列表。 */
export function openEventList() {
  state.detailId = '';
  state.tab = '报名名单';
  import('../lib/navigation.js').then((module) => module.go('events'));
}

/** 打开某个活动。 */
export function openEvent(id) {
  state.detailId = String(id);
  state.tab = '报名名单';
  import('../lib/navigation.js').then((module) => module.go('events'));
}

/** 切换活动筛选。 */
export function setFilter(filter) {
  state.filter = filter;
  render();
}

/** 切换详情页的标签页。 */
export function selectTab(tab) {
  state.tab = tab;
  render();
}

/** 渲染活动页面。 */
export function renderEvents() {
  const event = currentEvent();
  if (event) return eventDetail(event);

  const rows = (store.db?.events ?? [])
    .filter((item) => state.filter === '全部' || item.type === state.filter)
    .sort((a, b) => b.date.localeCompare(a.date));

  const table = rows.map((item) => `<tr>`
    + `<td><button class="evLink" data-event="${esc(item.id)}">${esc(item.title)}</button></td>`
    + `<td>${esc(item.type)}</td>`
    + `<td>${esc(item.date)} ${esc(item.time || '')}</td>`
    + `<td>${esc(String(Number(item.points)))}</td>`
    + `<td>${enrolledStudents(item).length}</td>`
    + `<td>${esc(eventState(item))}</td>`
    + '</tr>').join('');

  return html`
    ${raw(crumb('活动管理'))}
    <div class="evHead"><h2>活动管理</h2><button class="btn primary" data-action="new-event">创建活动</button></div>
    <div class="evTabs">
      ${raw(['全部', '必修', '选修'].map((type) =>
        `<button aria-selected="${type === state.filter}" data-filter="${esc(type)}">${esc(type)}</button>`).join(''))}
    </div>
    <div class="tablewrap">
      <table>
        <thead><tr><th>活动名称</th><th>课程类型</th><th>举办时间</th><th>学分</th><th>报名人数</th><th>状态</th></tr></thead>
        <tbody>${raw(table)}</tbody>
      </table>
    </div>
    ${raw(rows.length ? '' : '<p class="evEmpty">当前没有活动。</p>')}
  `;
}

/** 渲染活动详情。 */
function eventDetail(event) {
  const people = enrolledStudents(event);

  const tabs = ['活动与问卷', '报名名单', '出勤与学分']
    .map((tab) => `<button aria-selected="${tab === state.tab}" data-tab="${esc(tab)}">${esc(tab)}</button>`)
    .join('');

  const header = html`
    <button class="evBack" data-action="event-list">返回活动列表</button>
    <div class="evHead">
      <div>
        <h2>${event.title}</h2>
        <p class="evMeta">${event.type}课　·　${Number(event.points)} 学分　·　${eventState(event)}</p>
      </div>
      <button class="btn" data-action="share">分享报名入口</button>
    </div>
    <div class="evTabs">${raw(tabs)}</div>
  `;

  if (state.tab === '活动与问卷') {
    const questions = (event.questions ?? []).map((question, index) => html`
      <div class="evQuestion">
        <b>${index + 1}. ${question.label}</b>
        <div class="evMeta">${question.type}${question.required ? ' · 必填' : ' · 选填'}</div>
        ${raw((question.options ?? []).map(esc).join(' / '))}
      </div>
    `).join('');

    return html`
      ${raw(header)}
      <dl>
        <dt>举办时间</dt><dd>${event.date} ${event.time || ''}</dd>
        <dt>活动地点</dt><dd>${event.place}</dd>
        <dt>报名截止</dt><dd>${String(event.deadline).replace('T', ' ')}</dd>
      </dl>
      <h3>报名问卷</h3>
      <p class="evNote">姓名、学号、院系和班级由学员账号带入。</p>
      ${raw(questions)}
    `;
  }

  if (state.tab === '报名名单') {
    return html`
      ${raw(header)}
      <div class="evHead">
        <h3>已报名 ${people.length} 人</h3>
        <div class="evHeadBtns">
          <button class="btn" data-action="export-signup">导出报名名单</button>
          <button class="btn" data-action="sheet">下载签到表</button>
          <button class="btn primary" data-action="print">打印签到表</button>
        </div>
      </div>
      ${raw(peopleTable(people))}
    `;
  }

  return html`
    ${raw(header)}
    <div class="evHead">
      <h3>出勤登记</h3>
      <div class="evHeadBtns">
        <button class="btn" data-action="photo-review">照片复核</button>
        <button class="btn primary" data-action="manual-review">手动登记</button>
      </div>
    </div>
    ${raw(marksTable(event))}
  `;
}

/** 报名名单表格。 */
function peopleTable(people) {
  if (!people.length) {
    return '<p class="evEmpty">还没有学员报名。可通过报名入口邀请本期学员。</p>';
  }
  const rows = people.map((student) => `<tr>`
    + `<td>${esc(student.name)}</td><td>${esc(student.id)}</td>`
    + `<td>${esc(student.dept)}</td><td>${esc(student.cls)}</td>`
    + `<td><button class="evLink" data-answers="${esc(student.id)}">查看</button></td></tr>`).join('');

  return `<div class="tablewrap"><table><thead><tr><th>姓名</th><th>学号</th><th>院系</th><th>班级</th><th>问卷</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

/** 出勤登记表格。 */
function marksTable(event) {
  const people = (store.db?.students ?? []).filter((student) =>
    Object.prototype.hasOwnProperty.call(event.marks ?? {}, student.id)
    || Object.prototype.hasOwnProperty.call(event.regs ?? {}, student.id));

  if (!people.length) {
    return '<p class="evEmpty">暂无报名或出勤记录。现场参加的学员也可手动登记。</p>';
  }

  const rows = people.map((student) => {
    const mark = event.marks?.[student.id];
    return `<tr><td>${esc(student.name)}</td><td>${esc(student.cls)}</td>`
      + `<td>${esc(mark?.status ?? '待登记')}</td>`
      + `<td>${mark ? esc(String(Number(mark.points))) : '—'}</td></tr>`;
  }).join('');

  return `<div class="tablewrap"><table><thead><tr><th>姓名</th><th>班级</th><th>出勤</th><th>已获学分</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

/** 查看某位学员的问卷答案。 */
export function showAnswers(studentId) {
  const event = currentEvent();
  const student = (store.db?.students ?? []).find((item) => item.id === studentId);
  if (!event || !student) return;

  const answers = event.regs?.[studentId] ?? [];
  const questions = (event.questions ?? []).map((question, index) => html`
    <div class="evQuestion">
      <b>${question.label}</b>
      <p>${[answers[index]].flat().filter(Boolean).join('、') || '未填写'}</p>
    </div>
  `).join('');

  openModal(`${student.name}的报名信息`, html`
    <p>${student.dept} · ${student.cls}</p>
    ${raw(questions || '<p class="evNote">本次活动仅登记基本信息。</p>')}
  `);
}

/** 打开创建活动弹窗。 */
export function createEvent() {
  openModal('创建活动', html`
    <form id="eventForm">
      <label class="evField">活动名称<input required maxlength="80" name="title" placeholder="例如：学生党支部工作实务"></label>
      <div class="evGrid">
        <label class="evField">课程类型<select name="type"><option>必修</option><option>选修</option></select></label>
        <label class="evField">活动学分<input name="points" type="number" min="0.1" max="100" step="0.1" required value="2"></label>
        <label class="evField">活动日期<input name="date" type="date" required value="${shiftedDate(7)}"></label>
        <label class="evField">开始时间<input name="time" type="time" required value="14:00"></label>
      </div>
      <label class="evField">活动地点<input name="place" required maxlength="100" placeholder="填写教室或集合地点"></label>
      <label class="evField">报名截止时间<input name="deadline" type="datetime-local" required value="${shiftedDate(6)}T18:00"></label>
      <div class="evHead"><h3>报名问卷</h3><button type="button" class="btn" data-action="add-question">添加问题</button></div>
      <p class="evNote">学员基本信息将自动填入。</p>
      <div id="evQs"></div>
      <div class="evActions">
        <button type="button" class="btn" data-action="close-modal">取消</button>
        <button class="btn primary">发布活动</button>
      </div>
    </form>
  `);

  const form = document.getElementById('eventForm');
  form.onsubmit = (event) => {
    event.preventDefault();
    submitEvent(form);
  };
}

/** 在表单中追加一道问卷题。 */
export function addQuestion(container) {
  const row = document.createElement('div');
  row.className = 'evQuestion';
  row.innerHTML = '<label class="evField">问题名称<input class="evQLabel" required maxlength="150" placeholder="请输入问题"></label>'
    + '<div class="evLine"><select class="evSel evQType"><option>简答</option><option>单选</option><option>多选</option></select>'
    + '<label><input type="checkbox" class="evQReq" checked> 必填</label>'
    + '<button type="button" class="btn" data-action="remove-question">移除</button></div>'
    + '<label class="evField evOpts" style="display:none">选项（每行一个）<textarea rows="3"></textarea></label>';
  container.append(row);
  row.querySelector('input').focus();
}

/** 题目类型变化时调整选项区显隐。 */
export function syncQuestionType(select) {
  const wrapper = select.closest('.evQuestion').querySelector('.evOpts');
  wrapper.style.display = select.value === '简答' ? 'none' : 'grid';
  wrapper.querySelector('textarea').required = select.value !== '简答';
}

/** 提交新建活动。 */
function submitEvent(form) {
  const data = Object.fromEntries(new FormData(form));
  data.title = data.title.trim();
  data.place = data.place.trim();

  if (!data.title || !data.place) {
    toast('请填写活动名称和地点');
    return;
  }
  if (new Date(data.deadline) > new Date(`${data.date}T${data.time}`) || new Date(data.deadline) <= new Date()) {
    toast('报名截止时间须晚于当前时间，并在活动开始前');
    return;
  }

  const questions = [];
  for (const row of form.querySelectorAll('.evQuestion')) {
    const type = row.querySelector('.evQType').value;
    const options = type === '简答'
      ? []
      : [...new Set(row.querySelector('textarea').value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean))];
    const label = row.querySelector('.evQLabel').value.trim();

    if (!label) { toast('请填写问题名称'); return; }
    if (type !== '简答' && options.length < 2) { toast('选择题至少需要两个不同选项'); return; }

    questions.push({ type, label, options, required: row.querySelector('.evQReq').checked });
  }

  perform('event', { ...data, points: Number(data.points), questions }, (result) => openEvent(result.event));
}

/** 导出报名名单。 */
export function exportSignup() {
  const event = currentEvent();
  if (!event) return;
  const people = enrolledStudents(event);
  const questions = event.questions ?? [];

  const header = ['姓名', '学号', '院系', '班级', ...questions.map((question) => question.label)];
  const rows = people.map((student) => [
    student.name,
    student.id,
    student.dept,
    student.cls,
    ...questions.map((question, index) => [event.regs?.[student.id]?.[index]].flat().filter(Boolean).join('、')),
  ]);

  import('../lib/xlsx-write.js').then((module) => module.download(`${event.title}报名名单`, [header, ...rows]));
}

/** 打开分享报名入口弹窗。 */
export function shareEvent() {
  const event = currentEvent();
  if (!event) return;

  const url = new URL(location.href);
  url.hash = `join=${encodeURIComponent(event.id)}`;

  let qr = '';
  if (url.protocol !== 'file:') {
    try { qr = qrSvg(url.href); } catch { qr = ''; }
  }

  openModal('分享报名入口', html`
    ${raw(qr)}
    <label class="evField">活动链接<input id="evShareURL" readonly value="${url.href}"></label>
    <p class="evNote">${url.protocol === 'file:' ? '离线文件链接仅可在当前设备打开。' : '学员在校园网络中打开链接，登录后即可报名。'}</p>
    <div class="evActions">
      <button class="btn" data-action="copy-link">复制链接</button>
      <a target="_blank" rel="noopener" class="btn primary" href="${url.hash}" data-action="close-modal">打开学员报名页</a>
    </div>
  `);
}

/** 复制报名链接到剪贴板。 */
export async function copyShareLink() {
  const input = document.getElementById('evShareURL');
  if (!input) return;
  try {
    await navigator.clipboard.writeText(input.value);
    toast('报名链接已复制');
  } catch {
    input.select();
    if (document.execCommand('copy')) toast('报名链接已复制');
    else toast('请复制已选中的链接');
  }
}

/** 取当前活动的签到名单快照。 */
async function fetchSheet() {
  const event = currentEvent();
  const { command } = await import('../lib/api.js');
  return command('sheet', { cohort: store.db.key, event: event.id });
}

/** 下载签到表 Excel。 */
export async function downloadSheet() {
  let sheet;
  try {
    sheet = await fetchSheet();
  } catch (error) {
    toast(error.message);
    return;
  }
  if (!sheet.rows.length) {
    toast('暂无报名学员，请先完成报名');
    return;
  }
  const anchor = document.createElement('a');
  anchor.href = `sheets/${encodeURIComponent(sheet.key)}`;
  anchor.click();
}

/** 打开打印签到表预览。 */
export async function printSheet() {
  let sheet;
  try {
    sheet = await fetchSheet();
  } catch (error) {
    toast(error.message);
    return;
  }
  if (!sheet.rows.length) {
    toast('暂无报名学员，请先完成报名');
    return;
  }

  const event = currentEvent();
  const total = Math.ceil(sheet.rows.length / 15);
  const version = new Date().toLocaleString('zh-CN', { hour12: false });

  let markup = '';
  for (let page = 0; page < total; page++) {
    const names = sheet.rows.slice(page * 15, page * 15 + 15);
    markup += '<section>'
      + `<small>${esc(store.db.name)}</small>`
      + `<h1>${esc(event.title)} · 签到表</h1>`
      + `<p>${esc(event.date)} ${esc(event.time || '')}　${esc(event.place || '')}　${esc(event.type)} · ${Number(event.points)} 学分</p>`
      + '<table><thead><tr><th>序号</th><th>班级</th><th>姓名</th><th>学号尾四位</th><th style="width:35%">本人签名</th></tr></thead><tbody>'
      + names.map((student, index) => `<tr><td>${page * 15 + index + 1}</td><td>${esc(student.cls)}</td>`
        + `<td>${esc(student.name)}</td><td>${esc(student.id.slice(-4))}</td><td></td></tr>`).join('')
      + '</tbody></table>'
      + `<footer>印次 ${esc(sheet.key)}　·　${sheet.final ? '正式名单' : '报名中预览'}　·　活动编号 ${esc(event.id)}　·　生成于 ${esc(version)}　·　第 ${page + 1} / ${total} 页</footer>`
      + '</section>';
  }

  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;left:-10000px;width:210mm;height:297mm;border:0';
  frame.title = '签到表打印预览';
  document.body.append(frame);

  const doc = frame.contentDocument;
  doc.open();
  doc.write('<!doctype html><html lang="zh-CN"><meta charset="UTF-8"><title>' + esc(event.title) + '签到表</title>'
    + '<style>@page{size:A4;margin:15mm}body{font:12pt "Songti SC",serif;color:#111;margin:0}section{break-after:page}section:last-child{break-after:auto}'
    + 'h1{font-size:20pt;margin:8mm 0 3mm}p,footer{font-size:10pt}table{width:100%;border-collapse:collapse}td,th{border:1px solid #555;text-align:center;padding:2mm}td{height:9mm}footer{margin-top:5mm}</style>'
    + markup + '</html>');
  doc.close();

  window.setTimeout(() => {
    const win = frame.contentWindow;
    win.addEventListener('afterprint', () => frame.remove(), { once: true });
    win.focus();
    win.print();
  }, 180);
}

/** 出勤状态选项。 */
function markOptions(selected = '') {
  return [['', '保留原记录'], ['已到课', '已到课'], ['缺席', '缺席']]
    .map(([value, label]) => `<option value="${value}" ${selected === value ? 'selected' : ''}>${label}</option>`)
    .join('');
}

/** 打开手动登记弹窗。 */
export function manualReview() {
  const event = currentEvent();
  if (!event) return;

  const people = (store.db?.students ?? []).slice().sort((a, b) =>
    Number(Object.prototype.hasOwnProperty.call(event.regs ?? {}, b.id))
    - Number(Object.prototype.hasOwnProperty.call(event.regs ?? {}, a.id)));

  renderReview(event, people, '手动登记', '');
}

/** 渲染出勤登记复核表单。 */
function renderReview(event, people, title, head) {
  const rows = people.map((student, index) => `<tr>`
    + `<td>${esc(student.name)}<div class="evMeta">${esc(student.cls)} · ${esc(student.id.slice(-4))}`
    + `${Object.prototype.hasOwnProperty.call(event.regs ?? {}, student.id) ? '' : ' · 未报名'}</div></td>`
    + `<td>${esc(event.marks?.[student.id]?.status || '待登记')}</td>`
    + `<td><select class="evSel evMark" aria-label="${esc(student.name)}的出勤状态" data-student="${esc(student.id)}">${markOptions(index % 3 === 0 ? '已到课' : '')}</select></td>`
    + '</tr>').join('');

  openModal(title, html`
    ${raw(head)}
    <p class="evNote">到课记 ${Number(event.points)} 分，缺席记 0 分。仅更新选中状态的学员。</p>
    ${raw(people.length
      ? `<form id="reviewForm"><div class="tablewrap"><table><thead><tr><th>学员</th><th>当前记录</th><th>本次登记</th></tr></thead><tbody>${rows}</tbody></table></div>`
        + '<div class="evActions"><button type="button" class="btn" data-action="close-modal">取消</button>'
        + '<button class="btn primary">确认并登记学分</button></div></form>'
      : '<p class="evEmpty">暂无可登记学员。</p>')}
  `);

  const form = document.getElementById('reviewForm');
  if (form) form.onsubmit = (submitEvent) => submitReview(submitEvent, event);
}

/** 提交出勤登记。 */
function submitReview(submitEvent, event) {
  submitEvent.preventDefault();
  const updates = [...submitEvent.currentTarget.querySelectorAll('.evMark')].filter((element) => element.value);

  if (!updates.length) {
    toast('请至少选择一名学员的出勤状态');
    return;
  }

  perform('marks', {
    event: event.id,
    rows: updates.map((element) => ({
      id: element.dataset.student,
      status: element.value,
      points: element.value === '已到课' ? event.points : 0,
      reason: '出勤登记',
    })),
  }, () => {
    state.tab = '出勤与学分';
    render();
  });
}

/** 由表单提交触发的出勤登记。 */
export function submitReviewForm(form) {
  const event = currentEvent();
  if (!event) return;
  submitReview({ preventDefault() {}, currentTarget: form }, event);
}

/** 打开照片复核弹窗。 */
export function photoReview() {
  const event = currentEvent();
  if (!event) return;

  openModal('签到照片复核', html`
    <p>上传统一签到表照片。识别建议须逐行核对，确认后才会登记学分。</p>
    <label class="evField">签到照片（每次一页）<input id="photoFile" type="file" accept="image/jpeg,image/png"></label>
    <div class="evActions">
      <button class="btn" data-action="review-photo-manual">人工核对</button>
      <button class="btn primary" data-action="review-photo-model">识别并复核</button>
    </div>
    <p id="visionError" role="alert"></p>
  `);
}

/** 处理照片复核：useModel 为真时先调用识别服务。 */
export async function reviewPhoto(useModel) {
  const event = currentEvent();
  const file = document.getElementById('photoFile')?.files?.[0];
  if (!event || !file) {
    toast('请先选择签到照片');
    return;
  }

  let signed = [];
  if (useModel) {
    const { recognize } = await import('../lib/api.js');
    const info = document.getElementById('visionError');
    info.textContent = '正在识别，请稍候…';
    try {
      signed = (await recognize(event.id, file)).signed ?? [];
    } catch (error) {
      info.textContent = error.message;
      return;
    }
    if (!info.isConnected || !document.getElementById('dlg')?.open) return;
  }

  const url = URL.createObjectURL(file);
  state.photoUrls.push(url);

  const people = (store.db?.students ?? []).slice();
  const head = `<img class="evPicture" alt="本次签到页" src="${esc(url)}">`
    + `<p>${useModel ? `已预选 ${signed.length} 条清晰签名，请核对。` : '请对照照片逐人登记。'}</p>`;

  renderReview(event, people, '复核签到记录', head);

  const ids = new Set(signed);
  for (const input of document.querySelectorAll('.evMark')) {
    if (ids.has(input.dataset.student)) input.value = '已到课';
  }
}

/** 释放照片预览的 object URL。 */
export function releasePhotos() {
  for (const url of state.photoUrls) URL.revokeObjectURL(url);
  state.photoUrls = [];
}

export { state as eventPageState };
