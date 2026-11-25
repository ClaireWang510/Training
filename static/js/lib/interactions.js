// 交互分发器：把界面上的 data-action 映射到对应功能注册的处理函数。
// 具体动作定义在 features/*/actions.js，新增功能无需改动本文件。

import { resolveAction } from './action-registry.js';

/**
 * 找到最近的 data-action 元素并执行对应动作。
 * 点击与提交默认阻止默认行为；带 href 的链接保留跳转。
 */
async function dispatch(type, event, { preventDefault = false } = {}) {
  const target = event.target instanceof Element ? event.target.closest('[data-action]') : null;
  if (!target) return;

  const handler = resolveAction(type, target.dataset.action);
  if (!handler) return;

  if (preventDefault && !(target.tagName === 'A' && target.getAttribute('href'))) {
    event.preventDefault();
  }
  await handler(target, event);
}

/** 处理一次点击事件。 */
export function handleClick(event) {
  return dispatch('click', event, { preventDefault: true });
}

/** 处理一次 change 事件。 */
export function handleChange(event) {
  return dispatch('change', event);
}

/** 处理一次 input 事件。 */
export function handleInput(event) {
  return dispatch('input', event);
}

/** 处理一次 submit 事件。 */
export function handleSubmit(event) {
  return dispatch('submit', event, { preventDefault: true });
}
