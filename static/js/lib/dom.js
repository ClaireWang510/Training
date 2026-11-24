// 视图层基础工具：安全 HTML 构造、元素创建与格式化。
// 所有渲染函数统一从这里取能力，避免各页面各写一套字符串拼接。

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** 转义任意值用于 HTML 文本或属性。 */
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ESCAPES[char]);
}

/**
 * 安全 HTML 模板：插值默认按文本转义。
 * 需要插入已构建好的 HTML 片段时，用 raw() 显式包裹。
 */
export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) {
    out += serialize(values[i]) + strings[i + 1];
  }
  return out;
}

function serialize(value) {
  if (value === null || value === undefined || value === false) return '';
  if (value instanceof Raw) return value.value;
  if (Array.isArray(value)) return value.map(serialize).join('');
  return esc(value);
}

/** 标记一段已经安全的 HTML，使其可被 html() 原样插入。 */
export function raw(value) {
  return new Raw(String(value ?? ''));
}

class Raw {
  constructor(value) { this.value = value; }
}

export { Raw };

/** 创建元素。属性值为 null/undefined/false 时跳过该属性。 */
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key === 'html') node.innerHTML = value;
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (value === true) node.setAttribute(key, '');
    else node.setAttribute(key, value);
  }
  for (const child of [].concat(children)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

/** 清空并填充容器。 */
export function fill(container, content) {
  container.replaceChildren();
  if (content === null || content === undefined) return container;
  container.append(content instanceof Node ? content : document.createTextNode(String(content)));
  return container;
}

/** 由 HTML 字符串生成节点（仅用于内部已转义内容）。 */
export function fragment(markup) {
  const template = document.createElement('template');
  template.innerHTML = markup;
  return template.content;
}

/** 统一日期格式：Date -> YYYY-MM-DD。 */
export function isoDate(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

/** 今日 + 偏移天数，格式同 isoDate。 */
export function shiftedDate(days, base = new Date()) {
  const date = new Date(base);
  date.setDate(date.getDate() + days);
  return isoDate(date);
}

/** 数字保留两位并去掉多余小数位。 */
export function fixed(value, digits = 2) {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number)) return '0';
  return String(Number(number.toFixed(digits)));
}

/** 生成唯一 id（用于表单与 label 关联）。 */
export function uid() {
  return globalThis.crypto?.randomUUID?.() ?? `id${Date.now()}${Math.random().toString(16).slice(2)}`;
}

/**
 * 事件委托：在容器上监听，匹配选择器时执行回调。
 * 相比内联 onclick，避免把逻辑写进 HTML 字符串。
 */
export function delegate(root, eventName, selector, handler) {
  root.addEventListener(eventName, (event) => {
    const target = event.target.closest(selector);
    if (target && root.contains(target)) handler(event, target);
  });
}
