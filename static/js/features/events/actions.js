// 活动管理相关动作。

import { registerActions } from '../../lib/action-registry.js';

registerActions({
  click: {
    'new-event': () => import('./forms.js').then((module) => module.createEvent()),
    'all-events': () => import('./index.js').then((module) => module.openEventList()),
    'event-list': () => import('./index.js').then((module) => module.openEventList()),
    'open-event': (element) => import('./index.js').then((module) => module.openEvent(element.dataset.id)),
    'show-answers': (element) => import('./index.js').then((module) => module.showAnswers(element.dataset.id)),
    'event-filter': (element) => import('./index.js').then((module) => module.setFilter(element.dataset.filter)),
    'event-tab': (element) => import('./index.js').then((module) => module.selectTab(element.dataset.tab)),

    'share': () => import('./share.js').then((module) => module.shareEvent()),
    'copy-link': () => import('./share.js').then((module) => module.copyShareLink()),
    'export-signup': () => import('./share.js').then((module) => module.exportSignup()),
    'sheet': () => import('./share.js').then((module) => module.downloadSheet()),
    'print': () => import('./share.js').then((module) => module.printSheet()),

    'photo-review': () => import('./review.js').then((module) => module.photoReview()),
    'manual-review': () => import('./review.js').then((module) => module.manualReview()),
    'review-photo-manual': () => import('./review.js').then((module) => module.reviewPhoto(false)),
    'review-photo-model': () => import('./review.js').then((module) => module.reviewPhoto(true)),
  },

  change: {
    'question-type': (element) => import('./forms.js').then((module) => module.syncQuestionType(element)),
  },

  submit: {
    'submit-review': (element) => import('./review.js').then((module) => module.submitReviewForm(element)),
  },
});
