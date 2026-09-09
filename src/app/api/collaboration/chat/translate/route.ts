import { NextRequest, NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

/**
 * POST /api/collaboration/chat/translate
 * Body: { messageId, targetLanguage? }
 *
 * REQ-COL-04: AI Translation
 *   If an employee in France types in French, the employee in the US sees it
 *   in English (based on user preferences).
 *
 * Uses ZAI chat completions for translation. Falls back to a simple "no
 * translation available" message if the AI service is unavailable.
 */

// Lightweight ISO 639-1 → name mapping for prompt clarity
const LANG_NAMES: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  hi: 'Hindi',
  ar: 'Arabic',
  zh: 'Chinese',
  ja: 'Japanese',
  pt: 'Portuguese',
  ru: 'Russian',
};

export async function POST(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const body = await request.json();
    const { messageId, targetLanguage = 'en' } = body;
    if (!messageId) return NextResponse.json({ error: 'messageId is required' }, { status: 400 });

    const message = await db.chatMessage.findUnique({
      where: { id: messageId },
      select: { id: true, body: true, originalLanguage: true, translatedBody: true, translatedTo: true },
    });
    if (!message) return NextResponse.json({ error: 'Message not found' }, { status: 404 });

    // If already translated to this language, return cached translation
    if (message.translatedBody && message.translatedTo === targetLanguage) {
      return NextResponse.json({
        original: message.body,
        translated: message.translatedBody,
        from: message.originalLanguage,
        to: targetLanguage,
        cached: true,
      });
    }

    // Use ZAI for translation
    let translated = message.body;
    let detectedLanguage = message.originalLanguage || 'auto';

    try {
      const ZAI = (await import('z-ai-web-dev-sdk')).default;
      const zai = await ZAI.create();
      const targetName = LANG_NAMES[targetLanguage] || targetLanguage;

      const response = await zai.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: `You are a professional translator. Translate the user's message into ${targetName}. Detect the source language. Respond in JSON: {"translated":"<translation>","sourceLanguage":"<iso639-1 code>"}. Preserve tone and meaning. Do not translate code, URLs, or email addresses.`,
          },
          { role: 'user', content: message.body },
        ],
        stream: false,
      });

      const content = response?.choices?.[0]?.message?.content || '';
      // Try to parse JSON from the response
      try {
        const parsed = JSON.parse(content);
        if (parsed.translated) translated = parsed.translated;
        if (parsed.sourceLanguage) detectedLanguage = parsed.sourceLanguage;
      } catch {
        // If not JSON, use the raw content as translation
        if (content.trim()) translated = content.trim();
      }
    } catch (aiError) {
      console.error('AI translation failed, returning original:', aiError);
      // Fail gracefully — return original text
    }

    // Cache the translation
    await db.chatMessage.update({
      where: { id: messageId },
      data: {
        translatedBody: translated,
        translatedTo: targetLanguage,
        originalLanguage: detectedLanguage,
      },
    });

    return NextResponse.json({
      original: message.body,
      translated,
      from: detectedLanguage,
      to: targetLanguage,
      cached: false,
    });
  } catch (error) {
    console.error('POST chat translate error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
