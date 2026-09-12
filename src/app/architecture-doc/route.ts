import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * GET /architecture-doc
 *
 * Serves the 3Boxes HRMS Architecture Document PDF.
 * This route reads the PDF from the public directory and serves it
 * with the correct content-type header.
 */
export async function GET() {
  try {
    const pdfPath = join(process.cwd(), 'public', '3Boxes_HRMS_Architecture_Document.pdf');
    const pdfBuffer = readFileSync(pdfPath);

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="3Boxes_HRMS_Architecture_Document.pdf"',
        'Content-Length': pdfBuffer.length.toString(),
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('[Architecture Doc] Error serving PDF:', error);
    return NextResponse.json({ error: 'PDF not found' }, { status: 404 });
  }
}
