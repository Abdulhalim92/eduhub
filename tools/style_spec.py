"""Оформление .docx спецификации: стили эталонного документа (reference.docx) и доработка собранного файла.
Используется tools/build-spec.py. Палитра совпадает с оформлением прототипа (#1E3A5F, #3C5C73)."""
import copy
from docx import Document
from docx.enum.text import WD_LINE_SPACING
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Pt, RGBColor, Cm

FONT = 'Calibri'
NAVY, STEEL, TEXT = RGBColor(0x1E, 0x3A, 0x5F), RGBColor(0x3C, 0x5C, 0x73), RGBColor(0x1F, 0x29, 0x37)


def _font(style, size=None, bold=None, color=None, name=FONT, italic=None):
    f = style.font
    f.name = name
    rpr = style.element.get_or_add_rPr()
    fonts = rpr.find(qn('w:rFonts'))
    if fonts is None:
        fonts = OxmlElement('w:rFonts'); rpr.append(fonts)
    for a in ('w:ascii', 'w:hAnsi', 'w:cs', 'w:eastAsia'):
        fonts.set(qn(a), name)
    for a in ('w:asciiTheme', 'w:hAnsiTheme', 'w:cstheme', 'w:eastAsiaTheme'):
        if fonts.get(qn(a)) is not None:
            del fonts.attrib[qn(a)]
    if size: f.size = Pt(size)
    if bold is not None: f.bold = bold
    if italic is not None: f.italic = italic
    if color is not None: f.color.rgb = color


def _para(style, before=None, after=None, line=None, keep_next=None, page_break=None):
    p = style.paragraph_format
    if before is not None: p.space_before = Pt(before)
    if after is not None: p.space_after = Pt(after)
    if line is not None: p.line_spacing = line
    if keep_next is not None: p.keep_with_next = keep_next
    if page_break is not None: p.page_break_before = page_break


def style_reference(path):
    d = Document(path)
    st = d.styles
    get = lambda n: st[n] if n in [s.name for s in st] else None
    for name in ('Normal', 'Body Text', 'First Paragraph', 'Compact', 'Block Text'):
        s = get(name)
        if s: _font(s, 10.5, color=TEXT); _para(s, 0, 5, 1.12)
    s = get('Compact')
    if s: _para(s, 0, 2, 1.1)
    s = get('Title');    s and (_font(s, 28, True, NAVY), _para(s, 90, 8))
    s = get('Subtitle'); s and (_font(s, 15, False, STEEL), _para(s, 0, 24))
    for n in ('Author', 'Date'):
        s = get(n); s and (_font(s, 12, False, STEEL), _para(s, 0, 4))
    h = {'Heading 1': (20, NAVY, 0, 12, True), 'Heading 2': (15, NAVY, 20, 6, False), 'Heading 3': (12, STEEL, 14, 4, False)}
    for n, (sz, col, b, a, pb) in h.items():
        s = get(n)
        if s: _font(s, sz, True, col); _para(s, b, a, None, True, pb)
    s = get('TOC Heading'); s and _font(s, 18, True, NAVY)
    # встроенные «символьные» стили pandoc
    for n, sz, col in (('Verbatim Char', 9.5, RGBColor(0x2D, 0x45, 0x59)), ('Hyperlink', None, RGBColor(0x2D, 0x5F, 0x8A))):
        s = get(n)
        if s:
            if n == 'Verbatim Char': _font(s, sz, name='Consolas', color=col)
            else: s.font.color.rgb = col; s.font.underline = False
    for sec in d.sections:
        sec.page_width, sec.page_height = Cm(21), Cm(29.7)
        sec.left_margin = sec.right_margin = Cm(2); sec.top_margin = Cm(2); sec.bottom_margin = Cm(2)
    d.save(path)


def _insert(parent, el, later):
    """Вставляет элемент перед первым из перечисленных (порядок дочерних элементов задан схемой OOXML)."""
    for t in later:
        found = parent.find(qn(t))
        if found is not None:
            found.addprevious(el); return
    parent.append(el)


