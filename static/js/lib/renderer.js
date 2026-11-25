// 页面渲染器：按当前状态选择页面模块并输出内容。
// 用动态 import 打破页面模块与 app.js 之间的循环依赖。

import { store } from './store.js';
import { closeModal, toast } from './ui.js';

/** 导航栏元素。 */
const navElement = document.getElementById('nav');
/** 右上角角色按钮。 */
const roleElement = document.getElementById('role');
/** 主内容容器。 */
const appElement = document.getElementById('app');

/** 管理员页面清单。 */
const ADMIN_PAGES = [
  { key: 'home', label: '本期概览' },
  { key: 'events', label: '活动管理' },
  { key: 'roster', label: '学员名单' },
  { key: 'ledger', label: '学分总表' },
];

/** 渲染当前页面。 */
export async function render() {
  if (store.access === 'guest' || !store.db) {
    renderLogin();
    return;
  }

  if (store.access === 'admin') {
    navElement.innerHTML = ADMIN_PAGES
      .map((page) => `<button class="${store.page === page.key ? 'active' : ''}" data-action="page" data-page="${page.key}">${page.label}</button>`)
      .join('');
    roleElement.textContent = '退出登录';
    roleElement.onclick = signOut;
    appElement.innerHTML = await renderAdminPage();
    return;
  }

  navElement.innerHTML = '';
  roleElement.textContent = '退出登录';
  roleElement.onclick = signOut;

  const { renderStudent, studentCohortSelect } = await import('../features/student/index.js');
  appElement.innerHTML = renderStudent();
  appElement.insertAdjacentHTML('afterbegin', studentCohortSelect());
}

/** 渲染管理员页面。 */
async function renderAdminPage() {
  switch (store.page) {
    case 'events': {
      const { renderEvents } = await import('../features/events/index.js');
      return renderEvents();
    }
    case 'roster': {
      const { renderRoster } = await import('../features/roster/index.js');
      return renderRoster();
    }
    case 'ledger': {
      const { renderLedger } = await import('../features/ledger/index.js');
      return renderLedger();
    }
    default: {
      const { renderHome } = await import('../features/home/index.js');
      return renderHome();
    }
  }
}

/** 登录表单当前模式。 */
let loginMode = 'student';

/** 渲染登录页或管理员空状态。 */
function renderLogin() {
  navElement.innerHTML = '';
  roleElement.onclick = store.access === 'guest' ? null : signOut;
  roleElement.textContent = store.access === 'guest' ? '学生骨干培训管理系统' : '退出登录';

  if (store.access === 'admin') {
    appElement.innerHTML = '<div class="pagehead"><h1>培训班管理</h1></div>'
      + '<p>创建培训班后，即可导入本期学员名单。</p>'
      + '<p class="actions"><button class="primary" data-action="create-cohort">新建培训班</button></p>';
    return;
  }

  const isAdmin = loginMode === 'admin';

  appElement.innerHTML = '<section class="st-shell st-login">'
    + `<h2>${isAdmin ? '管理员登录' : '学员登录'}</h2>`
    + '<form id="loginForm">'
    + `<label>${isAdmin ? '管理员账号' : '学号'}<input name="id" required autocomplete="username"></label>`
    + `<label>${isAdmin ? '密码' : '姓名'}<input name="${isAdmin ? 'password' : 'name'}" ${isAdmin ? 'type="password" autocomplete="current-password"' : 'autocomplete="name"'} required></label>`
    + '<div class="st-error" role="alert"></div>'
    + '<button class="primary">登录</button>'
    + '</form>'
    + `<button class="link" id="switchLogin">${isAdmin ? '学员登录' : '管理员登录'}</button>`
    + '</section>';

  document.getElementById('switchLogin').onclick = () => {
    loginMode = isAdmin ? 'student' : 'admin';
    renderLogin();
  };

  const form = document.getElementById('loginForm');
  form.onsubmit = async (event) => {
    event.preventDefault();
    const alert = form.querySelector('[role="alert"]');
    try {
      const { login } = await import('./api.js');
      await login({ mode: loginMode, ...Object.fromEntries(new FormData(form)) });
      const { refresh } = await import('./actions.js');
      await refresh();
    } catch (error) {
      alert.textContent = error.message;
    }
  };
}

/** 退出登录。 */
export async function signOut() {
  try {
    const { logout } = await import('./api.js');
    const { refresh } = await import('./actions.js');
    await logout();
    const { setState } = await import('./store.js');
    setState({ db: null, page: 'home' });
    closeModal();
    await refresh();
  } catch (error) {
    toast(error.message);
  }
}
