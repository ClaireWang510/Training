// 交互路由：把界面上的 data-* 属性映射到页面模块的具体动作。
// 原先散落在 HTML 里的内联 onclick 全部集中到这里，便于追踪与扩展。

import { closeModal } from './ui.js';
import { store } from './store.js';

/** 事件属性 -> 处理函数的映射表。每个条目返回处理函数。 */
const ACTIONS = {
  'landing': async () => {
    const { store } = await import('./store.js');
    if (store.access === 'admin' && store.db) {
      const { go } = await import('./navigation.js');
      await go('home');
    } else {
      const { render } = await import('./renderer.js');
      await render();
    }
  },
  'cohort-menu': () => import('../pages/home.js').then((m) => m.cohortMenu()),
  'create-cohort': () => import('../pages/home.js').then((m) => m.createCohort()),
  'switch-cohort': (target) => import('./navigation.js').then((m) => m.switchCohort(target.value)),
  'settings': () => import('../pages/home.js').then((m) => m.editCohortSettings()),
  'new-event': () => import('../pages/events.js').then((m) => m.createEvent()),
  'all-events': () => import('../pages/events.js').then((m) => m.openEventList()),
  'event-list': () => import('../pages/events.js').then((m) => m.openEventList()),
  'share': () => import('../pages/events.js').then((m) => m.shareEvent()),
  'copy-link': () => import('../pages/events.js').then((m) => m.copyShareLink()),
  'export-signup': () => import('../pages/events.js').then((m) => m.exportSignup()),
  'sheet': () => import('../pages/events.js').then((m) => m.downloadSheet()),
  'print': () => import('../pages/events.js').then((m) => m.printSheet()),
  'photo-review': () => import('../pages/events.js').then((m) => m.photoReview()),
  'manual-review': () => import('../pages/events.js').then((m) => m.manualReview()),
  'review-photo-manual': () => import('../pages/events.js').then((m) => m.reviewPhoto(false)),
  'review-photo-model': () => import('../pages/events.js').then((m) => m.reviewPhoto(true)),
  'add-question': () => {
    const container = document.getElementById('evQs');
    if (container) import('../pages/events.js').then((m) => m.addQuestion(container));
  },
  'remove-question': (target) => target.closest('.evQuestion')?.remove(),
  'export-ledger': () => import('../pages/ledger.js').then((m) => m.exportLedger()),
  'import-roster': () => import('../pages/roster.js').then((m) => m.openImport()),
  'roster-sample': () => import('../pages/roster.js').then((m) => m.downloadSample()),
  'commit-roster': () => import('../pages/roster.js').then((m) => m.commitImport()),
  'close-modal': () => closeModal(),
  'cancel-signup': () => import('../pages/student.js').then((m) => m.confirmCancel()),
  'cancel-signup-confirm': () => import('../pages/student.js').then((m) => m.cancelSignup()),
};

/**
 * 处理一次点击事件。
 * @param {Event} event 原始事件
 */
