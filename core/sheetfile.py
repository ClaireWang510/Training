from io import BytesIO
from xml.sax.saxutils import escape
from zipfile import ZipFile, ZIP_DEFLATED

def workbook(sheet):
    e = sheet.event
    rows=[[e.cohort.name],[e.title+" · 签到表"],["印次",str(sheet.pk),"正式名单" if sheet.final else "预览名单"],
          ["序号","班级","姓名","学号尾四位","本人签名"]]
    rows += [[i,s["cls"],s["name"],s["id"][-4:],""] for i,s in enumerate(sheet.rows,1)]
    xml=[]
    for i,row in enumerate(rows,1):
        cells="".join(f'<c r="{chr(65+j)}{i}" t="inlineStr"><is><t>{escape(str(value))}</t></is></c>' for j,value in enumerate(row))
        xml.append(f'<row r="{i}">{cells}</row>')
    ns="http://schemas.openxmlformats.org"
    content=BytesIO()
    with ZipFile(content,"w",ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml",f'<Types xmlns="{ns}/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>')
        def rel(name,kind,target):
            z.writestr(name,f'<Relationships xmlns="{ns}/package/2006/relationships"><Relationship Id="rId1" Type="{ns}/officeDocument/2006/relationships/{kind}" Target="{target}"/></Relationships>')
        rel("_rels/.rels","officeDocument","xl/workbook.xml")
        rel("xl/_rels/workbook.xml.rels","worksheet","worksheets/sheet1.xml")
        z.writestr("xl/workbook.xml",f'<workbook xmlns="{ns}/spreadsheetml/2006/main" xmlns:r="{ns}/officeDocument/2006/relationships"><sheets><sheet name="签到表" sheetId="1" r:id="rId1"/></sheets></workbook>')
        z.writestr("xl/worksheets/sheet1.xml",f'<worksheet xmlns="{ns}/spreadsheetml/2006/main"><cols><col min="1" max="5" width="24" customWidth="1"/></cols><sheetData>{"".join(xml)}</sheetData></worksheet>')
    return content.getvalue()
