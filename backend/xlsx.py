"""Gerador mínimo de planilhas .xlsx usando só a biblioteca padrão (sem instalar nada)."""
import io
import re
import zipfile
from datetime import date
from xml.sax.saxutils import escape

# Estilos (índices em cellXfs, definidos em _ESTILOS abaixo)
NORMAL, CAB, NEG, TOTAL, TITULO, DATA, CENTRO, SUBTITULO, PCT = range(9)

_CTRL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f]")
_ORIGEM_EXCEL = date(1899, 12, 30)


def _nome_aba(nome):
    return re.sub(r"[\[\]:*?/\\]", "-", nome).strip("'")[:31] or "Planilha"


def _coluna(n):
    """1 -> A, 27 -> AA"""
    s = ""
    while n:
        n, r = divmod(n - 1, 26)
        s = chr(65 + r) + s
    return s


class Planilha:
    def __init__(self, nome, larguras=None):
        self.nome = _nome_aba(nome)
        self.larguras = larguras or []
        self.linhas = []          # (celulas, altura)
        self.congelar = None      # (linhas, colunas) fixas
        self.filtro = None        # (linha_cabecalho, ultima_linha)

    def add(self, *celulas, altura=None):
        """Cada célula: valor ou (valor, estilo). Valor: None, texto, número ou date."""
        self.linhas.append((list(celulas), altura))
        return len(self.linhas)

    def _xml(self):
        ncol = max([len(c) for c, _ in self.linhas] + [len(self.larguras), 1])
        out = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
               '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
               '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>',
               f'<dimension ref="A1:{_coluna(ncol)}{max(len(self.linhas), 1)}"/>']
        if self.congelar:
            fl, fc = self.congelar
            topo = f"{_coluna(fc + 1)}{fl + 1}"
            painel = "bottomRight" if fl and fc else ("bottomLeft" if fl else "topRight")
            attrs = (f' xSplit="{fc}"' if fc else "") + (f' ySplit="{fl}"' if fl else "")
            out.append(f'<sheetViews><sheetView workbookViewId="0"><pane{attrs} topLeftCell="{topo}" '
                       f'activePane="{painel}" state="frozen"/></sheetView></sheetViews>')
        else:
            out.append('<sheetViews><sheetView workbookViewId="0"/></sheetViews>')
        out.append('<sheetFormatPr defaultRowHeight="15"/>')
        if self.larguras:
            out.append("<cols>" + "".join(
                f'<col min="{i}" max="{i}" width="{w}" customWidth="1"/>'
                for i, w in enumerate(self.larguras, 1)) + "</cols>")
        out.append("<sheetData>")
        for r, (celulas, altura) in enumerate(self.linhas, 1):
            ht = f' ht="{altura}" customHeight="1"' if altura else ""
            out.append(f'<row r="{r}"{ht}>')
            for c, cel in enumerate(celulas, 1):
                valor, estilo = cel if isinstance(cel, tuple) else (cel, NORMAL)
                if valor is None and estilo == NORMAL:
                    continue
                ref, s = f"{_coluna(c)}{r}", f' s="{estilo}"' if estilo else ""
                if valor is None or valor == "":
                    out.append(f'<c r="{ref}"{s}/>')
                elif isinstance(valor, date):
                    out.append(f'<c r="{ref}"{s}><v>{(valor - _ORIGEM_EXCEL).days}</v></c>')
                elif isinstance(valor, bool) or not isinstance(valor, (int, float)):
                    txt = escape(_CTRL.sub("", str(valor)))
                    out.append(f'<c r="{ref}"{s} t="inlineStr"><is><t xml:space="preserve">{txt}</t></is></c>')
                else:
                    out.append(f'<c r="{ref}"{s}><v>{valor}</v></c>')
            out.append("</row>")
        out.append("</sheetData>")
        if self.filtro and self.filtro[1] > self.filtro[0]:
            out.append(f'<autoFilter ref="A{self.filtro[0]}:{_coluna(ncol)}{self.filtro[1]}"/>')
        out.append('<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>')
        out.append('<pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/>')
        out.append("</worksheet>")
        return "".join(out)


_ESTILOS = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/></numFmts>
<fonts count="5">
<font><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
<font><b/><sz val="14"/><name val="Calibri"/></font>
<font><i/><sz val="10"/><color rgb="FF595959"/><name val="Calibri"/></font>
</fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF305496"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>
<border><left/><right/><top style="thin"><color auto="1"/></top><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="9">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"/>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="center"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center"/></xf>
<xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="10" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>"""


def gerar(planilhas):
    """Recebe uma lista de Planilha e devolve os bytes do arquivo .xlsx."""
    n = len(planilhas)
    tipos = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
             '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
             '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
             '<Default Extension="xml" ContentType="application/xml"/>'
             '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
             '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
             + "".join(f'<Override PartName="/xl/worksheets/sheet{i}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
                       for i in range(1, n + 1)) + "</Types>")
    raiz = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
            '</Relationships>')
    livro = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
             '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
             'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'
             + "".join(f'<sheet name="{escape(p.nome, {chr(34): "&quot;"})}" sheetId="{i}" r:id="rId{i}"/>'
                       for i, p in enumerate(planilhas, 1)) + "</sheets></workbook>")
    rels = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            + "".join(f'<Relationship Id="rId{i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet{i}.xml"/>'
                      for i in range(1, n + 1))
            + f'<Relationship Id="rId{n + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
            '</Relationships>')
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", tipos)
        z.writestr("_rels/.rels", raiz)
        z.writestr("xl/workbook.xml", livro)
        z.writestr("xl/_rels/workbook.xml.rels", rels)
        z.writestr("xl/styles.xml", _ESTILOS)
        for i, p in enumerate(planilhas, 1):
            z.writestr(f"xl/worksheets/sheet{i}.xml", p._xml())
    return buf.getvalue()