export async function handleClick(event) {
  const target = event.target;

  const action = target.closest('[data-action]');
  if (action) {
    const name = action.dataset.action;
    const handler = ACTIONS[name];
    if (handler) {
      event.preventDefault();
      await handler(action);
      return;
    }
  }

  // 切换页面（顶部导航与首页快捷入口共用）
  const pageButton = target.closest('[data-page]');
  if (pageButton) {
    event.preventDefault();
    if (pageButton.dataset.page === 'events') {
      const { openEventList } = await import('../pages/events.js');
      await openEventList();
    } else {
      const { go } = await import('./navigation.js');
      await go(pageButton.dataset.page);
    }
    return;
  }

  // 名单翻页
  const turnButton = target.closest('[data-turn]');
  if (turnButton) {
    event.preventDefault();
    const { turnPage } = await import('../pages/roster.js');
    turnPage(Number(turnButton.dataset.turn));
    return;
  }

  // 学分总表翻页
  const ledgerTurn = target.closest('[data-ledger-turn]');
  if (ledgerTurn) {
    event.preventDefault();
    const { turnLedgerPage } = await import('../pages/ledger.js');
    turnLedgerPage(Number(ledgerTurn.dataset.ledgerTurn));
    return;
  }

  // 查看学员详细资料（名单与学分总表共用）
  const profileButton = target.closest('[data-view-student]');
  if (profileButton) {
    event.preventDefault();
    const { showStudent } = await import('../pages/roster.js');
    showStudent(profileButton.dataset.viewStudent);
    return;
  }

  // 登记与更正学分（学分总表中的单元格，比单纯打开活动更具体）
  const markButton = target.closest('[data-student][data-event]');
  if (markButton) {
    event.preventDefault();
    const { editMark } = await import('../pages/ledger.js');
    editMark(markButton.dataset.student, markButton.dataset.event);
    return;
  }

  // 打开某个活动
  const eventButton = target.closest('[data-event]');
  if (eventButton) {
    event.preventDefault();
    const { openEvent } = await import('../pages/events.js');
    openEvent(eventButton.dataset.event);
    return;
  }

  // 查看某位学员的问卷答案
  const answersButton = target.closest('[data-answers]');
  if (answersButton) {
    event.preventDefault();
    const { showAnswers } = await import('../pages/events.js');
    showAnswers(answersButton.dataset.answers);
    return;
  }

  // 切换班期
  const cohortButton = target.closest('[data-cohort]');
  if (cohortButton) {
    event.preventDefault();
    const { switchCohort } = await import('./navigation.js');
    await switchCohort(cohortButton.dataset.cohort);
    return;
  }

  // 切换活动筛选
  const filterButton = target.closest('[data-filter]');
  if (filterButton) {
    event.preventDefault();
    const { setFilter } = await import('../pages/events.js');
    setFilter(filterButton.dataset.filter);
    return;
  }

  // 切换活动详情标签页
  const tabButton = target.closest('[data-tab]');
  if (tabButton) {
    event.preventDefault();
    const { selectTab } = await import('../pages/events.js');
    selectTab(tabButton.dataset.tab);
    return;
  }

  // 调整学员资料
  const editButton = target.closest('[data-edit]');
  if (editButton) {
    event.preventDefault();
    const { editStudentInfo } = await import('../pages/roster.js');
    editStudentInfo(editButton.dataset.edit);
    return;
  }

  // 学员视图切换
  const studentView = target.closest('[data-student-view]');
  if (studentView) {
    event.preventDefault();
    const { switchView } = await import('../pages/student.js');
    switchView(studentView.dataset.studentView);
    return;
  }

  // 学员打开活动
  const studentEvent = target.closest('[data-student-event]');
  if (studentEvent) {
    event.preventDefault();
    const { pickEvent } = await import('../pages/student.js');
    pickEvent(studentEvent.dataset.studentEvent);
    return;
  }
}

/**
 * 处理一次 change 事件。
 * @param {Event} event 原始事件
 */
export async function handleChange(event) {
  const target = event.target;

  const mapSelect = target.closest('[data-map]');
  if (mapSelect) {
    const { mapColumn } = await import('../pages/roster.js');
    mapColumn(Number(mapSelect.dataset.map), mapSelect.value);
    return;
  }

  const sheetSelect = target.closest('[data-action="select-sheet"]');
  if (sheetSelect) {
    const { selectSheet } = await import('../pages/roster.js');
    selectSheet(sheetSelect.value);
    return;
  }

  const headerSelect = target.closest('[data-action="set-header"]');
  if (headerSelect) {
    const { setHeader } = await import('../pages/roster.js');
    setHeader(headerSelect.value);
    return;
  }

  const questionType = target.closest('.evQType');
  if (questionType) {
    const { syncQuestionType } = await import('../pages/events.js');
    syncQuestionType(questionType);
    return;
  }

  const rosterFilter = target.closest('[data-action="roster-filter"]');
  if (rosterFilter) {
    const { filterRoster } = await import('../pages/roster.js');
    filterRoster(rosterFilter.value);
    return;
  }

  const ledgerFilter = target.closest('[data-action="ledger-filter"]');
  if (ledgerFilter) {
    const { filterLedger } = await import('../pages/ledger.js');
    filterLedger(ledgerFilter.value);
    return;
  }

  const rosterFile = target.closest('[data-action="roster-file"]');
  if (rosterFile) {
    const { loadFile } = await import('../pages/roster.js');
    await loadFile(rosterFile.files?.[0]);
    return;
  }
}

/**
 * 处理一次 input 事件。
 * @param {Event} event 原始事件
 */
export async function handleInput(event) {
  const target = event.target;

  if (target.id === 'searchLedger') {
    const { searchLedger } = await import('../pages/ledger.js');
    searchLedger(target.value);
    return;
  }

  if (target.dataset.action === 'roster-search') {
    const { searchRoster } = await import('../pages/roster.js');
    searchRoster(target.value);
  }
}

/**
 * 处理一次 submit 事件。
 * @param {Event} event 原始事件
 */
export async function handleSubmit(event) {
  const form = event.target;

  if (form.id === 'studentSignupForm') {
    event.preventDefault();
    const { submitSignup } = await import('../pages/student.js');
    submitSignup(form);
    return;
  }

  if (form.id === 'reviewForm') {
    event.preventDefault();
    const { submitReviewForm } = await import('../pages/events.js');
    submitReviewForm(form);
    return;
  }
}
