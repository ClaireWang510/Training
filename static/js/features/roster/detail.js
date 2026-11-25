// 学员名单：学员详情与资料编辑。

import { esc, html, raw } from '../../lib/dom.js';
import { openModal, toast } from '../../lib/ui.js';
import { creditTotals, store } from '../../lib/store.js';
import { perform } from '../../lib/actions.js';

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
        <button class="btn primary" data-action="edit-student" data-id="${esc(String(student.id))}">编辑资料</button>
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
