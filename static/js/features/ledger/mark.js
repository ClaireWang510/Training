// 学分总表：单条学分的补修与更正登记。

import { esc, html, raw } from '../../lib/dom.js';
import { openModal, toast } from '../../lib/ui.js';
import { findEvent, findStudent } from '../../lib/store.js';
import { perform } from '../../lib/actions.js';

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
