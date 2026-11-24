// 轻量 XLSX / CSV 读取器：用于导入学员名单。
// 浏览器端完成解压与解析，不上传文件。

const decoder = new TextDecoder();

/** 取所有后代元素。 */
function tags(node, tag) {
  return Array.from(node.getElementsByTagNameNS('*', tag));
}

/** 解析 XML，格式错误时抛出可读提示。 */
function xmlDoc(value) {
  const doc = new DOMParser().parseFromString(value, 'application/xml');
  if (tags(doc, 'parsererror').length) throw new Error('工作簿 XML 格式有误。');
  return doc;
}

/** 列名 -> 列序号：A -> 0, AA -> 26。 */
export function columnIndex(label) {
  return [...label].reduce((num, char) => num * 26 + char.charCodeAt(0) - 64, 0) - 1;
}

/** 读取 ZIP 归档，返回按路径取内容的异步函数。 */
async function unzip(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u16 = (p) => view.getUint16(p, true);
  const u32 = (p) => view.getUint32(p, true);

  let end = bytes.length - 22;
  while (end >= Math.max(0, bytes.length - 65557) && u32(end) !== 0x06054b50) end--;
  if (end < 0 || u32(end) !== 0x06054b50) throw new Error('文件不是标准 XLSX 工作簿。');

  const entries = new Map();
  let pos = u32(end + 16);
  let size = 0;

  for (let i = 0; i < u16(end + 10); i++) {
    if (u32(pos) !== 0x02014b50) throw new Error('文件目录损坏。');
    const path = decoder.decode(bytes.subarray(pos + 46, pos + 46 + u16(pos + 28)));
    size += u32(pos + 24);
    if (size > 60 * 1024 * 1024) throw new Error('请使用解压后小于 60 MB 的名单。');
    entries.set(path, { local: u32(pos + 42), compressed: u32(pos + 20), method: u16(pos + 10) });
    pos += 46 + u16(pos + 28) + u16(pos + 30) + u16(pos + 32);
  }

  return async (path) => {
    const entry = entries.get(path);
    if (!entry) return null;
    const start = entry.local + 30 + u16(entry.local + 26) + u16(entry.local + 28);
    const chunk = bytes.subarray(start, start + entry.compressed);
    if (!entry.method) return decoder.decode(chunk);
    if (entry.method !== 8 || !globalThis.DecompressionStream) {
      throw new Error('请在新版浏览器中导入此 XLSX，或另存为 UTF-8 CSV。');
    }
    const stream = new Blob([chunk]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Response(stream).text();
  };
}

/**
 * 解析 XLSX 工作簿。
 * @param {Uint8Array} bytes 文件内容
 * @returns {Promise<Array<{name: string, rows: Array<{num: number, cells: Array}>}>>}
 */
export async function parseWorkbook(bytes) {
  const read = await unzip(bytes);
  const book = xmlDoc(await read('xl/workbook.xml'));
  const rels = xmlDoc(await read('xl/_rels/workbook.xml.rels'));

  const relations = new Map(tags(rels, 'Relationship').map((rel) => [
    rel.getAttribute('Id'),
    new URL(rel.getAttribute('Target'), 'https://local/xl/workbook.xml').pathname.slice(1),
  ]));

  const shared = await read('xl/sharedStrings.xml');
  const strings = shared
    ? tags(xmlDoc(shared), 'si').map((node) => tags(node, 't').map((t) => t.textContent).join(''))
    : [];

  const style = await read('xl/styles.xml');
  const styleDoc = style ? xmlDoc(style) : null;
  const numberFormats = styleDoc
    ? new Map(tags(styleDoc, 'numFmt').map((x) => [x.getAttribute('numFmtId'), x.getAttribute('formatCode')]))
    : new Map();
  const cellXfs = styleDoc ? tags(styleDoc, 'cellXfs')[0] : null;
  const formats = cellXfs ? tags(cellXfs, 'xf').map((x) => numberFormats.get(x.getAttribute('numFmtId'))) : [];

  const result = [];

  for (const sheet of tags(book, 'sheet')) {
    const target = relations.get(
      sheet.getAttribute('r:id')
      ?? sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id'),
    );
    if (!target) continue;

    const sheetData = await read(target);
    if (!sheetData) continue;

    const rows = [];
    for (const row of tags(xmlDoc(sheetData), 'row')) {
      const cells = [];
      for (const cell of tags(row, 'c')) {
        const column = columnIndex((cell.getAttribute('r') || 'A1').match(/^[A-Z]+/)[0]);
        const type = cell.getAttribute('t');
        let value = tags(cell, 'v')[0]?.textContent || '';

        if (type === 's') value = strings[Number(value)] ?? '';
        if (type === 'inlineStr') value = tags(cell, 't').map((el) => el.textContent).join('');

        const format = formats[Number(cell.getAttribute('s') || 0)];
        if ((!type || type === 'n') && /^0+$/.test(format || '') && /^\d+$/.test(value)) {
          value = value.padStart(format.length, '0');
        }
        cells[column] = value;
      }
      if (cells.some((v) => String(v || '').trim())) {
        rows.push({ num: Number(row.getAttribute('r')) || rows.length + 1, cells });
      }
    }
    result.push({ name: sheet.getAttribute('name'), rows });
  }

  if (!result.length) throw new Error('没有可导入的工作表。');
  return result;
}

/**
 * 解析 CSV / TSV 文本。
 * @param {string} text 文件文本
 */
export function parseCsv(text) {
  const rows = [];
  const delimiter = text.split(/\r?\n/)[0].includes('\t') ? '\t' : ',';

  let row = [];
  let value = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { value += '"'; i++; } else quoted = !quoted;
    } else if (!quoted && char === delimiter) {
      row.push(value); value = '';
    } else if (!quoted && (char === '\n' || char === '\r')) {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(value); rows.push(row); row = []; value = '';
    } else {
      value += char;
    }
  }

  if (quoted) throw new Error('CSV 中存在未闭合的引号。');
  if (value || row.length) { row.push(value); rows.push(row); }

  return [{
    name: '名单',
    rows: rows
      .map((cells, index) => ({ num: index + 1, cells }))
      .filter((item) => item.cells.some((cell) => cell.trim())),
  }];
}
