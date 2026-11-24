// 轻量 XLSX 写出器：用于导出名单、学分表和签到表。
// 只生成必要的 OOXML 部件，不依赖任何第三方库。

const encoder = new TextEncoder();

/** XML 文本转义。 */
function xmlEscape(value) {
  return String(value ?? '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
    })[char]);
}

/** CRC32 查表。 */
const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++) {
    value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
  }
  return value >>> 0;
});

/** 把一组 {路径: 内容} 打包成 ZIP（仅 store，不压缩）。 */
function zipStored(files) {
  const locals = [];
  const central = [];
  let offset = 0;
  let centralSize = 0;

  for (const [path, xml] of Object.entries(files)) {
    const filename = encoder.encode(path);
    const content = encoder.encode(xml);

    let crc = 0xffffffff;
    for (const byte of content) crc = CRC_TABLE[(crc ^ byte) & 255] ^ (crc >>> 8);
    crc = (crc ^ 0xffffffff) >>> 0;

    const localHeader = new Uint8Array(30 + filename.length);
    const centralHeader = new Uint8Array(46 + filename.length);
    const local = new DataView(localHeader.buffer);
    const centralView = new DataView(centralHeader.buffer);

    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, content.length, true);
    local.setUint32(22, content.length, true);
    local.setUint16(26, filename.length, true);
    localHeader.set(filename, 30);

    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, content.length, true);
    centralView.setUint32(24, content.length, true);
    centralView.setUint16(28, filename.length, true);
    centralView.setUint32(42, offset, true);
    centralHeader.set(filename, 46);

    locals.push(localHeader, content);
    central.push(centralHeader);
    centralSize += centralHeader.length;
    offset += localHeader.length + content.length;
  }

  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, central.length, true);
  endView.setUint16(10, central.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);

  return new Blob([...locals, ...central, end], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/** 列序号 -> 列名：A, B, ... Z, AA。 */
export function columnName(index) {
  let result = '';
  for (let i = index + 1; i > 0; i = Math.floor((i - 1) / 26)) {
    result = String.fromCharCode(65 + ((i - 1) % 26)) + result;
  }
  return result;
}

/**
 * 生成工作簿。
 * @param {Array<Array<string|number>>} rows 二维数组，第一行为表头
 * @returns {Blob} XLSX 文件内容
 */
export function workbook(rows) {
  const main = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const rel = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

  const sheet = rows.map((row, index) => (
    `<row r="${index + 1}">${row.map((value, column) => {
      const ref = columnName(column) + (index + 1);
      if (typeof value === 'number' && Number.isFinite(value)) {
        return `<c r="${ref}"><v>${value}</v></c>`;
      }
      return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
    }).join('')}</row>`
  )).join('');

  const columnCount = Math.max(1, ...rows.slice(0, 8).map((row) => row.length));

  return zipStored({
    '[Content_Types].xml': '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    '_rels/.rels': `<Relationships xmlns="${rel}"><Relationship Id="rId1" Type="${rel}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': `<workbook xmlns="${main}" xmlns:r="${rel}"><sheets><sheet name="培训记录" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `<Relationships xmlns="${rel}"><Relationship Id="rId1" Type="${rel}/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    'xl/worksheets/sheet1.xml': `<worksheet xmlns="${main}"><cols>${Array.from({ length: columnCount }, (_, i) => `<col min="${i + 1}" max="${i + 1}" width="${i > 3 ? 25 : 18}" customWidth="1"/>`).join('')}</cols><sheetData>${sheet}</sheetData></worksheet>`,
  });
}

/** 触发浏览器下载。 */
export function download(filename, rows) {
  const anchor = document.createElement('a');
  const url = URL.createObjectURL(workbook(rows));
  anchor.href = url;
  anchor.download = String(filename).replace(/\.(xlsx?|csv)$/i, '') + '.xlsx';
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
