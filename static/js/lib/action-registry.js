// 事件动作注册表：每个功能模块注册自己的动作，interactions.js 只负责分发。
// 新增功能时只改对应功能目录下的 actions.js，不再改动中心文件。

/** 事件类型 -> 动作名 -> 处理函数。 */
const registry = {
  click: new Map(),
  change: new Map(),
  input: new Map(),
  submit: new Map(),
};

/**
 * 注册一批动作。
 * @param {object} spec 形如 { click: { 'action-name': handler }, change: {...} }
 * 处理函数签名统一为 (element, event)。
 */
export function registerActions(spec) {
  for (const [type, handlers] of Object.entries(spec)) {
    const bucket = registry[type];
    if (!bucket) throw new Error(`未知的事件类型：${type}`);
    for (const [name, handler] of Object.entries(handlers)) {
      if (bucket.has(name)) throw new Error(`动作重复注册：${name}（${type}）`);
      bucket.set(name, handler);
    }
  }
}

/** 查找某个事件类型下的动作处理函数。 */
export function resolveAction(type, name) {
  return registry[type]?.get(name) ?? null;
}

/** 已注册的动作数量，供自检与测试使用。 */
export function actionCount(type) {
  return registry[type]?.size ?? 0;
}
