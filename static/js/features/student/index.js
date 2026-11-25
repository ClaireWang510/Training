// 学员视图：活动报名、我的学分。

import { html, raw } from '../../lib/dom.js';
import { closeModal, openModal, toast } from '../../lib/ui.js';
import { creditTotals, findEvent, registrationOpen, store, studentStatus } from '../../lib/store.js';
import { perform } from '../../lib/actions.js';

/** 读取地址栏中的 #join= 参数。 */
function readLink() {
  const state = store.ui.student;
  const hash = location.hash;
  if (!hash.startsWith('#join=')) {
    state.processedHash = '';
    return;
  }
  if (hash === state.processedHash) return;
  state.processedHash = hash;
  try {
    state.selectedEvent = decodeURIComponent(hash.slice(6));
  } catch {
    state.selectedEvent = hash.slice(6);
  }
  state.view = 'activities';
}

/** 打开某个活动。 */
export function pickEvent(id) {
  store.ui.student.selectedEvent = id;
  store.ui.student.view = 'activities';
  import('../../lib/renderer.js').then((module) => module.render());
}

/** 切换学员视图的标签页。 */
export function switchView(view) {
  store.ui.student.view = view;
  store.ui.student.selectedEvent = '';
  import('../../lib/renderer.js').then((module) => module.render());
}

/** 学员是否还能报名。 */
function canRegister(event) {
  return Boolean(event.deadline)
    && registrationOpen(event)
    && !event.marks?.[store.studentId];
}

/** 学员是否已报名。 */
function isRegistered(event) {
  return Object.prototype.hasOwnProperty.call(event.regs ?? {}, store.studentId);
}

/** 渲染学员页面。 */
export function renderStudent() {
  const state = store.ui.student;
  readLink();

  const person = (store.db?.students ?? []).find((student) => String(student.id) === store.studentId);
  if (!person) return '<p>当前班期没有参训记录。</p>';

  const event = findEvent(state.selectedEvent);
  if (state.selectedEvent) {
    if (!event) {
      return html`<section class="st-shell"><h2>活动未找到</h2><p>请确认活动链接对应当前培训班。</p>`
        + '<button class="btn" data-action="student-view" data-view="activities">查看本期活动</button></section>';
    }
    return html`<section class="st-shell">${raw(eventDetail(event))}</section>`;
  }

  const tabs = [['activities', '活动报名'], ['credits', '我的学分']]
    .map(([key, label]) => `<button role="tab" aria-selected="${state.view === key}" data-action="student-view" data-view="${key}">${label}</button>`)
    .join('');

  return html`<section class="st-shell">
    <div class="st-user">
      <div>
        <div class="st-meta">${store.db.name}</div>
        <h2>我的培训</h2>
        <p>${person.name}　${person.cls}</p>
      </div>
    </div>
    <div class="st-tabs" role="tablist" aria-label="我的培训">${raw(tabs)}</div>
    ${raw(state.view === 'credits' ? transcript() : activities())}
  </section>`;
}

/** 学员视图顶部的班期选择。 */
export function studentCohortSelect() {
  const options = Object.values(store.cohorts)
    .map((cohort) => `<option value="${cohort.key}" ${store.db?.key === cohort.key ? 'selected' : ''}>${cohort.name}</option>`)
    .join('');
  return html`<div class="crumb"><label>培训班　<select data-action="switch-cohort">${raw(options)}</select></label></div>`;
}

/** 活动列表。 */
function activities() {
  const items = [...(store.db?.events ?? [])].sort((a, b) =>
    Number(canRegister(b)) - Number(canRegister(a))
    || (canRegister(a) ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)));

  if (!items.length) return '<p class="st-empty">本期尚未发布活动。</p>';

  const rows = items.map((event) => {
    const date = String(event.date || '').split('-');
    return html`<button type="button" class="st-row" data-action="student-event" data-id="${event.id}">
      <span class="st-date"><strong>${date[2] || '—'}</strong><small>${date[1] ? `${Number(date[1])}月` : ''}</small></span>
      <span class="st-main"><strong>${event.title}</strong><small>${event.type} · ${event.points} 学分 · ${event.place || '地点待定'}</small></span>
      <span class="st-status">${studentStatus(event, store.studentId)}</span>
    </button>`;
  }).join('');

  return `<div class="st-list">${rows}</div>`;
}

