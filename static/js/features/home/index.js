// 管理员首页：本期概览、培训班创建与切换、班期编辑。

import { esc, html, isoDate, raw, shiftedDate } from '../../lib/dom.js';
import { bookArt, icon, openModal, toast } from '../../lib/ui.js';
import { store } from '../../lib/store.js';
import { perform } from '../../lib/actions.js';

/** 渲染本期概览。 */
export function renderHome() {
  const cohort = store.db;
  if (!cohort) return '';

  const today = isoDate(new Date());
  const upcoming = cohort.events
    .filter((event) => event.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3);

  const pending = cohort.events.filter(
    (event) => event.date < today && Object.keys(event.regs ?? {}).some((id) => !event.marks?.[id]),
  );

  return html`
    ${raw(crumb('本期概览'))}
    <section class="mast">
      ${raw(bookArt())}
      <div class="term">本期培训班</div>
      <h1>${cohort.name}</h1>
      <div class="mastmeta">
        ${raw(icon('cal'))}${cohort.start} — ${cohort.end}
        <button data-action="settings">编辑班期</button>
      </div>
    </section>
    <div class="split">
      <section>
        <div class="sectionhead">
          <h2>近期活动</h2>
          <button class="btn primary" data-action="new-event">${raw(icon('plus'))}创建活动</button>
        </div>
        ${raw(upcoming.map((event) => scheduleRow(event)).join('') || '<p class="empty-note">暂无近期活动</p>')}
        <button class="link" data-action="all-events">查看全部活动</button>
      </section>
      <section>
        <div class="sectionhead"><h2>班务概况</h2></div>
        <div class="nums">
          <div><b>${cohort.students.length}</b>参训学员</div>
          <div><b>${cohort.events.length}</b>课程活动</div>
        </div>
        <button class="shortcut" data-action="page" data-page="roster">${raw(icon('user'))}学员名单<small>查看与导入</small></button>
        <button class="shortcut" data-action="page" data-page="ledger">${raw(icon('table'))}学分总表<small>登记与补修</small></button>
        ${raw(pending.length
          ? `<button class="shortcut" data-action="open-event" data-id="${esc(pending[0].id)}">${icon('book')}待登记出勤<small>${pending.length} 场活动</small></button>`
          : '')}
      </section>
    </div>
  `;
}

/** 一条近期活动。 */
function scheduleRow(event) {
  const open = new Date(event.deadline) > new Date();
  return `<button class="sched" data-action="open-event" data-id="${esc(event.id)}">`
    + `<div class="cal"><b>${esc(event.date.slice(-2))}</b><small>${Number(event.date.slice(5, 7))} 月</small></div>`
    + `<div><strong>${esc(event.title)}</strong>`
    + `<div class="fine"><span class="type ${event.type === '选修' ? 'optional' : ''}">${esc(event.type)}</span>`
    + `${esc(String(event.points))} 学分　·　${esc(event.time || '')}　${esc(event.place || '')}</div></div>`
    + `<span class="status">${open ? '报名中' : '报名截止'}</span>`
    + '</button>';
}

/** 面包屑。 */
export function crumb(label) {
  return `<div class="crumb"><button class="link" style="padding:0;color:inherit" data-action="cohort-menu">培训班管理</button><span>/</span>${esc(label)}</div>`;
}

/** 打开培训班管理弹窗。 */
export function cohortMenu() {
  const items = Object.values(store.cohorts)
    .map((cohort) => `<button class="shortcut" data-action="open-cohort" data-cohort="${esc(cohort.key)}">${esc(cohort.name)}<small>${cohort.key === store.db?.key ? '当前班期' : '进入'}</small></button>`)
    .join('');

  openModal('培训班管理', html`
    <div>${raw(items)}</div>
    <div class="actions"><button class="primary" data-action="create-cohort">新建培训班</button></div>
  `);
}

/** 打开新建培训班弹窗。 */
export function createCohort() {
  openModal('新建培训班', html`
    <form id="cohortForm">
      <label class="field">培训班名称<input name="title" required maxlength="70"></label>
      <label class="field">开始日期<input name="start" required type="date" value="${isoDate(new Date())}"></label>
      <label class="field">结束日期<input name="end" required type="date" value="${shiftedDate(30)}"></label>
      <div class="actions"><button class="primary">创建培训班</button></div>
    </form>
  `);

  const form = document.getElementById('cohortForm');
  form.onsubmit = (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const name = String(data.get('title') ?? '').trim();
    if (!name || data.get('end') < data.get('start')) {
      toast('请核对班名及起止日期');
      return;
    }
    perform('create', { name, start: data.get('start'), end: data.get('end') }, (result) => {
      import('../../lib/navigation.js').then((module) => module.switchCohort(result.key));
    });
  };
}

/** 打开编辑班期弹窗。 */
export function editCohortSettings() {
  const cohort = store.db;
  if (!cohort) return;

  openModal('编辑培训班', html`
    <form id="settingsForm">
      <label class="field">培训班名称<input name="title" required maxlength="70" value="${cohort.name}"></label>
      <label class="field">开始日期<input name="start" type="date" required value="${cohort.start}"></label>
      <label class="field">结束日期<input name="end" type="date" required value="${cohort.end}"></label>
      <div class="actions"><button class="btn primary">保存班期</button></div>
    </form>
  `);

  const form = document.getElementById('settingsForm');
  form.onsubmit = (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const name = String(data.get('title') ?? '').trim();
    if (!name || data.get('start') > data.get('end')) {
      toast('请核对班名及起止日期');
      return;
    }
    perform('settings', { name, start: data.get('start'), end: data.get('end') });
  };
}
