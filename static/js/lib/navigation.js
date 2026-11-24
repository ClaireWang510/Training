// 页面导航：切换视图与切换班期。
// 独立成模块，页面模块可安全引用而不与 app.js 形成循环依赖。

import { store } from './store.js';
import { closeModal } from './ui.js';
import { render } from './renderer.js';

/** 切换到某个页面。 */
export async function go(page) {
  if (page !== 'student' && location.hash.startsWith('#join=')) {
    history.replaceState(null, '', location.href.split('#')[0]);
  }
  const { setState } = await import('./store.js');
  setState({ page });
  closeModal();
  await render();
  window.scrollTo(0, 0);
}

/** 切换当前班期。 */
export async function switchCohort(key) {
  const { setState } = await import('./store.js');
  setState({ db: store.cohorts[key] });
  history.replaceState(null, '', location.pathname);
  await go(store.access === 'admin' ? 'home' : 'student');
}
