"""Shared utilities for NEXUS HRMS documentation generation"""
import os, hashlib, subprocess
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.lib import colors
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
                                 PageBreak, KeepTogether, CondPageBreak)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily
from pypdf import PdfReader, PdfWriter, Transformation

# ━━ Palette ━━
ACCENT       = colors.HexColor('#b54925')
TEXT_PRIMARY  = colors.HexColor('#242321')
TEXT_MUTED    = colors.HexColor('#8a877e')
BG_SURFACE   = colors.HexColor('#e5e3df')
BG_PAGE      = colors.HexColor('#f3f3f1')

# ━━ Fonts ━━
def register_fonts():
    pdfmetrics.registerFont(TTFont('DejaVuSans', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'))
    pdfmetrics.registerFont(TTFont('DejaVuSansBold', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'))
    pdfmetrics.registerFont(TTFont('DejaVuSerif', '/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf'))
    pdfmetrics.registerFont(TTFont('DejaVuSerifBold', '/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf'))
    pdfmetrics.registerFont(TTFont('DejaVuMono', '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'))
    pdfmetrics.registerFont(TTFont('LibSans', '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf'))
    registerFontFamily('DejaVuSans', normal='DejaVuSans', bold='DejaVuSansBold')
    registerFontFamily('DejaVuSerif', normal='DejaVuSerif', bold='DejaVuSerifBold')

W, H = A4
LM = RM = 1.0*inch
TM = BM = 0.8*inch
AW = W - LM - RM

def make_styles():
    s = {}
    s['H1'] = ParagraphStyle('H1', fontName='DejaVuSansBold', fontSize=20, leading=26, textColor=ACCENT, spaceBefore=18, spaceAfter=10)
    s['H2'] = ParagraphStyle('H2', fontName='DejaVuSansBold', fontSize=15, leading=20, textColor=TEXT_PRIMARY, spaceBefore=14, spaceAfter=8)
    s['H3'] = ParagraphStyle('H3', fontName='DejaVuSansBold', fontSize=12, leading=16, textColor=TEXT_PRIMARY, spaceBefore=10, spaceAfter=6)
    s['Body'] = ParagraphStyle('Body', fontName='DejaVuSerif', fontSize=10.5, leading=17, textColor=TEXT_PRIMARY, alignment=TA_JUSTIFY, spaceAfter=6)
    s['Bullet'] = ParagraphStyle('Bullet', fontName='DejaVuSerif', fontSize=10.5, leading=17, textColor=TEXT_PRIMARY, leftIndent=20, bulletIndent=8, spaceAfter=3)
    s['Muted'] = ParagraphStyle('Muted', fontName='DejaVuSans', fontSize=9, leading=14, textColor=TEXT_MUTED, alignment=TA_CENTER)
    s['TH'] = ParagraphStyle('TH', fontName='DejaVuSansBold', fontSize=10, leading=14, textColor=colors.white, alignment=TA_CENTER)
    s['TC'] = ParagraphStyle('TC', fontName='DejaVuSans', fontSize=9.5, leading=14, textColor=TEXT_PRIMARY, alignment=TA_LEFT)
    s['TCC'] = ParagraphStyle('TCC', fontName='DejaVuSans', fontSize=9.5, leading=14, textColor=TEXT_PRIMARY, alignment=TA_CENTER)
    return s

class TocDocTemplate(SimpleDocTemplate):
    def afterFlowable(self, flowable):
        if hasattr(flowable, 'bookmark_name'):
            level = getattr(flowable, 'bookmark_level', 0)
            text = getattr(flowable, 'bookmark_text', '')
            key = getattr(flowable, 'bookmark_key', '')
            self.notify('TOCEntry', (level, text, self.page, key))

def heading(text, style_key, styles, level=0):
    key = 'h_%s' % hashlib.md5(text.encode()).hexdigest()[:8]
    p = Paragraph('<a name="%s"/>%s' % (key, text), styles[style_key])
    p.bookmark_name = text; p.bookmark_level = level
    p.bookmark_text = text; p.bookmark_key = key
    return p

def body(text, styles):
    return Paragraph(text, styles['Body'])

def bullet(text, styles):
    return Paragraph('<bullet>&bull;</bullet> ' + text, styles['Bullet'])

def make_table(headers, rows, styles, col_widths=None):
    if not col_widths:
        col_widths = [AW / len(headers)] * len(headers)
    else:
        total = sum(col_widths)
        if total < AW * 0.85:
            scale = (AW * 0.92) / total
            col_widths = [w * scale for w in col_widths]
    data = [[Paragraph('<b>%s</b>' % h, styles['TH']) for h in headers]]
    for row in rows:
        data.append([Paragraph(str(c), styles['TC']) if i == 0 else Paragraph(str(c), styles['TCC'])
                     for i, c in enumerate(row)])
    t = Table(data, colWidths=col_widths, hAlign='CENTER')
    style_cmds = [
        ('BACKGROUND', (0,0), (-1,0), ACCENT),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('GRID', (0,0), (-1,-1), 0.5, TEXT_MUTED),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]
    for i in range(1, len(data)):
        bg = colors.white if i % 2 == 1 else BG_SURFACE
        style_cmds.append(('BACKGROUND', (0,i), (-1,i), bg))
    t.setStyle(TableStyle(style_cmds))
    return t

def generate_cover(title, subtitle, filename):
    html = f"""<!DOCTYPE html>
<html><head><link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;800&display=swap" rel="stylesheet">
<style>
@page {{ size: 794px 1123px; margin: 0; }}
* {{ margin: 0; padding: 0; box-sizing: border-box; }}
body {{ width: 794px; height: 1123px; font-family: 'Inter', sans-serif; background: #fafafa; overflow: hidden; }}
.cover {{ position: relative; width: 100%; height: 100%; padding: 80px 70px; }}
.accent-line {{ position: absolute; left: 70px; top: 80px; width: 4px; height: 280px; background: #b54925; border-radius: 2px; }}
.kicker {{ position: absolute; left: 90px; top: 85px; font-size: 11px; font-weight: 600; letter-spacing: 3px; text-transform: uppercase; color: #b54925; opacity: 0.8; }}
.title {{ position: absolute; left: 90px; top: 120px; font-size: 42px; font-weight: 800; color: #242321; line-height: 1.2; max-width: 600px; }}
.subtitle {{ position: absolute; left: 90px; top: 280px; font-size: 17px; font-weight: 400; color: #8a877e; max-width: 500px; line-height: 1.6; }}
.meta {{ position: absolute; left: 70px; bottom: 80px; font-size: 13px; color: #8a877e; }}
.meta-line {{ margin-bottom: 6px; }}
.bottom-line {{ position: absolute; left: 70px; bottom: 140px; width: 200px; height: 2px; background: #b54925; opacity: 0.3; }}
</style></head><body>
<div class="cover">
  <div class="accent-line"></div>
  <div class="kicker">NEXUS HRMS PLATFORM</div>
  <div class="title">{title}</div>
  <div class="subtitle">{subtitle}</div>
  <div class="bottom-line"></div>
  <div class="meta">
    <div class="meta-line">Version 1.0</div>
    <div class="meta-line">SaaS-Based AI HRMS Platform</div>
    <div class="meta-line">June 2026</div>
  </div>
</div>
</body></html>"""
    base = f'/home/z/my-project/download/nexus-docs/{filename}'
    html_path = base + '.html'
    pdf_path = base + '.pdf'
    with open(html_path, 'w') as f:
        f.write(html)
    scripts_dir = '/home/z/my-project/skills/pdf/scripts'
    subprocess.run(['node', os.path.join(scripts_dir, 'html2poster.js'), html_path, '--output', pdf_path, '--width', '794px'], check=True, capture_output=True)
    return pdf_path

def merge_cover_body(cover_pdf, body_pdf, output_pdf, title='NEXUS HRMS'):
    A4_W, A4_H = 595.28, 841.89
    def normalize_page(page):
        box = page.mediabox
        w, h = float(box.width), float(box.height)
        if abs(w - A4_W) > 2 or abs(h - A4_H) > 2:
            sx, sy = A4_W / w, A4_H / h
            page.add_transformation(Transformation().scale(sx=sx, sy=sy))
            page.mediabox.lower_left = (0, 0)
            page.mediabox.upper_right = (A4_W, A4_H)
        return page
    writer = PdfWriter()
    cover_page = PdfReader(cover_pdf).pages[0]
    writer.add_page(normalize_page(cover_page))
    for page in PdfReader(body_pdf).pages:
        writer.add_page(normalize_page(page))
    writer.add_metadata({'/Title': title, '/Author': 'Z.ai', '/Creator': 'Z.ai'})
    with open(output_pdf, 'wb') as f:
        writer.write(f)
    return os.path.getsize(output_pdf)
