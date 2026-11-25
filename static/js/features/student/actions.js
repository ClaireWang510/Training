// 学员视图相关动作。

import { registerActions } from '../../lib/action-registry.js';

registerActions({
  click: {
    'student-view': (element) => import('./index.js').then((module) => module.switchView(element.dataset.view)),
    'student-event': (element) => import('./index.js').then((module) => module.pickEvent(element.dataset.id)),
    'cancel-signup': () => import('./index.js').then((module) => module.confirmCancel()),
    'cancel-signup-confirm': () => import('./index.js').then((module) => module.cancelSignup()),
  },

  change: {
    'switch-cohort': (element) => import('../../lib/navigation.js')
      .then((module) => module.switchCohort(element.value)),
  },

  submit: {
    'submit-signup': (element) => import('./index.js').then((module) => module.submitSignup(element)),
  },
});
