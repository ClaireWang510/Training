// 首页与培训班管理相关动作。

import { registerActions } from '../../lib/action-registry.js';

registerActions({
  click: {
    'cohort-menu': () => import('./index.js').then((module) => module.cohortMenu()),
    'create-cohort': () => import('./index.js').then((module) => module.createCohort()),
    'settings': () => import('./index.js').then((module) => module.editCohortSettings()),
    'open-cohort': (element) => import('../../lib/navigation.js')
      .then((module) => module.switchCohort(element.dataset.cohort)),
  },
});
