// 活动管理：创建活动与问卷编辑。

import { html, raw, shiftedDate } from '../../lib/dom.js';
import { openModal, toast } from '../../lib/ui.js';
import { perform } from '../../lib/actions.js';

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
    + '<div class="evLine"><select class="evSel evQType" data-action="question-type"><option>简答</option><option>单选</option><option>多选</option></select>'
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

  perform('event', { ...data, points: Number(data.points), questions }, (result) => {
    import('./index.js').then((module) => module.openEvent(result.event));
  });
}
