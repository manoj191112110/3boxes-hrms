import { NextRequest, NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';

interface ChatMessage {
  role: 'system' | 'ai' | 'candidate';
  content: string;
}

// POST /api/ai-interview/chat — AI-powered interview chat
export async function POST(req: NextRequest) {
  const db = await getDb(req);
  try {
    const body = await req.json();
    const {
      interviewId,
      message,
      interviewType,
      jobTitle,
      history = [],
    } = body;

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Build conversation context for AI
    const systemPrompt = buildSystemPrompt(interviewType || 'technical', jobTitle || 'Software Engineer');
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.map((m: ChatMessage) => ({
        role: m.role === 'ai' ? 'assistant' : 'user',
        content: m.content,
      })),
      { role: 'user', content: message },
    ];

    // Call AI via z-ai-web-dev-sdk
    let aiResponse: string;

    try {
      const ZAI = (await import('z-ai-web-dev-sdk')).default;
      const zai = await ZAI.create();

      const completion = await zai.chat.completions.create({
        messages,
        temperature: 0.7,
        max_tokens: 500,
      });

      aiResponse = completion.choices[0]?.message?.content || 'I apologize, I could not generate a response. Please try again.';
    } catch {
      // Fallback: Generate contextual interview response locally
      aiResponse = generateFallbackResponse(interviewType || 'technical', message, history);
    }

    // Save transcript to interview if ID provided
    if (interviewId) {
      try {
        const interview = await db.interview.findUnique({
          where: { id: interviewId },
        });
        if (interview) {
          const existingFeedback = interview.aiFeedback || '';
          const newEntry = `\n[${new Date().toISOString()}] AI: ${aiResponse}\n[${new Date().toISOString()}] Candidate: ${message}`;
          await db.interview.update({
            where: { id: interviewId },
            data: {
              aiFeedback: existingFeedback + newEntry,
            },
          });
        }
      } catch {
        // Non-critical: transcript save failure shouldn't break the chat
      }
    }

    return NextResponse.json({
      response: aiResponse,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    console.error('AI Interview Chat error:', error);
    return NextResponse.json({ error: 'Failed to process interview chat' }, { status: 500 });
  }
}

function buildSystemPrompt(interviewType: string, jobTitle: string): string {
  const basePrompt = `You are an AI interviewer for 3Boxes HRMS conducting a ${interviewType} interview for the position of ${jobTitle}. You are professional, thorough, and adaptive in your questioning.`;

  const typeSpecific: Record<string, string> = {
    technical: `Focus on technical skills, problem-solving abilities, and domain knowledge. Ask progressively challenging questions. When the candidate gives a good answer, dig deeper. If they struggle, guide them with hints. Cover: system design, algorithms, best practices, and real-world scenarios.`,
    hr: `Focus on behavioral and situational questions. Assess communication skills, team collaboration, leadership potential, conflict resolution, and cultural fit. Use the STAR method (Situation, Task, Action, Result) to evaluate responses.`,
    behavioral: `Ask behavioral questions that reveal past performance and predict future behavior. Explore motivations, work ethic, adaptability, and interpersonal skills. Probe for specific examples and outcomes.`,
    coding: `Present coding challenges appropriate for the role. Start with simpler problems and increase complexity. Evaluate: code quality, algorithm efficiency, edge case handling, and problem decomposition. After they write code, ask them to explain their approach and optimize.`,
    mcq: `Present multiple-choice questions one at a time. After each answer, provide brief feedback explaining the correct answer. Cover topics relevant to the ${jobTitle} position. Track which areas the candidate is strong or weak in and adapt accordingly.`,
    voice: `Conduct the interview as if it were a voice conversation. Keep your responses conversational and natural. Ask follow-up questions based on the candidate's tone and content. Assess verbal communication clarity, confidence, and thought organization.`,
    video: `Conduct the interview as if it were a video call. Be warm and professional. Ask questions that would be appropriate for a face-to-face interview. Include both technical and soft-skill assessment. Provide encouraging feedback.`,
    text: `Conduct a professional text-based interview. Be clear and concise in your questions. Analyze the candidate's written communication skills alongside their technical knowledge. Ask one question at a time and build on their responses.`,
  };

  return `${basePrompt}\n\n${typeSpecific[interviewType] || typeSpecific.technical}\n\nRules:\n- Ask ONE question at a time\n- Be encouraging but objective\n- Adapt difficulty based on responses\n- Provide brief positive feedback for good answers\n- Keep responses concise (2-4 sentences max for follow-ups)\n- If the candidate seems stuck, offer a hint\n- End with a summary after 8-10 exchanges`;
}

function generateFallbackResponse(interviewType: string, candidateMessage: string, history: ChatMessage[]): string {
  const exchangeCount = history.filter(m => m.role === 'admin').length;

  // Opening message
  if (exchangeCount === 0) {
    const openings: Record<string, string> = {
      technical: `Welcome! I'll be conducting your technical interview today. Let's start: Can you describe your experience with building scalable applications and a specific challenge you've faced?`,
      hr: `Hello! I'm looking forward to learning more about you today. To start, could you tell me about a time when you had to collaborate with a difficult team member? How did you handle it?`,
      behavioral: `Welcome! I'd like to understand your work style and experiences. Can you share an example of a time when you had to adapt quickly to a significant change at work?`,
      coding: `Hi there! I'll be giving you some coding challenges. Let's start with something straightforward: Write a function that reverses a linked list. How would you approach this?`,
      mcq: `Welcome to the assessment! I'll present multiple-choice questions. Here's the first one:\n\nWhich data structure provides O(1) average time complexity for insertions and lookups?\nA) Array\nB) Linked List\nC) Hash Table\nD) Binary Search Tree`,
      text: `Hello! Welcome to your interview. I'll be asking you a series of questions. Let's begin: What interests you most about this role and what relevant experience do you bring?`,
      voice: `Hello! Great to connect with you today. Let's dive right in — tell me about yourself and what makes you a great fit for this position.`,
      video: `Hi there! It's great to meet you. Let's get started — could you walk me through your professional background and highlight a project you're particularly proud of?`,
    };
    return openings[interviewType] || openings.technical;
  }

  // Closing after enough exchanges
  if (exchangeCount >= 8) {
    return `Thank you for the thorough responses! You've demonstrated strong knowledge and communication skills. Let me summarize: You showed good understanding of core concepts, practical problem-solving ability, and clear articulation of your experience. The interview is now complete. Our team will review the full transcript and get back to you shortly. Thank you for your time!`;
  }

  // Mid-interview contextual responses
  const followUps = [
    `That's a solid answer! Building on that, could you explain how you would handle a situation where the system needs to scale 10x overnight?`,
    `Interesting perspective. Can you give me a specific example from your experience where you applied this approach?`,
    `Good explanation. Now, what are some potential pitfalls or edge cases you'd watch out for in this scenario?`,
    `I appreciate that insight. How would you measure the success or effectiveness of that approach?`,
    `That makes sense. Let's shift gears slightly — how do you stay current with industry best practices, and can you share how you've applied something new you learned recently?`,
    `Well said. Can you walk me through your thought process when you encounter a problem you've never seen before?`,
    `Excellent. One more question on this topic — how would you explain this concept to a junior team member?`,
  ];

  return followUps[exchangeCount % followUps.length];
}
