// 应用动作：写操作、状态同步与渲染入口。
// 独立成模块，避免页面模块与 app.js 互相 import 造成循环依赖。

import { ApiError, command, fetchState } from './api.js';
import { closeModal, toast } from './ui.js';
import { setState, store } from './store.js';

/** 写操作进行中，避免重复提交。 */
let pending = false;

/** 是否正在执行写操作。 */
export function isBusy() {
  return pending;
}

/**
 * 执行一次写操作。
 * 成功后刷新会话状态；409 表示数据版本冲突，刷新以展示最新内容。
 */
export async function perform(action, payload, onSuccess) {
  if (pending) return;
  pending = true;
  setState({ busy: true });
  try {
    const result = await command(action, { cohort: store.db?.key, version: store.db?.version, ...payload });
    closeModal();
    await refresh();
    if (onSuccess) onSuccess(result);
    else toast('已保存');
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      closeModal();
      await refresh();
    }
    toast(error.message);
  } finally {
    pending = false;
    setState({ busy: false });
  }
}

/** 从后端同步会话与班期数据。 */
export async function refresh() {
  const session = await fetchState();
  const activeKey = store.db?.key;

  const cohorts = Object.fromEntries((session.cohorts || []).map((cohort) => [cohort.key, cohort]));
  const db = cohorts[activeKey] ?? Object.values(cohorts)[0] ?? null;

  setState({
    access: session.role,
    studentId: session.sid || '',
    cohorts,
    db,
  });

  if (session.role === 'student') {
    setState({ page: 'student' });
    if (location.hash.startsWith('#join=')) {
      const id = location.hash.slice(6);
      const matched = Object.values(cohorts).find((cohort) => cohort.events.some((event) => event.id === id));
      if (matched) setState({ db: matched });
    }
  } else if (session.role === 'admin' && store.page === 'student') {
    setState({ page: 'home' });
  }

  const { render } = await import('./renderer.js');
  render();
}
