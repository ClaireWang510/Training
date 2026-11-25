// 页面导航：切换视图与切换班期。
// 独立成模块，页面模块可安全引用而不与 app.js 形成循环依赖。

import { resetUiState, setState, store } from './store.js';
import { closeModal } from './ui.js';
import { render } from './renderer.js';

/**
 * 切换到某个页面。
 * 默认重置该页面的临时状态（搜索、筛选、翻页）；打开活动详情等
 * 「带着状态进入」的场景可传 { reset: false }。
 */
export async function go(page, { reset = true } = {}) {
  if (page !== 'student' && location.hash.startsWith('#join=')) {
    history.replaceState(null, '', location.href.split('#')[0]);
  }
  if (reset) resetUiState(page);
  setState({ page });
  closeModal();
  await render();
  window.scrollTo(0, 0);
}

/** 切换当前班期。 */
export async function switchCohort(key) {
  setState({ db: store.cohorts[key] });
  history.replaceState(null, '', location.pathname);
  await go(store.access === 'admin' ? 'home' : 'student');
}