def _borders(tbl):
    pr = tbl._tbl.tblPr
    old = pr.find(qn('w:tblBorders'))
    if old is not None: pr.remove(old)
    b = OxmlElement('w:tblBorders')
    for side in ('top', 'left', 'bottom', 'right', 'insideH', 'insideV'):
        e = OxmlElement(f'w:{side}')
        e.set(qn('w:val'), 'single'); e.set(qn('w:sz'), '4'); e.set(qn('w:space'), '0'); e.set(qn('w:color'), 'B5C3D0')
        b.append(e)
    _insert(pr, b, ('w:shd', 'w:tblLayout', 'w:tblCellMar', 'w:tblLook', 'w:tblCaption', 'w:tblDescription'))
    mar = OxmlElement('w:tblCellMar')
    for side, w in (('top', 50), ('left', 90), ('bottom', 50), ('right', 90)):
        e = OxmlElement(f'w:{side}'); e.set(qn('w:w'), str(w)); e.set(qn('w:type'), 'dxa'); mar.append(e)
    _insert(pr, mar, ('w:tblLook', 'w:tblCaption', 'w:tblDescription'))


def _shade(cell, fill):
    tcpr = cell._tc.get_or_add_tcPr()
    sh = OxmlElement('w:shd'); sh.set(qn('w:val'), 'clear'); sh.set(qn('w:color'), 'auto'); sh.set(qn('w:fill'), fill)
    _insert(tcpr, sh, ('w:noWrap', 'w:tcMar', 'w:textDirection', 'w:tcFitText', 'w:vAlign', 'w:hideMark'))


def _footer(doc, text):
    for sec in doc.sections:
        p = sec.footer.paragraphs[0] if sec.footer.paragraphs else sec.footer.add_paragraph()
        p.text = ''
        r = p.add_run(text + '  ·  стр. ')
        r.font.size = Pt(8.5); r.font.color.rgb = RGBColor(0x6B, 0x7A, 0x8C)
        run = p.add_run(); run.font.size = Pt(8.5); run.font.color.rgb = RGBColor(0x6B, 0x7A, 0x8C)
        for kind, txt in (('begin', None), (None, ' PAGE '), ('end', None)):
            if kind:
                fc = OxmlElement('w:fldChar'); fc.set(qn('w:fldCharType'), kind); run._r.append(fc)
            else:
                it = OxmlElement('w:instrText'); it.set(qn('xml:space'), 'preserve'); it.text = txt; run._r.append(it)


def postprocess(path):
    d = Document(path)
    for t in d.tables:
        _borders(t)
        for i, row in enumerate(t.rows):
            trpr = row._tr.get_or_add_trPr()
            trpr.append(OxmlElement('w:cantSplit'))              # порядок по схеме: cantSplit, затем tblHeader
            if i == 0:
                h = OxmlElement('w:tblHeader'); h.set(qn('w:val'), 'true'); trpr.append(h)
            for c in row.cells:
                if i == 0: _shade(c, 'DCE8EF')
                for p in c.paragraphs:
                    p.paragraph_format.space_after = Pt(1); p.paragraph_format.space_before = Pt(1)
                    for r in p.runs:
                        r.font.size = Pt(9.5)
                        if i == 0: r.font.bold = True; r.font.color.rgb = NAVY
    # TOC и номера страниц обновляются при открытии файла в Word
    st = d.settings.element
    if st.find(qn('w:updateFields')) is None:
        u = OxmlElement('w:updateFields'); u.set(qn('w:val'), 'true')
        # по схеме updateFields стоит перед hdrShapeDefaults / footnotePr / endnotePr / compat
        anchor = next((e for t in ('w:hdrShapeDefaults', 'w:footnotePr', 'w:endnotePr', 'w:compat', 'w:docVars', 'w:rsids', 'm:mathPr', 'w:themeFontLang', 'w:clrSchemeMapping') for e in st.findall(qn(t))[:1]), None)
        if anchor is not None: anchor.addprevious(u)
        else: st.append(u)
    for sec in d.sections:                                   # у pgMar по схеме обязательны header, footer и gutter
        m = sec._sectPr.find(qn('w:pgMar'))
        for a, v in (('w:header', '709'), ('w:footer', '709'), ('w:gutter', '0')):
            if m is not None and m.get(qn(a)) is None: m.set(qn(a), v)
    _footer(d, 'Линия · Функциональная спецификация · версия 2.0')
    d.core_properties.title = 'Функциональная спецификация платформы «Линия»'
    d.core_properties.author = 'Платформа «Линия»'
    d.save(path)
