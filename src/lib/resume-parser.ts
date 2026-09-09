/**
 * Real Resume Parser — WAVE2-C (REQ-ATS-01)
 *
 * Pipeline:
 *   1. extractTextFromPdf / extractTextFromDocx / raw text → string
 *   2. detectLanguage(text) — ISO 639-1 (en, hi, fr, de, ...)
 *   3. extractStructuredFields(text, language) — calls ZAI for JSON extraction
 *
 * The structured shape (ParsedResume) is stored as JSON in ResumeParse.parsedData.
 */
import { franc } from 'franc';

/* ─────────────────────────────────────────────────────────────────────────── */
/* Types                                                                        */
/* ─────────────────────────────────────────────────────────────────────────── */

export interface ParsedResumeEducation {
  institution: string;
  degree: string;
  year?: string;
}

export interface ParsedResumeExperience {
  company: string;
  role: string;
  duration: string;
  description?: string;
}

export interface ParsedResume {
  name: string;
  email: string;
  phone: string;
  location?: string;
  summary?: string;
  skills: string[];
  education: ParsedResumeEducation[];
  experience: ParsedResumeExperience[];
  certifications: string[];
  languages: string[];
}

export type ResumeSourceFormat = 'pdf' | 'docx' | 'doc' | 'text' | 'unknown';

export interface ExtractedResume {
  text: string;
  sourceFormat: ResumeSourceFormat;
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* ISO 639-3 (franc) → ISO 639-1 mapping for the most common resume languages  */
/* ─────────────────────────────────────────────────────────────────────────── */

const ISO3_TO_ISO1: Record<string, string> = {
  eng: 'en', hin: 'hi', ben: 'bn', pan: 'pa', guj: 'gu', tam: 'ta',
  tel: 'te', kan: 'kn', mal: 'ml', mar: 'mr', urd: 'ur', ori: 'or',
  asm: 'as', sin: 'si', nep: 'ne', san: 'sa',
  fra: 'fr', deu: 'de', ita: 'it', spa: 'es', por: 'pt', nld: 'nl',
  rus: 'ru', pol: 'pl', tur: 'tr', ara: 'ar', heb: 'he', fas: 'fa',
  jpn: 'ja', kor: 'ko', cmn: 'zh', yue: 'zh', wuu: 'zh',
  vie: 'vi', tha: 'th', ind: 'id', msa: 'ms', tgl: 'fil', ceb: 'ceb',
  ukr: 'uk', ron: 'ro', hun: 'hu', ces: 'cs', slk: 'sk', slv: 'sl',
  hrv: 'hr', srp: 'sr', bul: 'bg', ell: 'el', swe: 'sv', nno: 'no',
  nob: 'no', dan: 'da', fin: 'fi', cat: 'ca', eus: 'eu', glg: 'gl',
  afr: 'af', swa: 'sw', amh: 'am', yor: 'yo', zul: 'zu', xho: 'xh',
  hau: 'ha', som: 'so', orm: 'om',
};

/**
 * Detect the language of an arbitrary chunk of text.
 * Returns an ISO 639-1 code (e.g. 'en', 'hi', 'fr'); falls back to 'en'.
 */
export function detectLanguage(text: string): string {
  if (!text || text.trim().length < 10) return 'en';
  try {
    // franc needs a minimum length; default minLength is 10.
    const iso3 = franc(text, { minLength: 10 });
    if (!iso3 || iso3 === 'und') return 'en';
    return ISO3_TO_ISO1[iso3] || 'en';
  } catch {
    return 'en';
  }
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Text extractors                                                              */
/* ─────────────────────────────────────────────────────────────────────────── */

/**
 * Extract text from a PDF buffer using `unpdf` — a serverless-friendly
 * wrapper around pdfjs-dist's legacy build that works in pure Node (no
 * DOMMatrix, no Canvas, no DOM required).
 *
 * Previously this used `pdf-parse` v2.4.5, but its CJS bundle internally
 * references `DOMMatrix` (a browser-only API) at module-eval time, which
 * threw `ReferenceError: DOMMatrix is not defined` on Node/Vercel and got
 * persisted to ResumeParse.parseError — surfacing as "⚠ Parse error:
 * DOMMatrix is not defined" in the candidate dashboard.
 *
 * `unpdf` is designed for exactly this case (Cloudflare Workers / Node /
 * Vercel Edge) and ships pure-JS implementations of the bits pdfjs needs.
 */
export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const { extractText, getDocumentProxy } = await import('unpdf');

  // unpdf expects a Uint8Array; Buffer is a subclass but we pass an explicit
  // view to avoid any prototype-edge cases.
  const bytes = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const pdf = await getDocumentProxy(bytes, {
    // Suppress console noise from pdfjs on malformed PDFs
    verbosity: 0,
  });

  try {
    const { text } = await extractText(pdf, { mergePages: true });
    return (text || '').trim();
  } finally {
    // Best-effort cleanup of pdfjs document resources
    try {
      await pdf.destroy();
    } catch { /* ignore */ }
  }
}

/**
 * Extract text from a DOCX buffer using mammoth's raw-text extractor.
 * For legacy .doc (binary) files, mammoth does not support them — the caller
 * should fall back to the text path or treat it as `unknown` source.
 */
export async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ buffer });
  return (result?.value || '').trim();
}

