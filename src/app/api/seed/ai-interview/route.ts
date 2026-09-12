import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { v4 as uuidv4 } from 'crypto';
import { isLiveMode } from '@/lib/site-mode';

// Simple UUID generator (doesn't need crypto import)
function generateToken(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

export async function POST(request: Request) {
  // ─── LIVE MODE GUARD ───
  if (isLiveMode(request)) {
    return NextResponse.json({ error: 'Seeding is disabled on the live platform.', code: 'LIVE_MODE_BLOCKED' }, { status: 403 });
  }

  const db = await getDb(request);
  try {
    const body = await request.json();
    const { secret } = body;

    if (secret !== '3boxes-reseed-2025') {
      return NextResponse.json({ error: 'Invalid seed secret' }, { status: 403 });
    }

    console.log('[AI-Interview-Seed] Starting AI Interview data seeding...');

    // Find the tenant (try both slugs)
    let tenant = await getPlatformDb().tenant.findFirst({ where: { slug: '3boxes-hrms-demo' } });
    if (!tenant) {
      tenant = await getPlatformDb().tenant.findFirst({ where: { slug: '3boxes-hrms-demo' } });
    }
    if (!tenant) {
      tenant = await getPlatformDb().tenant.findFirst({ where: { slug: '3boxes-corp' } });
    }
    if (!tenant) {
      // Find any active tenant
      tenant = await getPlatformDb().tenant.findFirst({ where: { status: 'active' } });
    }
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found. Run reseed first.' }, { status: 400 });
    }

    // Find the recruiter user
    const recruiterUser = await db.user.findUnique({ where: { email: 'recruiter@3boxeshrms.com' } });
    if (!recruiterUser) {
      return NextResponse.json({ error: 'Recruiter user not found. Run reseed first.' }, { status: 400 });
    }

    // Find existing interview sets to avoid duplicates
    const existingSets = await db.interviewSet.findMany({
      where: { tenantId: tenant.id },
    });
    const existingTitles = new Set(existingSets.map(s => s.title));

    const results = { sets: 0, questions: 0, sessions: 0, responses: 0, invitations: 0, proctoringLogs: 0 };

    // ====== Interview Set 1: Senior Full-Stack Developer (Video) ======
    if (!existingTitles.has('Senior Full-Stack Developer - Technical Assessment')) {
      const set1 = await db.interviewSet.create({
        data: {
          title: 'Senior Full-Stack Developer - Technical Assessment',
          roleTitle: 'Senior Full-Stack Developer',
          jobDescription: 'We are looking for a senior full-stack developer with expertise in React, Node.js, TypeScript, and system design. The candidate should have 5+ years of experience building scalable web applications.',
          tenantId: tenant.id,
          interviewMode: 'video',
          language: 'en',
          timeLimit: 45,
          cvProbeDuration: 15,
          enablePreScreening: true,
          enableProctoring: true,
          enableDynamicFollowUp: true,
          status: 'active',
          createdBy: recruiterUser.id,
          evaluationConfig: {
            weights: { technical: 0.4, communication: 0.2, problemSolving: 0.2, cultureFit: 0.2 },
            passingScore: 70,
            aiModel: 'gpt-4',
          },
          preScreenFilters: {
            minExperience: 5,
            requiredSkills: ['React', 'Node.js', 'TypeScript'],
            educationLevel: 'bachelors',
          },
        },
      });
      results.sets++;

      // Questions for set 1
      const questions1 = [
        { order: 1, category: 'technical', question: 'Can you explain the difference between server-side rendering and client-side rendering in React? When would you choose one over the other?', expectedPoints: 'SSR vs CSR performance tradeoffs, SEO implications, hydration, Next.js use cases', followUpPrompts: 'Ask about specific SSR frameworks; Ask about caching strategies', duration: 180, difficulty: 'medium', isMandatory: true },
        { order: 2, category: 'technical', question: 'How would you design a real-time notification system for a large-scale application? Walk me through the architecture.', expectedPoints: 'WebSocket vs SSE vs polling, message queues, Redis pub/sub, horizontal scaling', followUpPrompts: 'Ask about handling offline users; Ask about notification persistence', duration: 240, difficulty: 'hard', isMandatory: true },
        { order: 3, category: 'behavioral', question: 'Tell me about a time when you had to make a difficult technical decision that affected the entire team. How did you handle it?', expectedPoints: 'Decision-making process, stakeholder communication, weighing tradeoffs, outcome', followUpPrompts: 'Ask about what they would do differently; Ask about team reactions', duration: 180, difficulty: 'medium', isMandatory: true },
        { order: 4, category: 'technical', question: 'Explain how you would implement authentication and authorization in a microservices architecture.', expectedPoints: 'JWT vs session, OAuth2/OIDC, API gateway auth, service-to-service auth, RBAC', followUpPrompts: 'Ask about token refresh strategies; Ask about securing inter-service communication', duration: 240, difficulty: 'hard', isMandatory: true },
        { order: 5, category: 'cv_based', question: 'I see you have experience with PostgreSQL. Can you describe the most complex database schema you designed and the challenges you faced?', expectedPoints: 'Schema design decisions, normalization vs denormalization, indexing strategy, query optimization', followUpPrompts: 'Ask about migration strategies; Ask about handling schema changes in production', duration: 180, difficulty: 'medium', isMandatory: true },
        { order: 6, category: 'situational', question: 'If you discovered a critical performance issue in production that was affecting user experience, how would you approach resolving it?', expectedPoints: 'Incident response, profiling tools, monitoring, rollback strategy, post-mortem', followUpPrompts: 'Ask about prevention strategies; Ask about communication during incident', duration: 180, difficulty: 'medium', isMandatory: true },
        { order: 7, category: 'technical', question: 'What strategies would you use to optimize the performance of a React application that has become slow?', expectedPoints: 'Profiling, React.memo, useMemo, useCallback, code splitting, lazy loading, virtual lists', followUpPrompts: 'Ask about measuring performance; Ask about bundle size optimization', duration: 180, difficulty: 'medium', isMandatory: true },
        { order: 8, category: 'behavioral', question: 'How do you stay current with emerging technologies and decide which ones are worth adopting in your projects?', expectedPoints: 'Continuous learning, evaluation criteria, POC approach, risk assessment', followUpPrompts: 'Ask about a technology they adopted that didn\'t work out; Ask about their tech radar', duration: 120, difficulty: 'easy', isMandatory: false },
      ];

      for (const q of questions1) {
        await db.interviewSetQuestion.create({
          data: { setId: set1.id, ...q },
        });
        results.questions++;
      }

      // Create a completed session for this set
      const session1 = await db.interviewSession.create({
        data: {
          setId: set1.id,
          candidateName: 'Alex Turner',
          candidateEmail: 'alex.turner@email.com',
          candidatePhone: '+1-555-1001',
          resumeUrl: 'https://resumes.3boxeshrms.com/alex-turner.pdf',
          resumeParsed: { name: 'Alex Turner', experience: 6, skills: ['React', 'Node.js', 'TypeScript', 'PostgreSQL'], education: 'BS Computer Science', companies: ['Google', 'Startup Co'] },
          language: 'en',
          status: 'completed',
          preScreenResult: { passed: true, score: 85, filters: { minExperience: true, requiredSkills: true, educationLevel: true } },
          startedAt: new Date('2025-02-01T10:00:00Z'),
          completedAt: new Date('2025-02-01T10:42:00Z'),
          overallScore: 87,
          communicationScore: 85,
          grammarScore: 90,
          fluencyScore: 82,
          comprehensionScore: 88,
          vocabularyScore: 86,
          cognitiveScore: 84,
          skillMatchScore: 91,
          aiSummary: 'Strong technical candidate with excellent system design skills. Communication is clear and structured. Demonstrates deep understanding of full-stack development with practical experience in React, Node.js, and TypeScript. Shows good problem-solving approach and ability to think at scale.',
          aiRecommendation: 'hire',
          durationSeconds: 2520,
          fullTranscript: 'Interview transcript for Alex Turner - Senior Full-Stack Developer position. Candidate demonstrated strong technical knowledge across all questions with detailed and well-structured responses.',
        },
      });
      results.sessions++;

      // Create responses for session 1
      const responses1 = [
        { order: 1, question: 'Can you explain the difference between server-side rendering and client-side rendering in React?', responseText: 'Server-side rendering means the HTML is generated on the server and sent to the client fully rendered. Client-side rendering sends a minimal HTML shell and JavaScript that renders the page in the browser. I would choose SSR when SEO is critical, like for e-commerce or content sites, and when you need fast initial page loads. CSR is better for highly interactive applications where the user stays on the page for a long time, like dashboards or admin panels. With Next.js, you can actually use both — SSR for landing pages and CSR for the app itself.', aiScore: 88, aiFeedback: 'Excellent explanation covering both SSR and CSR with clear use cases. Good mention of Next.js hybrid approach. Could have mentioned hydration process.', responseDuration: 165 },
        { order: 2, question: 'How would you design a real-time notification system?', responseText: 'I would use WebSockets as the primary transport for real-time delivery, with Server-Sent Events as a fallback. The architecture would include an API gateway that maintains WebSocket connections, a message queue like Redis Pub/Sub for distributing notifications across server instances, and a notification service that handles business logic. For offline users, I would queue notifications in a database and deliver them when they reconnect. I would also implement notification preferences so users can control what they receive.', aiScore: 91, aiFeedback: 'Strong architecture design with good consideration for offline users and scalability. Mention of Redis Pub/Sub shows practical knowledge. Could expand on horizontal scaling strategy.', responseDuration: 210 },
        { order: 3, question: 'Tell me about a difficult technical decision that affected the team.', responseText: 'At my previous company, we had to decide whether to rewrite our monolithic backend in microservices or incrementally extract services. I advocated for the incremental approach. I created a proof of concept extracting one service, documented the process, and presented it to the team. We decided to go with the incremental approach, which minimized risk and allowed us to learn as we went. The key was communicating openly with stakeholders about trade-offs and timelines.', aiScore: 85, aiFeedback: 'Good real-world example with clear decision-making process. Shows leadership and communication skills. Could elaborate more on the specific outcomes and metrics.', responseDuration: 190 },
        { order: 4, question: 'How would you implement authentication in a microservices architecture?', responseText: 'I would implement an API gateway pattern where the gateway handles authentication using JWT tokens. The gateway validates tokens and forwards requests with user context headers to downstream services. For service-to-service communication, I would use mTLS or service mesh authentication. For the user-facing auth, I prefer OAuth2 with PKCE for web apps and the authorization code flow with OpenID Connect. Token refresh would use rotating refresh tokens stored securely. Each service would have its own authorization logic based on the user context.', aiScore: 89, aiFeedback: 'Comprehensive answer covering both user-facing and service-to-service authentication. Good mention of OAuth2 and OIDC. Could discuss token revocation strategies.', responseDuration: 230 },
      ];

      for (const r of responses1) {
        await db.interviewResponse.create({
          data: { sessionId: session1.id, ...r, isFollowUp: false, isCvBased: r.order === 5 },
        });
        results.responses++;
      }

      // Proctoring logs for session 1 (clean session, minor events)
      await db.proctoringLog.create({
        data: {
          sessionId: session1.id,
          eventType: 'tab_switch',
          severity: 'low',
          details: 'Brief tab switch detected (2 seconds). Possibly accessing calculator.',
          timestamp: new Date('2025-02-01T10:15:00Z'),
        },
      });
      results.proctoringLogs++;

      // Invitation for set 1
      await db.interviewInvitation.create({
        data: {
          setId: set1.id,
          candidateEmail: 'alex.turner@email.com',
          candidateName: 'Alex Turner',
          invitationToken: generateToken(),
          invitationUrl: 'https://3boxeshrms.com/interview/inv-alex-001',
          status: 'completed',
          sentAt: new Date('2025-01-28T09:00:00Z'),
          openedAt: new Date('2025-01-28T09:15:00Z'),
          expiresAt: new Date('2025-02-05T23:59:59Z'),
        },
      });
      results.invitations++;

      // Create an in-progress session for set 1 (Maya Singh)
      await db.interviewSession.create({
        data: {
          setId: set1.id,
          candidateName: 'Maya Singh',
          candidateEmail: 'maya.singh@email.com',
          candidatePhone: '+1-555-1002',
          resumeUrl: 'https://resumes.3boxeshrms.com/maya-singh.pdf',
          resumeParsed: { name: 'Maya Singh', experience: 8, skills: ['React', 'Python', 'AWS', 'Docker'], education: 'MS Computer Science', companies: ['Amazon', 'Tech Corp'] },
          language: 'en',
          status: 'in_progress',
          preScreenResult: { passed: true, score: 78, filters: { minExperience: true, requiredSkills: false, educationLevel: true } },
          startedAt: new Date(),
        },
      });
      results.sessions++;

      // Pending invitation for set 1
      await db.interviewInvitation.create({
        data: {
          setId: set1.id,
          candidateEmail: 'john.doe@email.com',
          candidateName: 'John Doe',
          invitationToken: generateToken(),
          invitationUrl: 'https://3boxeshrms.com/interview/inv-john-001',
          status: 'pending',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
      results.invitations++;
    }

    // ====== Interview Set 2: UX Research Lead (Voice) ======
    if (!existingTitles.has('UX Research Lead - Behavioral Assessment')) {
      const set2 = await db.interviewSet.create({
        data: {
          title: 'UX Research Lead - Behavioral Assessment',
          roleTitle: 'UX Research Lead',
          jobDescription: 'Lead UX research initiatives across products. Drive user-centered design through qualitative and quantitative research methods. 6+ years experience required.',
          tenantId: tenant.id,
          interviewMode: 'voice',
          language: 'en',
          timeLimit: 35,
          cvProbeDuration: 10,
          enablePreScreening: true,
          enableProctoring: false,
          enableDynamicFollowUp: true,
          status: 'active',
          createdBy: recruiterUser.id,
          evaluationConfig: {
            weights: { researchMethodology: 0.3, communication: 0.25, leadership: 0.25, strategicThinking: 0.2 },
            passingScore: 75,
          },
        },
      });
      results.sets++;

      const questions2 = [
        { order: 1, category: 'technical', question: 'Walk me through your approach to conducting a comprehensive usability study for a new product feature.', expectedPoints: 'Research planning, participant recruitment, methodology selection, analysis, reporting', duration: 240, difficulty: 'medium', isMandatory: true },
        { order: 2, category: 'behavioral', question: 'How do you handle situations when your research findings contradict the product team\'s assumptions?', expectedPoints: 'Diplomacy, data-driven advocacy, stakeholder management, presenting evidence', duration: 180, difficulty: 'hard', isMandatory: true },
        { order: 3, category: 'technical', question: 'Can you explain when you would use qualitative vs quantitative research methods, and how you combine them?', expectedPoints: 'Mixed methods approach, triangulation, when each is appropriate, integration strategies', duration: 180, difficulty: 'medium', isMandatory: true },
        { order: 4, category: 'situational', question: 'Your team has only 2 weeks to deliver research insights for a critical product decision. How would you approach this?', expectedPoints: 'Rapid research methods, prioritization, guerrilla testing, stakeholder alignment', duration: 180, difficulty: 'hard', isMandatory: true },
        { order: 5, category: 'cv_based', question: 'I see you led research at your previous company. Can you describe a research project that had the most significant impact on the product?', expectedPoints: 'Impact measurement, research design, stakeholder buy-in, measurable outcomes', duration: 240, difficulty: 'medium', isMandatory: true },
        { order: 6, category: 'behavioral', question: 'How do you mentor junior researchers and build a research culture within an organization?', expectedPoints: 'Mentorship approach, knowledge sharing, research ops, democratizing research', duration: 180, difficulty: 'medium', isMandatory: false },
      ];

      for (const q of questions2) {
        await db.interviewSetQuestion.create({
          data: { setId: set2.id, ...q, followUpPrompts: null },
        });
        results.questions++;
      }

      // Scheduled session for set 2
      const session2 = await db.interviewSession.create({
        data: {
          setId: set2.id,
          candidateName: 'Sophie Martin',
          candidateEmail: 'sophie.martin@email.com',
          candidatePhone: '+1-555-1003',
          resumeUrl: 'https://resumes.3boxeshrms.com/sophie-martin.pdf',
          resumeParsed: { name: 'Sophie Martin', experience: 7, skills: ['UX Research', 'Figma', 'User Testing', 'Analytics'], education: 'MS Human-Computer Interaction', companies: ['Meta', 'Design Studio'] },
          language: 'en',
          status: 'invited',
        },
      });
      results.sessions++;

      await db.interviewInvitation.create({
        data: {
          setId: set2.id,
          candidateEmail: 'sophie.martin@email.com',
          candidateName: 'Sophie Martin',
          invitationToken: generateToken(),
          invitationUrl: 'https://3boxeshrms.com/interview/inv-sophie-001',
          status: 'sent',
          sentAt: new Date(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
      results.invitations++;
    }

    // ====== Interview Set 3: Data Scientist (Text Chat) ======
    if (!existingTitles.has('Data Scientist - Technical Screening')) {
      const set3 = await db.interviewSet.create({
        data: {
          title: 'Data Scientist - Technical Screening',
          roleTitle: 'Data Scientist',
          jobDescription: 'Build ML models for business insights. Work with cross-functional teams. Python, TensorFlow/PyTorch, SQL, statistical analysis. 3+ years experience.',
          tenantId: tenant.id,
          interviewMode: 'text',
          language: 'en',
          timeLimit: 30,
          cvProbeDuration: 5,
          enablePreScreening: true,
          enableProctoring: true,
          enableDynamicFollowUp: true,
          status: 'active',
          createdBy: recruiterUser.id,
          evaluationConfig: {
            weights: { mlKnowledge: 0.35, statistics: 0.25, coding: 0.2, communication: 0.2 },
            passingScore: 65,
          },
        },
      });
      results.sets++;

      const questions3 = [
        { order: 1, category: 'technical', question: 'Explain the bias-variance tradeoff and how you would diagnose whether a model is overfitting or underfitting.', expectedPoints: 'Bias vs variance definition, learning curves, cross-validation, regularization', duration: 180, difficulty: 'medium', isMandatory: true },
        { order: 2, category: 'technical', question: 'How would you approach building a recommendation system for a large e-commerce platform?', expectedPoints: 'Collaborative filtering, content-based, hybrid approaches, cold start, scalability', duration: 240, difficulty: 'hard', isMandatory: true },
        { order: 3, category: 'technical', question: 'What is the difference between supervised and unsupervised learning? Give examples of when you would use each.', expectedPoints: 'Definition, labeled vs unlabeled data, classification/regression, clustering/dimensionality reduction', duration: 120, difficulty: 'easy', isMandatory: true },
        { order: 4, category: 'situational', question: 'You\'re given a dataset with significant class imbalance. How would you handle this in your modeling approach?', expectedPoints: 'Resampling, SMOTE, class weights, appropriate metrics, ensemble methods', duration: 180, difficulty: 'medium', isMandatory: true },
        { order: 5, category: 'cv_based', question: 'Tell me about a machine learning project you\'re most proud of. What was the business impact?', expectedPoints: 'Project scope, methodology, challenges, measurable impact, deployment', duration: 180, difficulty: 'medium', isMandatory: true },
      ];

      for (const q of questions3) {
        await db.interviewSetQuestion.create({
          data: { setId: set3.id, ...q, followUpPrompts: null },
        });
        results.questions++;
      }

      // Completed session for Data Scientist
      const session3 = await db.interviewSession.create({
        data: {
          setId: set3.id,
          candidateName: 'Wei Zhang',
          candidateEmail: 'wei.zhang@email.com',
          candidatePhone: '+1-555-1004',
          language: 'en',
          status: 'completed',
          startedAt: new Date('2025-01-25T14:00:00Z'),
          completedAt: new Date('2025-01-25T14:28:00Z'),
          overallScore: 72,
          communicationScore: 68,
          grammarScore: 85,
          fluencyScore: 65,
          comprehensionScore: 78,
          vocabularyScore: 80,
          cognitiveScore: 76,
          skillMatchScore: 70,
          aiSummary: 'Candidate shows solid understanding of core ML concepts but struggles with articulating complex ideas clearly. Technical knowledge is adequate but lacks depth in some areas. Communication skills need improvement for a collaborative role.',
          aiRecommendation: 'no_hire',
          durationSeconds: 1680,
        },
      });
      results.sessions++;

      // Responses with some follow-ups
      const responses3 = [
        { order: 1, question: 'Explain the bias-variance tradeoff...', responseText: 'Bias is the error from wrong assumptions in the model. Variance is error from sensitivity to training data fluctuations. High bias means underfitting, high variance means overfitting. You diagnose this using learning curves — if training error is high and validation error is high, you have high bias. If training error is low but validation error is high, you have high variance.', aiScore: 82, aiFeedback: 'Correct explanation with practical diagnostic approach. Could elaborate on regularization techniques to address the tradeoff.', responseDuration: 150 },
        { order: 2, question: 'How would you approach building a recommendation system?', responseText: 'I would start with collaborative filtering using matrix factorization as a baseline. Then explore content-based filtering using product features. For a large platform, I would use a hybrid approach and potentially deep learning models like neural collaborative filtering. For the cold start problem, I would use content-based recommendations for new items and popularity-based for new users.', aiScore: 78, aiFeedback: 'Covers main approaches but lacks depth on scalability considerations and real-time serving architecture.', responseDuration: 180 },
      ];

      for (const r of responses3) {
        const response = await db.interviewResponse.create({
          data: { sessionId: session3.id, ...r, isFollowUp: false, isCvBased: false },
        });
        results.responses++;

        // Add a follow-up question for the first response
        if (r.order === 1) {
          await db.interviewResponse.create({
            data: {
              sessionId: session3.id,
              order: 3,
              question: 'Can you give an example of a regularization technique and how it helps with overfitting?',
              responseText: 'L1 and L2 regularization are the most common. L2 adds a penalty term equal to the square of weights. This shrinks weights toward zero but rarely makes them exactly zero. L1 can make weights exactly zero, which does feature selection. Dropout is another technique for neural networks where you randomly deactivate neurons during training.',
              aiScore: 75,
              aiFeedback: 'Good coverage of L1/L2 and dropout. Could explain the mathematical intuition more clearly.',
              isFollowUp: true,
              isCvBased: false,
              followUpFromId: response.id,
              responseDuration: 140,
            },
          });
          results.responses++;
        }
      }

      // Proctoring events for session 3
      const proctoringEvents = [
        { eventType: 'face_not_detected', severity: 'medium', details: 'Face not detected for 8 seconds. Possible candidate looking away from screen.', timestamp: new Date('2025-01-25T14:10:00Z') },
        { eventType: 'tab_switch', severity: 'low', details: 'Tab switch detected for 3 seconds.', timestamp: new Date('2025-01-25T14:18:00Z') },
        { eventType: 'audio_anomaly', severity: 'high', details: 'Secondary voice detected for 5 seconds. Possible external assistance.', timestamp: new Date('2025-01-25T14:22:00Z') },
      ];

      for (const p of proctoringEvents) {
        await db.proctoringLog.create({
          data: { sessionId: session3.id, ...p, screenshotUrl: null },
        });
        results.proctoringLogs++;
      }

      await db.interviewInvitation.create({
        data: {
          setId: set3.id,
          candidateEmail: 'wei.zhang@email.com',
          candidateName: 'Wei Zhang',
          invitationToken: generateToken(),
          invitationUrl: 'https://3boxeshrms.com/interview/inv-wei-001',
          status: 'completed',
          sentAt: new Date('2025-01-22T10:00:00Z'),
          openedAt: new Date('2025-01-22T10:30:00Z'),
          expiresAt: new Date('2025-01-30T23:59:59Z'),
        },
      });
      results.invitations++;
    }

    // ====== Interview Set 4: HR Business Partner (MCQ + Text) ======
    if (!existingTitles.has('HR Business Partner - Competency Assessment')) {
      const set4 = await db.interviewSet.create({
        data: {
          title: 'HR Business Partner - Competency Assessment',
          roleTitle: 'HR Business Partner',
          jobDescription: 'Align people strategies with business objectives. 7+ years HR experience, PHR certification preferred, strong stakeholder management.',
          tenantId: tenant.id,
          interviewMode: 'mcq',
          language: 'en',
          timeLimit: 40,
          cvProbeDuration: 10,
          enablePreScreening: true,
          enableProctoring: true,
          enableDynamicFollowUp: false,
          status: 'active',
          createdBy: recruiterUser.id,
          evaluationConfig: {
            weights: { hrKnowledge: 0.35, stakeholderManagement: 0.25, strategicThinking: 0.25, ethics: 0.15 },
            passingScore: 80,
          },
        },
      });
      results.sets++;

      const questions4 = [
        { order: 1, category: 'technical', question: 'How would you handle a situation where a senior leader wants to terminate an employee without following proper HR procedures?', expectedPoints: 'Policy adherence, legal compliance, counseling the leader, documentation, risk management', duration: 180, difficulty: 'hard', isMandatory: true },
        { order: 2, category: 'behavioral', question: 'Describe how you would build a talent management strategy aligned with business goals for a rapidly growing tech company.', expectedPoints: 'Workforce planning, competency frameworks, succession planning, development programs', duration: 240, difficulty: 'hard', isMandatory: true },
        { order: 3, category: 'situational', question: 'Two department heads have conflicting requirements for the same talent pool. How would you resolve this?', expectedPoints: 'Mediation, data-driven decision making, prioritization, compromise, business impact analysis', duration: 180, difficulty: 'medium', isMandatory: true },
        { order: 4, category: 'technical', question: 'What key metrics would you track to measure the effectiveness of an employee engagement program?', expectedPoints: 'eNPS, retention rate, absenteeism, productivity, survey scores, participation rates', duration: 180, difficulty: 'medium', isMandatory: true },
        { order: 5, category: 'cv_based', question: 'Based on your experience with organizational development, what approach would you take to manage change resistance during a company merger?', expectedPoints: 'Change management framework, communication strategy, stakeholder mapping, training', duration: 240, difficulty: 'hard', isMandatory: true },
      ];

      for (const q of questions4) {
        await db.interviewSetQuestion.create({
          data: { setId: set4.id, ...q, followUpPrompts: null },
        });
        results.questions++;
      }

      // Completed session with high score for set 4
      const session4 = await db.interviewSession.create({
        data: {
          setId: set4.id,
          candidateName: 'James Williams',
          candidateEmail: 'james.williams@email.com',
          candidatePhone: '+1-555-1005',
          language: 'en',
          status: 'completed',
          startedAt: new Date('2024-12-15T10:00:00Z'),
          completedAt: new Date('2024-12-15T10:38:00Z'),
          overallScore: 93,
          communicationScore: 95,
          grammarScore: 92,
          fluencyScore: 94,
          comprehensionScore: 96,
          vocabularyScore: 91,
          cognitiveScore: 90,
          skillMatchScore: 94,
          aiSummary: 'Outstanding candidate with exceptional HR knowledge and stakeholder management skills. Demonstrates expert-level understanding of organizational development, change management, and talent strategy. Communication is polished and professional. Highly recommended for the HR Business Partner role.',
          aiRecommendation: 'strong_hire',
          durationSeconds: 2280,
        },
      });
      results.sessions++;

      await db.interviewInvitation.create({
        data: {
          setId: set4.id,
          candidateEmail: 'james.williams@email.com',
          candidateName: 'James Williams',
          invitationToken: generateToken(),
          invitationUrl: 'https://3boxeshrms.com/interview/inv-james-001',
          status: 'completed',
          sentAt: new Date('2024-12-10T09:00:00Z'),
          openedAt: new Date('2024-12-10T09:30:00Z'),
          expiresAt: new Date('2024-12-20T23:59:59Z'),
        },
      });
      results.invitations++;
    }

    // ====== Interview Set 5: Multi-language Video Interview (Draft) ======
    if (!existingTitles.has('Global Sales Manager - Multilingual Assessment')) {
      const set5 = await db.interviewSet.create({
        data: {
          title: 'Global Sales Manager - Multilingual Assessment',
          roleTitle: 'Global Sales Manager',
          jobDescription: 'Lead international sales team across APAC, EMEA, and Americas. Requires fluency in English and at least one other language. 8+ years international sales experience.',
          tenantId: tenant.id,
          interviewMode: 'video',
          language: 'en',
          timeLimit: 50,
          cvProbeDuration: 15,
          enablePreScreening: true,
          enableProctoring: true,
          enableDynamicFollowUp: true,
          status: 'draft',
          createdBy: recruiterUser.id,
          evaluationConfig: {
            weights: { salesAcumen: 0.3, culturalAwareness: 0.2, leadership: 0.25, communication: 0.25 },
            passingScore: 75,
            multilingual: true,
            supportedLanguages: ['en', 'es', 'fr', 'de', 'zh', 'ja'],
          },
        },
      });
      results.sets++;

      const questions5 = [
        { order: 1, category: 'behavioral', question: 'Tell me about a time you successfully entered a new international market. What was your strategy?', expectedPoints: 'Market research, localization strategy, team building, cultural adaptation', duration: 240, difficulty: 'hard', isMandatory: true },
        { order: 2, category: 'situational', question: 'How would you handle a cultural misunderstanding between your sales team and a key client from a different cultural background?', expectedPoints: 'Cultural sensitivity, mediation, communication adjustment, relationship repair', duration: 180, difficulty: 'medium', isMandatory: true },
        { order: 3, category: 'technical', question: 'What metrics do you use to evaluate the performance of an international sales team across different markets?', expectedPoints: 'KPIs by market, currency-adjusted revenue, pipeline metrics, cultural context', duration: 180, difficulty: 'medium', isMandatory: true },
      ];

      for (const q of questions5) {
        await db.interviewSetQuestion.create({
          data: { setId: set5.id, ...q, followUpPrompts: null },
        });
        results.questions++;
      }
    }

    // ====== Interview Set 6: Coding Challenge ======
    if (!existingTitles.has('Backend Engineer - Coding Challenge')) {
      const set6 = await db.interviewSet.create({
        data: {
          title: 'Backend Engineer - Coding Challenge',
          roleTitle: 'Backend Engineer',
          jobDescription: 'Design and build scalable backend services. Node.js, Python, or Go. Strong database and API design skills. 4+ years experience.',
          tenantId: tenant.id,
          interviewMode: 'coding',
          language: 'en',
          timeLimit: 60,
          cvProbeDuration: 5,
          enablePreScreening: false,
          enableProctoring: true,
          enableDynamicFollowUp: false,
          status: 'active',
          createdBy: recruiterUser.id,
          evaluationConfig: {
            weights: { codeQuality: 0.3, problemSolving: 0.3, efficiency: 0.2, communication: 0.2 },
            passingScore: 70,
            languages: ['javascript', 'python', 'go'],
            autoGrade: true,
          },
        },
      });
      results.sets++;

      const questions6 = [
        { order: 1, category: 'technical', question: 'Implement a rate limiter that supports both fixed window and sliding window algorithms. The API should allow configuring requests per minute and burst capacity.', expectedPoints: 'Fixed window counter, sliding window log/counter, token bucket, leaky bucket', followUpPrompts: 'Ask about distributed rate limiting; Ask about memory efficiency', duration: 600, difficulty: 'hard', isMandatory: true },
        { order: 2, category: 'technical', question: 'Design and implement a simple task queue system with priority support, retry logic, and dead letter queue.', expectedPoints: 'Priority queue, exponential backoff, DLQ, worker pool, graceful shutdown', followUpPrompts: 'Ask about persistence; Ask about monitoring', duration: 600, difficulty: 'hard', isMandatory: true },
        { order: 3, category: 'cognitive', question: 'Given a log file with millions of entries, write an efficient function to find the top N most frequent IP addresses in the last hour.', expectedPoints: 'Time-based filtering, hash map counting, heap/partial sort, streaming approach', duration: 300, difficulty: 'medium', isMandatory: true },
      ];

      for (const q of questions6) {
        await db.interviewSetQuestion.create({
          data: { setId: set6.id, ...q },
        });
        results.questions++;
      }

      // Expired invitation for set 6
      await db.interviewInvitation.create({
        data: {
          setId: set6.id,
          candidateEmail: 'lisa.park@email.com',
          candidateName: 'Lisa Park',
          invitationToken: generateToken(),
          invitationUrl: 'https://3boxeshrms.com/interview/inv-lisa-001',
          status: 'expired',
          sentAt: new Date('2025-01-01T10:00:00Z'),
          expiresAt: new Date('2025-01-08T23:59:59Z'),
        },
      });
      results.invitations++;

      // Disqualified session for set 6
      const session6 = await db.interviewSession.create({
        data: {
          setId: set6.id,
          candidateName: 'Tom Baker',
          candidateEmail: 'tom.baker@email.com',
          candidatePhone: '+1-555-1006',
          language: 'en',
          status: 'disqualified',
          startedAt: new Date('2025-01-20T15:00:00Z'),
          completedAt: new Date('2025-01-20T15:05:00Z'),
          aiSummary: 'Candidate was disqualified due to multiple proctoring violations including detected AI assistant usage and copy-paste of solution code.',
          aiRecommendation: 'not_enough_evidence',
          durationSeconds: 300,
        },
      });
      results.sessions++;

      // Proctoring logs for disqualified session
      const disqualifyLogs = [
        { eventType: 'copy_paste', severity: 'high', details: 'Large code block pasted from clipboard. Content appears to be from external source.', timestamp: new Date('2025-01-20T15:02:00Z') },
        { eventType: 'ai_assistant_detected', severity: 'critical', details: 'AI assistant tool detected in screen share. ChatGPT interface visible in background.', timestamp: new Date('2025-01-20T15:03:00Z'), screenshotUrl: 'https://evidence.3boxeshrms.com/proctoring/tom-baker-ai-detect.png' },
        { eventType: 'multiple_faces', severity: 'medium', details: 'Multiple faces detected in frame for 15 seconds.', timestamp: new Date('2025-01-20T15:04:00Z') },
      ];

      for (const p of disqualifyLogs) {
        await db.proctoringLog.create({
          data: { sessionId: session6.id, ...p, screenshotUrl: p.screenshotUrl || null },
        });
        results.proctoringLogs++;
      }
    }

    console.log('[AI-Interview-Seed] Seeding complete:', results);

    return NextResponse.json({
      success: true,
      message: 'AI Interview sample data seeded successfully',
      results,
    });
  } catch (error) {
    console.error('[AI-Interview-Seed] Error:', error);
    return NextResponse.json(
      { error: 'Seed failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
