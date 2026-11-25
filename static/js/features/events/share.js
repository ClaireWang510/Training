// 活动管理：报名入口分享、名单导出与签到表下载/打印。

import { esc, html, raw } from '../../lib/dom.js';
import { openModal, toast } from '../../lib/ui.js';
import { store } from '../../lib/store.js';
import { qrSvg } from '../../lib/qr.js';
import { currentEvent, enrolledStudents } from './index.js';

/** 导出报名名单。 */
export function exportSignup() {
  const event = currentEvent();
  if (!event) return;
  const people = enrolledStudents(event);
  const questions = event.questions ?? [];

  const header = ['姓名', '学号', '院系', '班级', ...questions.map((question) => question.label)];
  const rows = people.map((student) => [
    student.name,
    student.id,
    student.dept,
    student.cls,
    ...questions.map((question, index) => [event.regs?.[student.id]?.[index]].flat().filter(Boolean).join('、')),
  ]);

  import('../../lib/xlsx-write.js').then((module) => module.download(`${event.title}报名名单`, [header, ...rows]));
}

/** 打开分享报名入口弹窗。 */
export function shareEvent() {
  const event = currentEvent();
  if (!event) return;

  const url = new URL(location.href);
  url.hash = `join=${encodeURIComponent(event.id)}`;

  let qr = '';
  if (url.protocol !== 'file:') {
    try { qr = qrSvg(url.href); } catch { qr = ''; }
  }

  openModal('分享报名入口', html`
    ${raw(qr)}
    <label class="evField">活动链接<input id="evShareURL" readonly value="${url.href}"></label>
    <p class="evNote">${url.protocol === 'file:' ? '离线文件链接仅可在当前设备打开。' : '学员在校园网络中打开链接，登录后即可报名。'}</p>
    <div class="evActions">
      <button class="btn" data-action="copy-link">复制链接</button>
      <a target="_blank" rel="noopener" class="btn primary" href="${url.hash}" data-action="close-modal">打开学员报名页</a>
    </div>
  `);
}

/** 复制报名链接到剪贴板。 */
export async function copyShareLink() {
  const input = document.getElementById('evShareURL');
  if (!input) return;
  try {
    await navigator.clipboard.writeText(input.value);
    toast('报名链接已复制');
  } catch {
    input.select();
    if (document.execCommand('copy')) toast('报名链接已复制');
    else toast('请复制已选中的链接');
  }
}

/** 取当前活动的签到名单快照。 */
async function fetchSheet() {
  const event = currentEvent();
  const { command } = await import('../../lib/api.js');
  return command('sheet', { cohort: store.db.key, event: event.id });
}

/** 下载签到表 Excel。 */
export async function downloadSheet() {
  let sheet;
  try {
    sheet = await fetchSheet();
  } catch (error) {
    toast(error.message);
    return;
  }
  if (!sheet.rows.length) {
    toast('暂无报名学员，请先完成报名');
    return;
  }
  const anchor = document.createElement('a');
  anchor.href = `sheets/${encodeURIComponent(sheet.key)}`;
  anchor.click();
}

/** 打开打印签到表预览。 */
export async function printSheet() {
  let sheet;
  try {
    sheet = await fetchSheet();
  } catch (error) {
    toast(error.message);
    return;
  }
  if (!sheet.rows.length) {
    toast('暂无报名学员，请先完成报名');
    return;
  }

  const event = currentEvent();
  const total = Math.ceil(sheet.rows.length / 15);
  const version = new Date().toLocaleString('zh-CN', { hour12: false });

  let markup = '';
  for (let page = 0; page < total; page++) {
    const names = sheet.rows.slice(page * 15, page * 15 + 15);
    markup += '<section>'
      + `<small>${esc(store.db.name)}</small>`
      + `<h1>${esc(event.title)} · 签到表</h1>`
      + `<p>${esc(event.date)} ${esc(event.time || '')}　${esc(event.place || '')}　${esc(event.type)} · ${Number(event.points)} 学分</p>`
      + '<table><thead><tr><th>序号</th><th>班级</th><th>姓名</th><th>学号尾四位</th><th style="width:35%">本人签名</th></tr></thead><tbody>'
      + names.map((student, index) => `<tr><td>${page * 15 + index + 1}</td><td>${esc(student.cls)}</td>`
        + `<td>${esc(student.name)}</td><td>${esc(student.id.slice(-4))}</td><td></td></tr>`).join('')
      + '</tbody></table>'
      + `<footer>印次 ${esc(sheet.key)}　·　${sheet.final ? '正式名单' : '报名中预览'}　·　活动编号 ${esc(event.id)}　·　生成于 ${esc(version)}　·　第 ${page + 1} / ${total} 页</footer>`
      + '</section>';
  }

  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;left:-10000px;width:210mm;height:297mm;border:0';
  frame.title = '签到表打印预览';
  document.body.append(frame);

  const doc = frame.contentDocument;
  doc.open();
  doc.write('<!doctype html><html lang="zh-CN"><meta charset="UTF-8"><title>' + esc(event.title) + '签到表</title>'
    + '<style>@page{size:A4;margin:15mm}body{font:12pt "Songti SC",serif;color:#111;margin:0}section{break-after:page}section:last-child{break-after:auto}'
    + 'h1{font-size:20pt;margin:8mm 0 3mm}p,footer{font-size:10pt}table{width:100%;border-collapse:collapse}td,th{border:1px solid #555;text-align:center;padding:2mm}td{height:9mm}footer{margin-top:5mm}</style>'
    + markup + '</html>');
  doc.close();

  window.setTimeout(() => {
    const win = frame.contentWindow;
    win.addEventListener('afterprint', () => frame.remove(), { once: true });
    win.focus();
    win.print();
  }, 180);
}