/**
 * Heuristically recover text from a plain-text buffer (could be UTF-8 text,
 * HTML, or some other human-readable format). Strips HTML tags.
 */
export function extractTextFromPlain(buffer: Buffer): string {
  let text = buffer.toString('utf-8');
  // crude HTML strip if it looks like HTML
  if (/<[a-z!][^>]*>/i.test(text)) {
    text = text
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }
  return text.replace(/\s+\n/g, '\n').replace(/[ \t]{2,}/g, ' ').trim();
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* ZAI structured extraction                                                    */
/* ─────────────────────────────────────────────────────────────────────────── */

function buildExtractionPrompt(resumeText: string, language: string): string {
  return `You are a resume parsing engine. Extract structured fields from the following resume text.
The resume is written in language: ${language}.
Return ONLY a valid JSON object with this exact shape — no markdown, no commentary:
{
  "name": "full name",
  "email": "email or empty string",
  "phone": "phone or empty string",
  "location": "city, country or empty string",
  "summary": "1-2 sentence professional summary",
  "skills": ["skill1", "skill2", ...],
  "education": [{"institution": "...", "degree": "...", "year": "YYYY"}],
  "experience": [{"company": "...", "role": "...", "duration": "MMM YYYY - MMM YYYY", "description": "..."}],
  "certifications": ["..."],
  "languages": ["en", "hi", ...]
}

Resume text:
---
${resumeText.slice(0, 12000)}
---`;
}

/**
 * Best-effort local fallback: pulls email, phone, and a few bullets out of the
 * raw text using regex when ZAI is unavailable. Always returns a usable object.
 *
 * Also extracts skills from a "SKILLS" section heading (very common resume
 * convention) — this keeps the candidate dashboard useful even when the LLM
 * extraction is unavailable on serverless.
 */
function localFallbackExtraction(text: string, language: string): ParsedResume {
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const phoneMatch = text.match(/(\+?\d[\d\s().-]{7,}\d)/);
  const nameGuess = (text.split('\n').find(l => l.trim().length > 2 && l.trim().length < 60 && /^[A-Za-z][A-Za-z\s.'-]+$/.test(l.trim())) || '').trim();

  // Location extraction — look for "Location: <city>, <country>" or
  // "City, ST" patterns. Falls back to ''.
  let location = '';
  const locMatch = text.match(/\bLocation\s*:\s*([^\n]+)/i);
  if (locMatch) {
    location = locMatch[1].trim().slice(0, 80);
  } else {
    // Common "City, Country" or "City, ST 12345" patterns
    const cityMatch = text.match(/\b([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?,\s*(?:[A-Z]{2}|[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?))\b/);
    if (cityMatch) location = cityMatch[1];
  }

  // Skill extraction — look for a "SKILLS" / "TECHNICAL SKILLS" / "CORE SKILLS"
  // section heading and grab the text until the next ALL-CAPS section heading
  // or blank-line break. Then split on commas / bullets / pipes.
  const skills: string[] = [];
  const skillsSectionMatch = text.match(
    /\b(?:TECHNICAL\s+SKILLS|CORE\s+SKILLS|KEY\s+SKILLS|SKILLS(?:\s*&\s*EXPERTISE)?)\s*\n([^\n]*(?:\n(?!^[A-Z][A-Z\s&]{2,30}\n)[^\n]*)*)/im,
  );
  if (skillsSectionMatch) {
    const sectionText = skillsSectionMatch[1];
    const tokens = sectionText
      .split(/[,•·|\n\t]+/)
      .map(t => t.trim())
      .filter(t => t.length >= 2 && t.length < 40 && !/^[A-Z][A-Z\s&]{2,30}$/.test(t));
    // Dedupe + cap at 20
    for (const t of tokens) {
      const lower = t.toLowerCase();
      if (!skills.find(s => s.toLowerCase() === lower)) skills.push(t);
      if (skills.length >= 20) break;
    }
  }

  // If no SKILLS section was found, try a weaker heuristic: scan for known
  // technology keywords anywhere in the text. This catches resumes that
  // don't use a formal "SKILLS" heading but still list technologies inline.
  if (skills.length === 0) {
    const KNOWN_TECH = [
      'JavaScript', 'TypeScript', 'React', 'Angular', 'Vue', 'Node.js', 'Express',
      'Next.js', 'Python', 'Django', 'Flask', 'Java', 'Spring', 'Kotlin', 'Swift',
      'Go', 'Rust', 'C\\+\\+', 'C#', '.NET', 'PHP', 'Laravel', 'Ruby', 'Rails',
      'SQL', 'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Oracle', 'SQL Server',
      'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'Terraform', 'Jenkins',
      'Git', 'GraphQL', 'REST', 'gRPC', 'Kafka', 'RabbitMQ', 'Elasticsearch',
      'HTML', 'CSS', 'Tailwind', 'Bootstrap', 'SASS', 'Redux', 'Vuex',
      'Jest', 'Cypress', 'Playwright', 'Selenium', 'Tableau', 'Power BI',
      'Excel', 'PowerPoint', 'Jira', 'Confluence', 'Agile', 'Scrum', 'DevOps',
      'CI/CD', 'Linux', 'Bash', 'PowerShell', 'Machine Learning', 'TensorFlow',
      'PyTorch', 'Pandas', 'NumPy', 'Spark', 'Hadoop', 'Airflow',
    ];
    const lowerText = text.toLowerCase();
    for (const tech of KNOWN_TECH) {
      const re = new RegExp(`\\b${tech}\\b`, 'i');
      if (re.test(text)) {
        // Push the canonical form (without regex escapes) — strip the
        // backslashes used for regex escaping.
        skills.push(tech.replace(/\\/g, ''));
        if (skills.length >= 20) break;
      }
    }
    // Avoid the unused-variable warning if we didn't enter the loop
    void lowerText;
  }

  return {
    name: nameGuess || 'Unknown Candidate',
    email: emailMatch ? emailMatch[0] : '',
    phone: phoneMatch ? phoneMatch[0].trim() : '',
    location,
    summary: text.slice(0, 240).replace(/\s+/g, ' ').trim(),
    skills,
    education: [],
    experience: [],
    certifications: [],
    languages: [language],
  };
}

/**
 * Ensure a partial object from the LLM conforms to the ParsedResume schema.
 * All array fields default to [] and required strings to ''.
 */
function normalizeParsedResume(raw: Partial<ParsedResume> | null | undefined, fallback: ParsedResume): ParsedResume {
  if (!raw || typeof raw !== 'object') return fallback;
  const asArr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
  const asStr = (v: unknown, def = ''): string => (typeof v === 'string' ? v : def);

  return {
    name: asStr(raw.name, fallback.name),
    email: asStr(raw.email, fallback.email),
    phone: asStr(raw.phone, fallback.phone),
    location: asStr(raw.location, fallback.location),
    summary: asStr(raw.summary, fallback.summary),
    skills: asArr<string>(raw.skills).map(s => asStr(s)),
    education: asArr<ParsedResumeEducation>(raw.education).map(e => ({
      institution: asStr(e?.institution),
      degree: asStr(e?.degree),
      year: e?.year ? asStr(e.year) : undefined,
    })),
    experience: asArr<ParsedResumeExperience>(raw.experience).map(x => ({
      company: asStr(x?.company),
      role: asStr(x?.role),
      duration: asStr(x?.duration),
      description: x?.description ? asStr(x.description) : undefined,
    })),
    certifications: asArr<string>(raw.certifications).map(s => asStr(s)),
    languages: asArr<string>(raw.languages).map(s => asStr(s)),
  };
}

function tryParseJson(content: string): Partial<ParsedResume> | null {
  if (!content) return null;
  // Strip ```json fences if the model wrapped the output.
  let cleaned = content.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) cleaned = fenceMatch[1].trim();
  // Find the first { and last } to slice out the JSON object.
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) return null;
  const slice = cleaned.slice(firstBrace, lastBrace + 1);
  try {
    return JSON.parse(slice) as Partial<ParsedResume>;
  } catch {
    return null;
  }
}

/**
 * Calls ZAI to extract a structured ParsedResume object from raw resume text.
 * Falls back to a local regex-based extractor if ZAI is unavailable or returns
 * malformed JSON. The returned `confidence` is 0..1 (LLM success ≈ 0.9,
 * fallback ≈ 0.4).
 */
export async function extractStructuredFields(
  text: string,
  language: string,
): Promise<{ parsed: ParsedResume; confidence: number }> {
  const fallback = localFallbackExtraction(text, language);
  if (!text || text.trim().length < 20) {
    return { parsed: fallback, confidence: 0.2 };
  }

  try {
    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: 'You are a strict JSON-only resume parser. Never include markdown or commentary.' },
        { role: 'user', content: buildExtractionPrompt(text, language) },
      ],
      temperature: 0.1,
      max_tokens: 1500,
    });

    const content = completion?.choices?.[0]?.message?.content || '';
    const parsed = tryParseJson(content);
    if (!parsed) {
      return { parsed: fallback, confidence: 0.4 };
    }
    return { parsed: normalizeParsedResume(parsed, fallback), confidence: 0.9 };
  } catch (err) {
    console.warn('[resume-parser] ZAI extraction failed, using local fallback:', err);
    return { parsed: fallback, confidence: 0.4 };
  }
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Full pipeline helper — used by the API route and the legacy recruitment-ai  */
/* ─────────────────────────────────────────────────────────────────────────── */

export interface ParseResumeResult {
  rawText: string;
  language: string;
  parsed: ParsedResume;
  confidence: number;
  sourceFormat: ResumeSourceFormat;
  parseError?: string;
}

/**
 * Decode a base64 data URL (e.g. "data:application/pdf;base64,JVBERi0...") into
 * a Buffer + mime type. Returns null for invalid data URLs.
 */
export function decodeDataUrl(
  dataUrl: string,
): { buffer: Buffer; mimeType: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  try {
    const buffer = Buffer.from(match[2], 'base64');
    return { buffer, mimeType: match[1] };
  } catch {
    return null;
  }
}

/**
 * Decide the source format from a mime type.
 */
export function sourceFormatFromMime(mimeType: string): ResumeSourceFormat {
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx';
  if (mimeType === 'application/msword') return 'doc';
  if (mimeType === 'text/plain' || mimeType === 'text/html') return 'text';
  return 'unknown';
}

/**
 * End-to-end pipeline: takes a base64 data URL, extracts text, detects
 * language, calls ZAI for structured extraction, returns everything needed
 * to persist a ResumeParse row.
 */
export async function parseResumeFromDataUrl(dataUrl: string): Promise<ParseResumeResult> {
  const decoded = decodeDataUrl(dataUrl);
  if (!decoded) {
    return {
      rawText: '',
      language: 'en',
      parsed: localFallbackExtraction('', 'en'),
      confidence: 0,
      sourceFormat: 'unknown',
      parseError: 'Invalid data URL',
    };
  }

  const sourceFormat = sourceFormatFromMime(decoded.mimeType);
  let rawText = '';
  let parseError: string | undefined;

  try {
    if (sourceFormat === 'pdf') {
      rawText = await extractTextFromPdf(decoded.buffer);
    } else if (sourceFormat === 'docx') {
      rawText = await extractTextFromDocx(decoded.buffer);
    } else if (sourceFormat === 'text') {
      rawText = extractTextFromPlain(decoded.buffer);
    } else if (sourceFormat === 'doc') {
      // Legacy .doc binary — mammoth doesn't support it. Try plain text as a
      // last resort and flag the error.
      rawText = extractTextFromPlain(decoded.buffer);
      parseError = 'Legacy .doc format — text extraction may be incomplete. Convert to .docx for best results.';
    } else {
      rawText = extractTextFromPlain(decoded.buffer);
      parseError = `Unsupported mime type: ${decoded.mimeType}`;
    }
  } catch (err) {
    parseError = err instanceof Error ? err.message : 'Text extraction failed';
    rawText = '';
  }

  if (!rawText || rawText.trim().length < 5) {
    return {
      rawText: rawText || '',
      language: 'en',
      parsed: localFallbackExtraction(rawText, 'en'),
      confidence: 0,
      sourceFormat,
      parseError: parseError || 'No extractable text found in document',
    };
  }

  const language = detectLanguage(rawText);
  const { parsed, confidence } = await extractStructuredFields(rawText, language);

  return {
    rawText,
    language,
    parsed,
    confidence,
    sourceFormat,
    parseError,
  };
}
