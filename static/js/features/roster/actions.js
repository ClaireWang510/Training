// 学员名单相关动作。

import { registerActions } from '../../lib/action-registry.js';

registerActions({
  click: {
    'import-roster': () => import('./import.js').then((module) => module.openImport()),
    'roster-sample': () => import('./import.js').then((module) => module.downloadSample()),
    'commit-roster': () => import('./import.js').then((module) => module.commitImport()),
    'roster-turn': (element) => import('./index.js').then((module) => module.turnRosterPage(Number(element.dataset.delta))),
    'view-student': (element) => import('./detail.js').then((module) => module.showStudent(element.dataset.id)),
    'edit-student': (element) => import('./detail.js').then((module) => module.editStudentInfo(element.dataset.id)),
  },

  change: {
    'roster-file': (element) => import('./import.js').then((module) => module.loadFile(element.files?.[0])),
    'select-sheet': (element) => import('./import.js').then((module) => module.selectSheet(element.value)),
    'set-header': (element) => import('./import.js').then((module) => module.setHeader(element.value)),
    'map-column': (element) => import('./import.js')
      .then((module) => module.mapColumn(Number(element.dataset.index), element.value)),
    'roster-filter': (element) => import('./index.js').then((module) => module.filterRoster(element.value)),
  },

  input: {
    'roster-search': (element) => import('./index.js').then((module) => module.searchRoster(element.value)),
  },
});
