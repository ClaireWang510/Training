// 应用状态集中管理。原先散落在各文件顶层的全局变量都收拢到这里，
// 页面模块通过 store 读取状态，通过订阅机制响应变化。

const listeners = new Set();

export const store = {
  /** 'guest' | 'admin' | 'student' */
  access: 'guest',
  /** 当前班期对象，含 students 与 events */
  db: null,
  /** 全部可见班期，key 为班期 id */
  cohorts: {},
  /** 当前登录学员的学号 */
  studentId: '',
  /** 当前管理员页面：home | events | roster | ledger | student */
  page: 'home',
  /** 是否正在进行写操作 */
  busy: false,
};

/** 订阅状态变化，返回取消订阅的函数。 */
export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** 通知所有订阅者状态已变化。 */
export function notify() {
  for (const listener of listeners) listener(store);
}

/** 写入状态并通知订阅者。 */
export function setState(patch) {
  Object.assign(store, patch);
  notify();
}

/** 当前班期中的活动列表。 */
export function events() {
  return store.db?.events ?? [];
}

/** 按 id 查找活动。 */
export function findEvent(id) {
  return events().find((event) => String(event.id) === String(id)) ?? null;
}

/** 按 id 查找学员。 */
export function findStudent(id) {
  return store.db?.students?.find((student) => String(student.id) === String(id)) ?? null;
}

/** 学员在活动上的出勤状态文案。 */
export function markText(event, studentId) {
  const mark = event.marks?.[studentId];
  if (mark?.status) return mark.status;
  return Object.prototype.hasOwnProperty.call(event.regs ?? {}, studentId) ? '待登记' : '未报名';
}

/** 学员在某场活动上的实得学分。 */
export function markPoints(event, studentId) {
  return Number(event.marks?.[studentId]?.points ?? 0);
}

/** 活动是否仍在报名期内（服务端以北京时间判断，这里仅用于展示）。 */
export function registrationOpen(event, now = new Date()) {
  if (!event.deadline) return false;
  return now.getTime() < new Date(event.deadline).getTime();
}

/** 活动的展示状态。 */
export function eventState(event, now = new Date()) {
  if (new Date(`${event.date}T${event.time || '23:59'}`) < now) return '已举办';
  if (new Date(event.deadline) < now) return '报名截止';
  return '报名中';
}

/** 学员在活动上的展示状态。 */
export function studentStatus(event, studentId, now = new Date()) {
  const mark = event.marks?.[studentId];
  if (mark) return mark.status;
  const registered = Object.prototype.hasOwnProperty.call(event.regs ?? {}, studentId);
  const open = registrationOpen(event, now) && !mark;
  if (registered) return open ? '已报名' : '已报名 · 待登记';
  return open ? '可报名' : '未报名';
}

/** 学员的必修、选修与总学分。 */
export function creditTotals(studentId) {
  let required = 0;
  let elective = 0;
  for (const event of events()) {
    const points = markPoints(event, studentId);
    if (event.type === '必修') required += points;
    else elective += points;
  }
  return [required, elective, required + elective].map((n) => Number(n.toFixed(2)));
}
