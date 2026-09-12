import { NextRequest, NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

/**
 * POST /api/ai-emp/document-intelligence
 * Body: { fileId?, documentId?, employeeId?, documentType?, rawText? }
 *
 * REQ-AI-EMP-02: Document Intelligence
 *   When an employee uploads a medical certificate to the File Hub for a
 *   Leave Request, the AI reads it, extracts the diagnosis/dates, and
 *   pre-fills the leave application form.
 *
 * Uses ZAI to extract structured data from raw document text.
 */

const DOC_TYPE_PROMPTS: Record<string, string> = {
  medical_certificate: `Extract the following from this medical certificate:
- patient_name (string)
- diagnosis (string)
- from_date (YYYY-MM-DD)
- to_date (YYYY-MM-DD)
- doctor_name (string)
- clinic_name (string, optional)
- signature_date (YYYY-MM-DD, optional)

Return ONLY valid JSON.`,
  invoice: `Extract the following from this invoice:
- invoice_number
- vendor_name
- invoice_date (YYYY-MM-DD)
- due_date (YYYY-MM-DD)
- total_amount (number)
- currency
- line_items (array of { description, quantity, unit_price, total })

Return ONLY valid JSON.`,
  receipt: `Extract the following from this receipt:
- merchant_name
- receipt_date (YYYY-MM-DD)
- total_amount (number)
- currency
- category (e.g. meals, travel, office supplies)
- payment_method

Return ONLY valid JSON.`,
  id_proof: `Extract the following from this ID proof:
- full_name
- id_type (passport, driver_license, national_id, etc.)
- id_number
- date_of_birth (YYYY-MM-DD)
- expiry_date (YYYY-MM-DD, optional)
- nationality

Return ONLY valid JSON.`,
};

export async function POST(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const body = await request.json();
    const { fileId, documentId, employeeId, documentType = 'medical_certificate', rawText } = body;

    if (!rawText && !fileId && !documentId) {
      return NextResponse.json({ error: 'Either rawText, fileId, or documentId is required' }, { status: 400 });
    }

    let textToProcess = rawText || '';

    // If fileId provided, fetch from DB
    if (!textToProcess && fileId) {
      const file = await db.fileNode.findUnique({ where: { id: fileId } });
      if (!file) return NextResponse.json({ error: 'File not found' }, { status: 404 });
      // In production, we'd OCR the file here. For MVP, expect rawText to be passed.
      textToProcess = `[File: ${file.name}] — OCR text not yet available. Pass rawText in the request body.`;
    }

    let extractedData: Record<string, unknown> | null = null;
    let status = 'processed';
    let confidenceScore: number | undefined;

    try {
      const ZAI = (await import('z-ai-web-dev-sdk')).default;
      const zai = await ZAI.create();
      const prompt = DOC_TYPE_PROMPTS[documentType] || DOC_TYPE_PROMPTS.medical_certificate;

      const response = await zai.chat.completions.create({
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: textToProcess },
        ],
        stream: false,
      });

      const content = response?.choices?.[0]?.message?.content || '';
      try {
        // Strip markdown code fences if present
        const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        extractedData = JSON.parse(jsonStr);
        confidenceScore = 0.85;
      } catch {
        // If not JSON, store raw text
        extractedData = { raw_response: content };
        status = 'needs_review';
        confidenceScore = 0.4;
      }
    } catch (aiError) {
      console.error('AI document intelligence failed:', aiError);
      status = 'failed';
      extractedData = null;
    }

    // Persist the result
    const result = await db.documentIntelligenceResult.create({
      data: {
        fileId: fileId || null,
        documentId: documentId || null,
        employeeId: employeeId || null,
        documentType,
        extractedData: extractedData ? JSON.stringify(extractedData) : null,
        rawOcrText: textToProcess,
        confidenceScore,
        status,
      },
    });

    return NextResponse.json({
      result,
      extractedData,
      confidenceScore,
      status,
      // Client can use extractedData to pre-fill a leave request form
    });
  } catch (error) {
    console.error('POST document intelligence error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
