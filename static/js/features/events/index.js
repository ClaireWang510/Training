// 活动管理：活动列表、活动详情、问卷展示与报名名单。

import { esc, html, raw } from '../../lib/dom.js';
import { openModal } from '../../lib/ui.js';
import { eventState, store } from '../../lib/store.js';
import { table } from '../../components/table.js';
import { crumb } from '../home/index.js';

/** 参与活动的学员，按班级与学号排序。 */
export function enrolledStudents(event) {
  return (store.db?.students ?? [])
    .filter((student) => Object.prototype.hasOwnProperty.call(event.regs ?? {}, student.id))
    .sort((a, b) => a.cls.localeCompare(b.cls, 'zh-CN') || a.id.localeCompare(b.id));
}

/** 当前打开的活动。 */
export function currentEvent() {
  return (store.db?.events ?? []).find((event) => event.id === store.ui.events.detailId) ?? null;
}

/** 返回活动列表。 */
export function openEventList() {
  import('../../lib/navigation.js').then((module) => module.go('events'));
}

/** 打开某个活动。 */
export function openEvent(id) {
  store.ui.events.detailId = String(id);
  store.ui.events.tab = '报名名单';
  import('../../lib/navigation.js').then((module) => module.go('events', { reset: false }));
}

/** 切换活动筛选。 */
export function setFilter(filter) {
  store.ui.events.filter = filter;
  import('../../lib/renderer.js').then((module) => module.render());
}

/** 切换详情页的标签页。 */
export function selectTab(tab) {
  store.ui.events.tab = tab;
  import('../../lib/renderer.js').then((module) => module.render());
}

/** 渲染活动页面。 */
export function renderEvents() {
  const event = currentEvent();
  if (event) return eventDetail(event);

  const rows = (store.db?.events ?? [])
    .filter((item) => store.ui.events.filter === '全部' || item.type === store.ui.events.filter)
    .sort((a, b) => b.date.localeCompare(a.date));

  const body = rows.map((item) => `<tr>`
    + `<td><button class="evLink" data-action="open-event" data-id="${esc(item.id)}">${esc(item.title)}</button></td>`
    + `<td>${esc(item.type)}</td>`
    + `<td>${esc(item.date)} ${esc(item.time || '')}</td>`
    + `<td>${esc(String(Number(item.points)))}</td>`
    + `<td>${enrolledStudents(item).length}</td>`
    + `<td>${esc(eventState(item))}</td>`
    + '</tr>');

  return html`
    ${raw(crumb('活动管理'))}
    <div class="evHead"><h2>活动管理</h2><button class="btn primary" data-action="new-event">创建活动</button></div>
    <div class="evTabs">
      ${raw(['全部', '必修', '选修'].map((type) =>
        `<button aria-selected="${type === store.ui.events.filter}" data-action="event-filter" data-filter="${esc(type)}">${esc(type)}</button>`).join(''))}
    </div>
    ${raw(table({
      headers: ['活动名称', '课程类型', '举办时间', '学分', '报名人数', '状态'],
      rows: body,
      empty: '当前没有活动。',
    }))}
  `;
}

/** 渲染活动详情。 */
function eventDetail(event) {
  const people = enrolledStudents(event);

  const tabs = ['活动与问卷', '报名名单', '出勤与学分']
    .map((tab) => `<button aria-selected="${tab === store.ui.events.tab}" data-action="event-tab" data-tab="${esc(tab)}">${esc(tab)}</button>`)
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

  if (store.ui.events.tab === '活动与问卷') {
    const questions = event.questions ?? [];
    const facts = [
      ['举办时间', `${event.date} ${event.time || ''}`.trim()],
      ['活动地点', event.place || '待公布'],
      ['报名截止', String(event.deadline || '').replace('T', ' ')],
    ];
    const questionItems = questions.map((question, index) => html`
      <li class="evQItem">
        <div class="evQItemHead">
          <b>${index + 1}. ${question.label}</b>
          <span class="evBadge">${question.type}${question.required ? ' · 必填' : ' · 选填'}</span>
        </div>
        ${(question.options ?? []).length
          ? raw(`<div class="evQOptions">${question.options.map((option) => `<span>${esc(option)}</span>`).join('')}</div>`)
          : raw('')}
      </li>
    `);

    return html`
      ${raw(header)}
      <div class="evBody">
        <dl class="evFacts">
          ${raw(facts.map(([label, value]) => `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join(''))}
        </dl>
        <section class="evPanel">
          <div class="evPanelHead">
            <h3>报名问卷</h3>
            <span class="evPanelMeta">${questions.length ? `共 ${questions.length} 题` : '无需额外填写'}</span>
          </div>
          <p class="evNote">姓名、学号、院系和班级由学员账号带入。</p>
          ${questions.length
            ? raw(`<ol class="evQList">${questionItems.join('')}</ol>`)
            : raw('<p class="evPanelEmpty">本次活动报名仅登记基本信息，无需填写额外问卷。</p>')}
        </section>
      </div>
    `;
  }

  if (store.ui.events.tab === '报名名单') {
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
    + `<td><button class="evLink" data-action="show-answers" data-id="${esc(student.id)}">查看</button></td></tr>`);

  return table({
    headers: ['姓名', '学号', '院系', '班级', '问卷'],
    rows,
  });
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
  });

  return table({
    headers: ['姓名', '班级', '出勤', '已获学分'],
    rows,
  });
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
