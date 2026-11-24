// 把网址编码为内联 SVG 二维码。纯前端完成，不依赖外部服务。

import { load } from './qr-encoder.js';

/**
 * 生成二维码 SVG 字符串。
 * @param {string} url 需要编码的网址
 * @returns {string} SVG 标记
 */
export function qrSvg(url) {
  const QRCode = load('index');
  const qr = new QRCode(-1, 1);
  qr.addData(url);
  qr.make();

  const size = qr.getModuleCount();
  let path = '';
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (qr.isDark(y, x)) path += `M${x + 4} ${y + 4}h1v1h-1z`;
    }
  }

  const viewBox = size + 8;
  return `<svg xmlns="http://www.w3.org/2000/svg" class="evQr" role="img" aria-label="活动报名二维码" viewBox="0 0 ${viewBox} ${viewBox}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="white"/><path d="${path}" fill="#1e1a18"/></svg>`;
}
