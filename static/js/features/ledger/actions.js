// 学分总表相关动作。

import { registerActions } from '../../lib/action-registry.js';

registerActions({
  click: {
    'export-ledger': () => import('./index.js').then((module) => module.exportLedger()),
    'edit-mark': (element) => import('./mark.js')
      .then((module) => module.editMark(element.dataset.student, element.dataset.event)),
    'ledger-turn': (element) => import('./index.js').then((module) => module.turnLedgerPage(Number(element.dataset.delta))),
  },

  change: {
    'ledger-filter': (element) => import('./index.js').then((module) => module.filterLedger(element.value)),
  },

  input: {
    'ledger-search': (element) => import('./index.js').then((module) => module.searchLedger(element.value)),
  },
});
