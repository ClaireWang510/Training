// 界面外壳组件：对话框、提示条、图标。
// 原先依赖全局 id 隐式查找元素，这里改为显式绑定。

/** 对话框元素，在 boot() 中初始化。 */
let dialog = null;
let dialogTitle = null;
let dialogBody = null;
let toastBox = null;
let toastTimer = null;

/** 初始化界面外壳，绑定模板中的固定元素。 */
export function boot() {
  dialog = document.getElementById('dlg');
  dialogTitle = document.getElementById('dialogTitle');
  dialogBody = document.getElementById('dialogBody');
  toastBox = document.getElementById('toastbox');
}

/** 打开对话框。content 可以是 HTML 字符串或节点。 */
export function openModal(title, content) {
  if (!dialog) return;
  dialogTitle.textContent = title;
  dialogBody.replaceChildren();
  if (content instanceof Node) dialogBody.append(content);
  else dialogBody.innerHTML = content ?? '';
  if (!dialog.open) dialog.showModal();
}

/** 关闭对话框。 */
export function closeModal() {
  if (dialog?.open) dialog.close();
}

/** 当前对话框是否处于打开状态。 */
export function isModalOpen() {
  return Boolean(dialog?.open);
}

/** 弹出提示条。 */
export function toast(message) {
  if (!toastBox) return;
  toastBox.textContent = message;
  toastBox.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastBox.hidden = true; }, 2800);
}

/** 显示对话框内的错误信息。 */
export function setDialogError(message) {
  const target = dialogBody?.querySelector('[role="alert"]');
  if (target) target.textContent = message;
}

/** 内联图标。 */
const ICON_PATHS = {
  user: 'M15 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0 M5 21v-2a7 7 0 0 1 14 0v2',
  book: 'M3 4h6l3 2 3-2h6v15h-6l-3 2-3-2H3z M12 6v15',
  table: 'M3 4h18v16H3z M3 10h18 M9 4v16',
  upload: 'M12 16V3m-5 5 5-5 5 5 M4 15v5h16v-5',
  cal: 'M3 6h18v15H3z M7 3v6m10-6v6 M3 11h18',
  plus: 'M12 4v16 M4 12h16',
};

/** 生成图标 SVG 字符串。 */
export function icon(name) {
  const path = ICON_PATHS[name];
  if (!path) return '';
  return `<svg aria-hidden="true" class="ico" viewBox="0 0 24 24"><path d="${path}"/></svg>`;
}

/** 页头装饰插画。 */
export function bookArt() {
  let paths = '';
  for (let i = 0; i < 38; i++) {
    const x = i * 4;
    paths += `<path d="M${5 + x} 259 Q ${158 + x} 214 ${201 + x} 132 T ${399 + x} 5 M${120 + x} 264 Q ${232 + x} 160 ${340 + x} 154 T ${590 + x} 60"/>`;
  }
  return `<svg aria-hidden="true" class="mastArt" viewBox="0 0 650 265" preserveAspectRatio="xMidYMid slice"><g fill="none" stroke="#d49789" opacity=".45" stroke-width="1">${paths}</g></svg>`;
}
