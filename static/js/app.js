// 应用入口：装配全局事件、启动应用。
// 页面渲染与写操作分别位于 lib/renderer.js 与 lib/actions.js，
// 页面模块只依赖这些模块，避免循环引用。

import { boot, isModalOpen, toast } from './lib/ui.js';
import { store } from './lib/store.js';
import { isBusy, refresh } from './lib/actions.js';
import { render } from './lib/renderer.js';
import { handleChange, handleClick, handleInput, handleSubmit } from './lib/interactions.js';

const navElement = document.getElementById('nav');
const appElement = document.getElementById('app');

/** 绑定全局事件。 */
function bindGlobalEvents() {
  navElement.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-page]');
    if (!button) return;
    const { go } = await import('./lib/navigation.js');
    if (button.dataset.page === 'events') {
      const { openEventList } = await import('./pages/events.js');
      await openEventList();
    } else {
      await go(button.dataset.page);
    }
  });

  // 主内容区与对话框内的交互统一交给交互路由处理
  document.body.addEventListener('click', (event) => {
    handleClick(event).catch((error) => toast(error.message));
  });

  document.body.addEventListener('change', (event) => {
    handleChange(event).catch((error) => toast(error.message));
  });

  document.body.addEventListener('input', (event) => {
    handleInput(event).catch((error) => toast(error.message));
  });

  document.body.addEventListener('submit', (event) => {
    handleSubmit(event).catch((error) => toast(error.message));
  });

  window.addEventListener('hashchange', () => {
    refresh().catch((error) => toast(error.message));
  });

  window.addEventListener('pageshow', (event) => {
    if (event.persisted) window.location.reload();
  });

  window.addEventListener('focus', () => {
    if (!isModalOpen() && !isBusy() && store.access !== 'guest' && !document.querySelector('.st-detail form')) {
      refresh().catch((error) => toast(error.message));
    }
  });
}

/** 启动应用。 */
async function start() {
  boot();
  bindGlobalEvents();
  try {
    await refresh();
  } catch (error) {
    appElement.textContent = error.message;
  }
}

export { render, refresh };

start();
