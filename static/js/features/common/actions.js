// 通用动作：导航、弹窗与问卷题目的增删。

import { registerActions } from '../../lib/action-registry.js';

registerActions({
  click: {
    /** 点击顶部品牌区：管理员回到首页，其他角色重新渲染登录页。 */
    landing: async () => {
      const { store } = await import('../../lib/store.js');
      if (store.access === 'admin' && store.db) {
        const { go } = await import('../../lib/navigation.js');
        await go('home');
      } else {
        const { render } = await import('../../lib/renderer.js');
        await render();
      }
    },

    /** 切换管理员页面。 */
    page: async (element) => {
      const page = element.dataset.page;
      if (page === 'events') {
        const { openEventList } = await import('../events/index.js');
        openEventList();
      } else {
        const { go } = await import('../../lib/navigation.js');
        await go(page);
      }
    },

    'close-modal': () => import('../../lib/ui.js').then((module) => module.closeModal()),

    /** 在创建活动表单中追加一道问卷题。 */
    'add-question': async () => {
      const container = document.getElementById('evQs');
      if (!container) return;
      const { addQuestion } = await import('../events/forms.js');
      addQuestion(container);
    },

    'remove-question': (element) => element.closest('.evQuestion')?.remove(),
  },
});