/** 活动详情与报名表单。 */
function eventDetail(event) {
  const registered = isRegistered(event);
  const open = canRegister(event);
  const mark = event.marks?.[store.studentId];

  return html`<button class="btn" data-action="student-view" data-view="activities">返回活动列表</button>
    <article class="st-detail">
      <div class="st-meta">${event.type}课程 · ${String(event.points)} 学分</div>
      <h2>${event.title}</h2>
      <dl class="st-facts">
        <dt>活动时间</dt><dd>${event.date} ${event.time || ''}</dd>
        <dt>活动地点</dt><dd>${event.place || '待公布'}</dd>
        <dt>报名截止</dt><dd>${String(event.deadline || '').replace('T', ' ')}</dd>
        <dt>我的状态</dt><dd>${studentStatus(event, store.studentId)}${mark ? ` · 实得 ${mark.points} 学分` : ''}</dd>
      </dl>
      <form id="studentSignupForm" data-action="submit-signup">
        ${raw((open || registered) ? questions(event, open) : '')}
        <div role="alert" class="st-error"></div>
        <div class="actions">
          ${raw(open
            ? `<button class="btn primary" type="submit">${registered ? '保存报名信息' : '确认报名'}</button>`
              + (registered ? '<button type="button" class="btn" data-action="cancel-signup">取消报名</button>' : '')
            : '')}
        </div>
      </form>
    </article>`;
}

/** 问卷控件。 */
function questions(event, open) {
  const existing = event.regs?.[store.studentId] ?? [];

  return (event.questions ?? []).map((question, index) => {
    const field = `answer${index}`;
    const old = existing[index] ?? '';
    const label = html`${question.label}${question.required ? raw(' <span class="st-required">必填</span>') : raw('')}`;

    let control;
    if (question.type === '多选' || question.type === '单选') {
      const multiple = question.type === '多选';
      const chosen = Array.isArray(old) ? old : [old];
      control = (question.options ?? []).map((option) => html`<label class="st-option">
        <input type="${multiple ? 'checkbox' : 'radio'}" name="${field}" value="${option}" ${chosen.includes(option) ? 'checked' : ''}>
        <span>${option}</span>
      </label>`).join('');
    } else {
      control = html`<textarea name="${field}" aria-label="${question.label}" rows="3" maxlength="2000">${old}</textarea>`;
    }

    return html`<fieldset data-q="${index}" ${raw(open ? '' : 'disabled')}>
      <legend>${raw(label)}</legend>
      ${raw(control)}
    </fieldset>`;
  }).join('');
}

/** 我的学分。 */
function transcript() {
  const events = (store.db?.events ?? []).filter((event) =>
    event.type === '必修' || isRegistered(event) || event.marks?.[store.studentId]);

  const [required, elective, total] = creditTotals(store.studentId);

  const rows = events.map((event) => {
    const mark = event.marks?.[store.studentId];
    return html`<button class="st-row" data-action="student-event" data-id="${event.id}">
      <span class="st-main"><strong>${event.title}</strong><small>${event.type} · ${studentStatus(event, store.studentId)}</small></span>
      <span class="st-status">${mark ? `${mark.points} 分` : '待获学分'}</span>
    </button>`;
  }).join('');

  return html`<div class="st-credit">
    <span>已获总学分</span><strong>${total}</strong>
    <small>必修 ${required} 分　／　选修 ${elective} 分</small>
  </div>
  ${raw(rows || '<p class="st-empty">暂无课程记录。</p>')}`;
}

/** 提交报名。 */
export function submitSignup(form) {
  const event = findEvent(store.ui.student.selectedEvent);
  if (!event || !canRegister(event) || !store.studentId) {
    import('../../lib/renderer.js').then((module) => module.render());
    toast('报名已截止或出勤已登记');
    return false;
  }

  const editing = isRegistered(event);
  const answers = [];
  const data = new FormData(form);

  for (const [index, question] of (event.questions ?? []).entries()) {
    const key = `answer${index}`;
    const value = question.type === '多选'
      ? data.getAll(key).map(String)
      : String(data.get(key) || '').trim();

    if (question.required && value.length === 0) {
      const group = form.querySelector(`[data-q="${index}"]`);
      group?.querySelector('input, textarea')?.focus();
      form.querySelector('[role="alert"]').textContent = `请填写「${question.label}」。`;
      return false;
    }
    answers.push(value);
  }

  perform('register', { event: event.id, answers }, () => {
    switchView('activities');
    toast(editing ? '报名信息已更新' : '报名成功');
  });
  return false;
}

/** 打开取消报名确认框。 */
export function confirmCancel() {
  openModal('取消本次报名？', html`
    <p>报名名单将同步更新。截止前仍可重新报名。</p>
    <div class="actions">
      <button class="btn" data-action="close-modal">保留报名</button>
      <button class="btn primary" data-action="cancel-signup-confirm">确认取消</button>
    </div>
  `);
}

/** 执行取消报名。 */
export function cancelSignup() {
  const event = findEvent(store.ui.student.selectedEvent);
  closeModal();

  if (!event || !canRegister(event)) {
    import('../../lib/renderer.js').then((module) => module.render());
    toast('报名已截止或出勤已登记');
    return;
  }
  perform('register', { event: event.id, cancel: true }, () => switchView('activities'));
}
