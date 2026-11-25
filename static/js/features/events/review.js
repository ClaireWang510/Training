// 活动管理：出勤登记、照片复核与学分登记。

import { esc, html, raw } from '../../lib/dom.js';
import { openModal, toast } from '../../lib/ui.js';
import { store } from '../../lib/store.js';
import { perform } from '../../lib/actions.js';
import { table } from '../../components/table.js';
import { currentEvent } from './index.js';

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
    + '</tr>');

  openModal(title, html`
    ${raw(head)}
    <p class="evNote">到课记 ${Number(event.points)} 分，缺席记 0 分。仅更新选中状态的学员。</p>
    ${raw(people.length
      ? `<form id="reviewForm" data-action="submit-review">${table({
        headers: ['学员', '当前记录', '本次登记'],
        rows,
      })}<div class="evActions"><button type="button" class="btn" data-action="close-modal">取消</button>`
        + '<button class="btn primary">确认并登记学分</button></div></form>'
      : '<p class="evEmpty">暂无可登记学员。</p>')}
  `);
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
    store.ui.events.tab = '出勤与学分';
    import('../../lib/renderer.js').then((module) => module.render());
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
    const { recognize } = await import('../../lib/api.js');
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
  store.ui.events.photoUrls.push(url);

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
  for (const url of store.ui.events.photoUrls) URL.revokeObjectURL(url);
  store.ui.events.photoUrls = [];
}
