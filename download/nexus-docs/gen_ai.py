#!/usr/bin/env python3
"""Generate NEXUS HRMS AI Documentation PDF"""
import sys, os
sys.path.insert(0, '/home/z/my-project/download/nexus-docs')
from doc_utils import *

register_fonts()
s = make_styles()

OUT_DIR = '/home/z/my-project/download/nexus-docs'
BODY_PATH = os.path.join(OUT_DIR, 'ai_body.pdf')
OUTPUT_PATH = os.path.join(OUT_DIR, 'NEXUS-HRMS-AI-Documentation.pdf')

doc = TocDocTemplate(BODY_PATH, pagesize=A4, leftMargin=LM, rightMargin=RM, topMargin=TM, bottomMargin=BM)
story = []

# ── TOC ──
story.append(Paragraph('<b>Table of Contents</b>', s['H1']))
toc = TableOfContents()
toc.levelStyles = [
    ParagraphStyle('TOC1', fontName='DejaVuSansBold', fontSize=13, leftIndent=20, leading=22),
    ParagraphStyle('TOC2', fontName='DejaVuSans', fontSize=11, leftIndent=40, leading=18),
]
story.append(toc)
story.append(PageBreak())

# ── 1. AI Platform Overview ──
story.append(heading('1. AI Platform Overview', 'H1', s, 0))
story.append(body('The NEXUS HRMS platform integrates artificial intelligence capabilities throughout the employee lifecycle, powered by the z-ai-web-dev-sdk. AI features span recruitment screening, interview automation, conversational assistance, performance analytics, and predictive insights — transforming traditional HR processes into intelligent, data-driven workflows.', s))
story.append(Spacer(1, 6))

story.append(heading('1.1 z-ai-web-dev-sdk Integration', 'H2', s, 1))
story.append(body('The z-ai-web-dev-sdk serves as the foundational AI integration layer for the NEXUS platform. It provides standardized access to large language models for text generation, analysis, and conversational AI capabilities.', s))
sdk_features = [
    '<b>SDK Architecture:</b> The z-ai-web-dev-sdk is a JavaScript/TypeScript SDK that provides programmatic access to AI models through a unified API. It abstracts model selection, prompt engineering, and response parsing.',
    '<b>Integration Points:</b> The SDK is integrated into NEXUS through Next.js API routes, which serve as server-side AI orchestration points. Client-side components interact with AI features through these API endpoints.',
    '<b>Authentication:</b> The SDK authenticates using API keys stored as server-side environment variables, never exposed to the client.',
    '<b>Rate Management:</b> The SDK includes built-in rate limiting and retry logic to manage API call volumes and costs.',
    '<b>Error Handling:</b> Comprehensive error handling with fallback responses ensures graceful degradation when AI services are unavailable.',
    '<b>Response Streaming:</b> For chat interfaces, the SDK supports streaming responses to provide real-time feedback to users.'
]
for feat in sdk_features:
    story.append(bullet(feat, s))
story.append(Spacer(1, 8))

story.append(heading('1.2 AI Capabilities Across the Platform', 'H2', s, 1))
ai_caps = make_table(
    ['Module', 'AI Capability', 'SDK Integration', 'Business Value'],
    [
        ['AI Interview', 'Question generation, response evaluation, scoring', '/api/ai-interview', 'Consistent, unbiased candidate assessment'],
        ['AI Assistant', 'NLP chatbot, knowledge retrieval, escalation', '/api/ai-chat', '24/7 employee self-service, reduced HR workload'],
        ['Recruitment', 'Resume screening, score-based ranking', '/api/ai-interview', 'Faster hiring, better candidate matching'],
        ['Performance', 'Predictive analytics, skill gap identification', '/api/ai-chat', 'Proactive talent management'],
        ['Helpdesk', 'Auto-categorization, smart routing', '/api/ai-chat', 'Faster resolution, improved satisfaction'],
        ['Training', 'Content recommendations, assessment generation', '/api/ai-chat', 'Personalized learning paths'],
    ],
    s, [80, 160, 100, 140]
)
story.append(ai_caps)
story.append(Spacer(1, 12))

# ── 2. AI Admin Console ──
story.append(heading('2. AI Admin Console', 'H1', s, 0))
story.append(body('The AI Admin Console provides Super Admins and Tenant Admins with centralized control over AI features, model configuration, prompt templates, monitoring, and cost tracking. It serves as the governance layer for all AI operations within the platform.', s))
story.append(Spacer(1, 6))

story.append(heading('2.1 Model Configuration', 'H2', s, 1))
story.append(body('The Model Configuration section allows administrators to select and configure AI models for different use cases:', s))
model_config = [
    '<b>Model Selection:</b> Choose from available AI models (e.g., GPT-4, GPT-3.5, Claude) for each feature module. Different models may be optimal for different tasks.',
    '<b>Temperature Setting:</b> Configure the creativity/precision balance (0.0 = deterministic, 1.0 = creative). Interview question generation uses moderate temperature; scoring uses low temperature.',
    '<b>Max Tokens:</b> Set maximum response length per request type to control output length and costs.',
    '<b>Top-P (Nucleus Sampling):</b> Configure the probability threshold for token selection, affecting response diversity.',
    '<b>Frequency Penalty:</b> Adjust repetition avoidance in generated content.',
    '<b>Presence Penalty:</b> Control topic diversity in generated responses.',
    '<b>Fallback Configuration:</b> Set up fallback model chains in case the primary model is unavailable or rate-limited.',
    '<b>A/B Testing:</b> Route a percentage of requests to different model configurations for performance comparison.'
]
for item in model_config:
    story.append(bullet(item, s))
story.append(Spacer(1, 8))

story.append(heading('2.2 Prompt Templates', 'H2', s, 1))
story.append(body('Prompt templates define the system prompts and instruction sets that guide AI behavior across different features:', s))
prompt_templates = make_table(
    ['Template', 'Purpose', 'Key Variables', 'Model Type'],
    [
        ['Interview Questions', 'Generate role-specific interview questions', 'jobTitle, skills, difficulty, category', 'High-quality text generation'],
        ['Response Evaluation', 'Score candidate interview responses', 'question, answer, rubric, maxScore', 'Analytical/scoring'],
        ['Feedback Generation', 'Create detailed interview feedback', 'scores, responses, jobRequirements', 'Structured output'],
        ['Bias Detection', 'Flag potential scoring bias', 'allScores, demographics, criteria', 'Classification'],
        ['Chat Welcome', 'Initialize AI Assistant conversation', 'userName, role, department', 'Conversational'],
        ['Knowledge Retrieval', 'Formulate HR policy responses', 'query, policyContext, employeeLevel', 'RAG-based'],
        ['Screening Summary', 'Summarize candidate screening results', 'resumeData, jobRequirements, scores', 'Summarization'],
        ['Performance Insights', 'Generate performance trend analysis', 'reviewData, goals, history', 'Analytical'],
    ],
    s, [110, 140, 150, 100]
)
story.append(prompt_templates)
story.append(Spacer(1, 8))

story.append(heading('2.3 Monitoring Dashboard', 'H2', s, 1))
story.append(body('The AI Monitoring Dashboard provides real-time visibility into AI system performance and health:', s))
monitoring_items = [
    '<b>Request Volume:</b> Track the number of AI API calls per hour/day/week, segmented by module and model.',
    '<b>Response Time:</b> Monitor average and percentile response times for AI operations, with alerting on degradation.',
    '<b>Success Rate:</b> Track the percentage of successful AI responses versus errors or timeouts.',
    '<b>Token Usage:</b> Monitor input and output token consumption per module for cost management.',
    '<b>Quality Metrics:</b> Track user satisfaction ratings for AI-generated content and suggestions.',
    '<b>Error Analysis:</b> Categorize and track error types (rate limit, timeout, content filter, invalid response) for troubleshooting.',
    '<b>Usage Patterns:</b> Visualize usage patterns across time of day, day of week, and module to optimize resource allocation.',
    '<b>Health Status:</b> Real-time health indicators for each AI service endpoint with automatic alerting on outages.'
]
for item in monitoring_items:
    story.append(bullet(item, s))
story.append(Spacer(1, 8))

story.append(heading('2.4 Cost Tracking & Budget Management', 'H2', s, 1))
story.append(body('The cost tracking module provides comprehensive financial oversight of AI operations:', s))
cost_features = make_table(
    ['Feature', 'Description', 'Configuration'],
    [
        ['Per-Request Cost', 'Calculate cost for each AI API call based on token usage and model pricing', 'Model pricing table maintained by admin'],
        ['Budget Alerts', 'Trigger notifications when spending approaches or exceeds defined thresholds', 'Monthly budget per module and overall'],
        ['Cost Allocation', 'Attribute AI costs to specific modules, tenants, and user groups', 'Tenant-level and module-level tracking'],
        ['Usage Forecasting', 'Project future AI costs based on usage trends', 'Historical data analysis with trend projection'],
        ['Cost Optimization', 'Identify opportunities to reduce costs (model downgrades, caching)', 'Automatic suggestions based on usage patterns'],
        ['Invoice Generation', 'Generate AI cost reports for internal chargeback', 'Monthly/weekly automated reports'],
    ],
    s, [110, 210, 150]
)
story.append(cost_features)
story.append(Spacer(1, 12))

# ── 3. AI Interview Module ──
story.append(heading('3. AI Interview Module', 'H1', s, 0))
story.append(body('The AI Interview Module is one of the most sophisticated AI features in NEXUS HRMS, providing automated interview question generation, response evaluation, scoring, feedback generation, and bias detection. It leverages the z-ai-web-dev-sdk to deliver consistent, fair, and comprehensive candidate assessments.', s))
story.append(Spacer(1, 6))

story.append(heading('3.1 Question Generation', 'H2', s, 1))
story.append(body('The AI interview question generation system creates role-specific, competency-based questions tailored to the job requirements:', s))
qgen_items = [
    '<b>Input Parameters:</b> Job title, required skills list, experience level, interview category (technical, behavioral, situational), difficulty level, and number of questions.',
    '<b>Question Types:</b> The system generates multiple question types including open-ended, scenario-based, problem-solving, behavioral (STAR method), and technical knowledge questions.',
    '<b>Competency Mapping:</b> Questions are mapped to specific competencies (communication, leadership, technical skills, problem-solving) for structured evaluation.',
    '<b>Difficulty Calibration:</b> Question difficulty is calibrated using the configured difficulty parameter and the job\'s seniority level to ensure appropriate challenge.',
    '<b>Diversity Assurance:</b> The generation algorithm ensures question diversity across competency areas, avoiding repetition and ensuring comprehensive assessment coverage.',
    '<b>Custom Question Integration:</b> Recruiters can add custom questions to the AI-generated set, creating a hybrid interview that combines AI consistency with human expertise.',
    '<b>Question Validation:</b> Generated questions undergo automated validation for clarity, relevance, and bias before being presented to candidates.',
    '<b>Question Bank:</b> Successfully validated questions are stored in a question bank for reuse and continuous improvement of the generation model.'
]
for item in qgen_items:
    story.append(bullet(item, s))
story.append(Spacer(1, 8))

story.append(heading('3.2 Automated Assessment', 'H2', s, 1))
story.append(body('The automated assessment system evaluates candidate responses against predefined rubrics and competency frameworks:', s))
assessment_items = [
    '<b>Response Analysis:</b> AI analyzes the semantic content, structure, and completeness of candidate responses to interview questions.',
    '<b>Rubric-Based Scoring:</b> Each question has an associated scoring rubric that defines criteria for different score levels. The AI maps response content to rubric criteria.',
    '<b>Competency Assessment:</b> Responses are evaluated against the specific competency being measured (e.g., leadership, problem-solving, communication).',
    '<b>Contextual Understanding:</b> The AI considers the job context and requirements when evaluating response relevance and quality.',
    '<b>Multi-Factor Evaluation:</b> Scoring considers multiple factors including accuracy, depth, relevance, structure, and communication clarity.',
    '<b>Comparative Analysis:</b> When multiple candidates interview for the same role, the system provides comparative assessment across candidates.',
    '<b>Confidence Scoring:</b> Each automated assessment includes a confidence score indicating the AI\'s certainty in the evaluation, flagging low-confidence assessments for human review.'
]
for item in assessment_items:
    story.append(bullet(item, s))
story.append(Spacer(1, 8))

story.append(heading('3.3 Scoring Algorithms', 'H2', s, 1))
story.append(body('The scoring system uses a multi-dimensional algorithm that produces the aiScore field in the Interview model:', s))
scoring_tbl = make_table(
    ['Scoring Dimension', 'Weight', 'Description', 'Scale'],
    [
        ['Technical Accuracy', '30%', 'Correctness of technical knowledge demonstrated', '0-10'],
        ['Problem Solving', '25%', 'Approach to problem-solving and analytical thinking', '0-10'],
        ['Communication', '20%', 'Clarity, structure, and effectiveness of response', '0-10'],
        ['Relevance', '15%', 'Direct relevance of response to the question asked', '0-10'],
        ['Depth', '10%', 'Depth of understanding beyond surface-level answers', '0-10'],
    ],
    s, [120, 50, 230, 70]
)
story.append(scoring_tbl)
story.append(Spacer(1, 4))
story.append(body('The composite aiScore is calculated as a weighted average of all dimensions, producing a score on a 0-10 scale. Thresholds for pass/fail are configurable per role through the AI Admin Console.', s))
story.append(Spacer(1, 8))

story.append(heading('3.4 Feedback Generation', 'H2', s, 1))
story.append(body('The feedback generation system creates comprehensive, actionable feedback stored in the aiFeedback field of the Interview model:', s))
feedback_items = [
    '<b>Strengths Summary:</b> Identifies and highlights the candidate\'s strongest competency areas with specific examples from their responses.',
    '<b>Improvement Areas:</b> Identifies areas where the candidate fell short, with constructive suggestions for improvement.',
    '<b>Competency Breakdown:</b> Provides detailed scores for each competency assessed, enabling targeted development planning.',
    '<b>Response-Level Feedback:</b> Offers specific feedback on individual responses, referencing what was said and how it could be improved.',
    '<b>Comparative Context:</b> Where applicable, provides context on how the candidate\'s performance compares to typical scores for the role level.',
    '<b>Recommendation:</b> Generates a hiring recommendation (Strong Hire, Hire, Lean Hire, No Hire) based on the composite score and threshold configuration.',
    '<b>Interview Summary:</b> Produces a concise executive summary suitable for sharing with the hiring committee.'
]
for item in feedback_items:
    story.append(bullet(item, s))
story.append(Spacer(1, 8))

story.append(heading('3.5 Bias Detection', 'H2', s, 1))
story.append(body('The bias detection module identifies potential biases in AI scoring to ensure fair and equitable candidate assessment:', s))
bias_items = [
    '<b>Score Distribution Analysis:</b> Monitors the distribution of AI scores across demographic groups to identify statistically significant disparities.',
    '<b>Question Bias Detection:</b> Analyzes whether specific questions produce systematically different scores for certain demographic groups.',
    '<b>Language Bias Checks:</b> Evaluates whether the AI scoring model exhibits bias toward certain communication styles or language patterns.',
    '<b>Flagging System:</b> When potential bias is detected, the system flags the interview for mandatory human review before any hiring decisions are made.',
    '<b>Bias Report Generation:</b> Generates periodic bias analysis reports for the AI Admin Console, highlighting trends and areas requiring model recalibration.',
    '<b>Mitigation Strategies:</b> The system suggests mitigation strategies when bias patterns are identified, such as adjusting prompt templates, adding debiasing instructions, or modifying scoring weights.'
]
for item in bias_items:
    story.append(bullet(item, s))
story.append(Spacer(1, 8))

story.append(heading('3.6 Interview Data Model', 'H2', s, 1))
story.append(body('The Interview model in the NEXUS database stores both traditional and AI-generated assessment data:', s))
interview_model = make_table(
    ['Field', 'Type', 'Description'],
    [
        ['id', 'Int (Auto)', 'Unique interview identifier'],
        ['candidateId', 'String', 'Reference to the candidate/employee'],
        ['jobId', 'String', 'Reference to the job posting'],
        ['interviewDate', 'DateTime', 'When the interview was conducted'],
        ['interviewType', 'String', 'AI / Manual / Hybrid'],
        ['questions', 'Json', 'Array of interview questions with metadata'],
        ['responses', 'Json', 'Array of candidate responses'],
        ['aiScore', 'Float (Optional)', 'Composite AI-generated score (0-10)'],
        ['aiFeedback', 'String (Optional)', 'AI-generated feedback text'],
        ['manualScore', 'Float (Optional)', 'Human evaluator score'],
        ['manualFeedback', 'String (Optional)', 'Human evaluator feedback'],
        ['biasFlags', 'Json (Optional)', 'Array of detected bias indicators'],
        ['status', 'String', 'Scheduled / In Progress / Completed / Reviewed'],
        ['tenantId', 'String', 'Tenant isolation foreign key'],
    ],
    s, [110, 120, 240]
)
story.append(interview_model)
story.append(Spacer(1, 12))

# ── 4. AI Assistant Module ──
story.append(heading('4. AI Assistant Module', 'H1', s, 0))
story.append(body('The AI Assistant Module provides an intelligent chatbot interface for employee self-service and HR query resolution. Powered by the z-ai-web-dev-sdk, the assistant understands natural language queries, retrieves relevant HR knowledge, and performs actions on behalf of the employee.', s))
story.append(Spacer(1, 6))

story.append(heading('4.1 NLP Chatbot Architecture', 'H2', s, 1))
story.append(body('The AI Assistant uses a multi-stage NLP pipeline to understand and respond to employee queries:', s))
nlp_steps = [
    '<b>Intent Classification:</b> The first stage identifies the user\'s intent (e.g., leave inquiry, policy question, helpdesk request, payroll question) using the AI model with a predefined intent taxonomy.',
    '<b>Entity Extraction:</b> Key entities are extracted from the query (e.g., dates, leave types, policy names, amounts) to provide context for the response.',
    '<b>Context Resolution:</b> The system resolves references using conversation context and the user\'s profile data (e.g., "my leave balance" resolves to the specific employee\'s leave records).',
    '<b>Knowledge Retrieval:</b> Based on the classified intent and extracted entities, the system retrieves relevant knowledge from the HR knowledge base and policy documents.',
    '<b>Response Generation:</b> The AI model generates a contextual, accurate response incorporating retrieved knowledge, user context, and conversational history.',
    '<b>Action Execution:</b> For actionable requests (e.g., "submit a leave request"), the assistant can execute API actions on behalf of the user with confirmation.'
]
for step in nlp_steps:
    story.append(bullet(step, s))
story.append(Spacer(1, 8))

story.append(heading('4.2 Knowledge Retrieval System', 'H2', s, 1))
story.append(body('The knowledge retrieval system ensures the AI Assistant provides accurate, organization-specific responses:', s))
knowledge_items = [
    '<b>Policy Knowledge Base:</b> Organizational policies (leave, attendance, travel, expenses) are indexed and made searchable by the AI system.',
    '<b>FAQ Repository:</b> Common questions and their approved answers are maintained in a structured FAQ database.',
    '<b>Process Documentation:</b> Step-by-step process documentation for common HR tasks is available for the AI to reference.',
    '<b>Benefit Information:</b> Employee benefit details, eligibility criteria, and claim procedures are indexed for retrieval.',
    '<b>Real-Time Data:</b> For queries about personal data (leave balance, payslip, attendance), the system queries live data with appropriate access controls.',
    '<b>Context-Aware Retrieval:</b> The retrieval system considers the user\'s role, department, and location to provide contextually relevant information.'
]
for item in knowledge_items:
    story.append(bullet(item, s))
story.append(Spacer(1, 8))

story.append(heading('4.3 Multi-Turn Conversation', 'H2', s, 1))
story.append(body('The AI Assistant maintains conversation context across multiple messages, enabling natural multi-turn dialogues:', s))
multi_turn = [
    '<b>Session Management:</b> Each conversation session maintains a unique session ID with full message history for context continuity.',
    '<b>Context Window:</b> The system maintains a configurable context window of recent messages to inform the AI model about the ongoing conversation.',
    '<b>Reference Resolution:</b> Pronouns and references to previous messages are resolved using conversation context (e.g., "What about for next month?" after a leave balance query).',
    '<b>Topic Tracking:</b> The system tracks the current topic of conversation and can detect topic shifts, adapting responses accordingly.',
    '<b>Clarification Requests:</b> When user queries are ambiguous, the assistant asks clarifying questions rather than making assumptions.',
    '<b>Conversation Summarization:</b> For long conversations, the system summarizes previous context to maintain coherence without exceeding token limits.'
]
for item in multi_turn:
    story.append(bullet(item, s))
story.append(Spacer(1, 8))

story.append(heading('4.4 Smart Escalation', 'H2', s, 1))
story.append(body('When the AI Assistant encounters queries beyond its capability, it intelligently escalates to human agents:', s))
escalation_items = [
    '<b>Capability Threshold:</b> Queries requiring subjective judgment, exception handling, or sensitive decisions trigger automatic escalation.',
    '<b>Confidence-Based Escalation:</b> When the AI\'s response confidence falls below a configurable threshold, the conversation is escalated.',
    '<b>Emotion Detection:</b> The system detects frustrated or distressed language patterns and prioritizes escalation to human support.',
    '<b>Seamless Handoff:</b> Escalated conversations include full chat history and context, enabling the human agent to continue without requiring the user to repeat information.',
    '<b>Category-Based Routing:</b> Escalated queries are routed to the appropriate team (HR, IT, Finance, Helpdesk) based on the classified intent.',
    '<b>Priority Assignment:</b> Escalation priority is determined by the query category, user role, and detected urgency level.'
]
for item in escalation_items:
    story.append(bullet(item, s))
story.append(Spacer(1, 8))

story.append(heading('4.5 AIChatLog Data Model', 'H2', s, 1))
story.append(body('All AI Assistant interactions are recorded in the AIChatLog model for analytics and improvement:', s))
chatlog_model = make_table(
    ['Field', 'Type', 'Description'],
    [
        ['id', 'Int (Auto)', 'Unique chat log identifier'],
        ['userId', 'String', 'User who initiated the conversation'],
        ['sessionId', 'String', 'Conversation session identifier'],
        ['message', 'String', 'User message content'],
        ['response', 'String', 'AI assistant response'],
        ['intent', 'String (Optional)', 'Classified intent category'],
        ['entities', 'Json (Optional)', 'Extracted entities from message'],
        ['confidence', 'Float (Optional)', 'AI response confidence score'],
        ['escalated', 'Boolean', 'Whether the conversation was escalated'],
        ['escalatedTo', 'String (Optional)', 'Agent/team the conversation was escalated to'],
        ['tokensUsed', 'Int (Optional)', 'Total tokens consumed for this interaction'],
        ['responseTime', 'Int (Optional)', 'AI response time in milliseconds'],
        ['tenantId', 'String', 'Tenant isolation foreign key'],
        ['timestamp', 'DateTime', 'When the interaction occurred'],
    ],
    s, [110, 120, 240]
)
story.append(chatlog_model)
story.append(Spacer(1, 12))

# ── 5. AI-Powered Recruitment ──
story.append(heading('5. AI-Powered Recruitment', 'H1', s, 0))
story.append(body('AI integration in the recruitment module enhances every stage of the hiring pipeline from candidate screening to final selection. The AI capabilities reduce time-to-hire, improve candidate quality, and minimize unconscious bias in the selection process.', s))
story.append(Spacer(1, 6))

story.append(heading('5.1 Candidate Screening', 'H2', s, 1))
story.append(body('AI-powered candidate screening analyzes resumes and applications against job requirements to produce a relevance score:', s))
screening_items = [
    '<b>Resume Parsing:</b> AI extracts structured data from resumes including skills, experience, education, certifications, and projects.',
    '<b>Skills Matching:</b> The system matches extracted skills against job requirements, accounting for skill synonyms and related competencies.',
    '<b>Experience Assessment:</b> AI evaluates the depth and relevance of work experience in relation to the target role.',
    '<b>Education Verification:</b> Educational qualifications are matched against job requirements with consideration for equivalencies.',
    '<b>Cultural Fit Indicators:</b> The system analyzes resume language and project descriptions for alignment with organizational culture markers.',
    '<b>Gap Identification:</b> AI identifies gaps between the candidate profile and job requirements, highlighting areas for interview focus.',
    '<b>Scoring Output:</b> Each candidate receives a composite screening score (0-100) that ranks them against other applicants for the same position.'
]
for item in screening_items:
    story.append(bullet(item, s))
story.append(Spacer(1, 8))

story.append(heading('5.2 Score-Based Ranking', 'H2', s, 1))
story.append(body('The score-based ranking system provides an objective, data-driven method for prioritizing candidates:', s))
ranking_tbl = make_table(
    ['Score Range', 'Category', 'Recommended Action', 'Typical Percentage'],
    [
        ['90-100', 'Exceptional Match', 'Fast-track interview scheduling', '5-10%'],
        ['75-89', 'Strong Match', 'Priority interview scheduling', '15-25%'],
        ['60-74', 'Good Match', 'Standard interview queue', '25-35%'],
        ['45-59', 'Partial Match', 'Review for alternative roles or defer', '20-30%'],
        ['0-44', 'Weak Match', 'Politely decline or archive', '15-25%'],
    ],
    s, [80, 110, 160, 120]
)
story.append(ranking_tbl)
story.append(Spacer(1, 8))

story.append(heading('5.3 Source Analytics', 'H2', s, 1))
story.append(body('AI-powered source analytics track the effectiveness of different recruitment channels:', s))
source_items = [
    '<b>Channel Performance:</b> Track conversion rates from each sourcing channel (job boards, referrals, social media, career site) through the entire hiring funnel.',
    '<b>Quality by Source:</b> Analyze the average candidate quality (as measured by AI screening scores) from each source to optimize recruitment spend.',
    '<b>Cost-Per-Hire Analysis:</b> Calculate the cost-per-hire for each sourcing channel, enabling data-driven budget allocation.',
    '<b>Time-to-Hire by Source:</b> Track how quickly candidates from different sources move through the hiring pipeline.',
    '<b>Retention Correlation:</b> Analyze the correlation between sourcing channel and employee retention to identify channels that produce longer-tenured employees.',
    '<b>Predictive Sourcing:</b> AI recommends optimal sourcing channel mix based on historical performance data for similar roles.'
]
for item in source_items:
    story.append(bullet(item, s))
story.append(Spacer(1, 12))

# ── 6. AI in Performance Management ──
story.append(heading('6. AI in Performance Management', 'H1', s, 0))
story.append(body('AI integration in the Performance Management module provides predictive analytics, skill gap identification, and intelligent recommendations that transform performance management from a reactive, periodic process to a proactive, continuous improvement system.', s))
story.append(Spacer(1, 6))

story.append(heading('6.1 Predictive Analytics', 'H2', s, 1))
story.append(body('The predictive analytics engine uses historical performance data to forecast future outcomes and identify at-risk employees:', s))
predictive_items = [
    '<b>Flight Risk Prediction:</b> AI analyzes patterns in attendance, engagement, performance trends, and compensation data to identify employees at risk of leaving the organization.',
    '<b>Performance Trajectory:</b> Models predict future performance ratings based on historical trends, enabling proactive intervention for declining performers.',
    '<b>Promotion Readiness:</b> AI assesses an employee\'s readiness for promotion based on performance history, skill development, and role requirements alignment.',
    '<b>Attrition Impact Analysis:</b> Predicts the organizational impact of potential employee departures, enabling succession planning.',
    '<b>Team Performance Forecasting:</b> Projects team-level performance based on composition, workload, and historical patterns.',
    '<b>Calibration Assistance:</b> AI identifies potential rating inconsistencies across managers, suggesting calibration adjustments for fairness.'
]
for item in predictive_items:
    story.append(bullet(item, s))
story.append(Spacer(1, 8))

story.append(heading('6.2 Skill Gap Identification', 'H2', s, 1))
story.append(body('The AI skill gap analysis identifies discrepancies between current employee capabilities and organizational needs:', s))
skill_gap = [
    '<b>Current Skill Mapping:</b> AI analyzes employee performance data, training completions, and project histories to build a comprehensive skill profile for each employee.',
    '<b>Required Skill Mapping:</b> Job role requirements and organizational competency frameworks define the target skill set for each position.',
    '<b>Gap Calculation:</b> The system calculates the delta between current and required skills, quantifying gaps by severity and business impact.',
    '<b>Team-Level Aggregation:</b> Skill gaps are aggregated at the team and department levels to identify systemic capability deficiencies.',
    '<b>Priority Ranking:</b> Gaps are ranked by business impact (critical skills missing for key roles) and feasibility (training time and cost to close the gap).',
    '<b>Development Pathways:</b> AI recommends specific training programs, mentorship assignments, and project experiences to close identified skill gaps.'
]
for item in skill_gap:
    story.append(bullet(item, s))
story.append(Spacer(1, 8))

story.append(heading('6.3 Recommendation Engine', 'H2', s, 1))
story.append(body('The recommendation engine generates personalized suggestions for employee development and organizational improvement:', s))
rec_engine = make_table(
    ['Recommendation Type', 'Inputs', 'Output', 'Frequency'],
    [
        ['Training Recommendations', 'Skill gaps, career goals, available courses', 'Personalized learning path', 'Monthly / On-demand'],
        ['Career Path Suggestions', 'Skills, aspirations, organizational needs', 'Suggested career trajectory', 'Quarterly'],
        ['Mentorship Matching', 'Skill gaps, available mentors, compatibility', 'Mentor-mentee pairing', 'As needed'],
        ['Project Assignment', 'Skills, development goals, project needs', 'Optimal project assignment', 'Per project'],
        ['Performance Intervention', 'Declining trends, engagement data', 'Intervention recommendation', 'Real-time alerts'],
        ['Succession Planning', 'Role criticality, employee readiness', 'Succession candidates ranked', 'Semi-annually'],
    ],
    s, [120, 130, 120, 100]
)
story.append(rec_engine)
story.append(Spacer(1, 12))

# ── 7. AI Integration Architecture ──
story.append(heading('7. AI Integration Architecture', 'H1', s, 0))
story.append(body('This section details the technical architecture of AI integration in the NEXUS platform, covering API routes, SDK usage patterns, and data flow between components.', s))
story.append(Spacer(1, 6))

story.append(heading('7.1 API Routes', 'H2', s, 1))
story.append(body('AI functionality is exposed through dedicated Next.js API routes that serve as server-side AI orchestration endpoints:', s))
api_routes = make_table(
    ['Route', 'Method', 'Purpose', 'Authentication'],
    [
        ['/api/ai-interview', 'POST', 'Generate questions, evaluate responses, produce scores', 'JWT Bearer Token'],
        ['/api/ai-interview', 'GET', 'Retrieve interview results and AI feedback', 'JWT Bearer Token'],
        ['/api/ai-chat', 'POST', 'Send message to AI Assistant, receive response', 'JWT Bearer Token'],
        ['/api/ai-chat', 'GET', 'Retrieve chat history for a session', 'JWT Bearer Token'],
        ['/api/ai-admin/config', 'GET/PUT', 'Manage AI model configurations', 'JWT Bearer (Admin only)'],
        ['/api/ai-admin/templates', 'GET/POST/PUT', 'Manage prompt templates', 'JWT Bearer (Admin only)'],
        ['/api/ai-admin/analytics', 'GET', 'Retrieve AI usage and performance metrics', 'JWT Bearer (Admin only)'],
    ],
    s, [110, 50, 190, 120]
)
story.append(api_routes)
story.append(Spacer(1, 8))

story.append(heading('7.2 SDK Usage Patterns', 'H2', s, 1))
story.append(body('The z-ai-web-dev-sdk is used in NEXUS following consistent patterns for reliability and maintainability:', s))
sdk_patterns = [
    '<b>Server-Side Only:</b> All SDK calls are made from server-side API routes, never from client components. This protects API keys and allows server-side rate management.',
    '<b>Request Validation:</b> All AI API routes validate the request payload, user authentication, and authorization before making SDK calls.',
    '<b>Error Handling:</b> SDK calls are wrapped in try-catch blocks with graceful fallback responses when AI services are unavailable.',
    '<b>Token Tracking:</b> Each SDK call tracks input and output token counts for cost management and usage analytics.',
    '<b>Response Validation:</b> AI responses are validated for format and content before being returned to the client or stored in the database.',
    '<b>Caching Strategy:</b> Frequently requested AI-generated content (e.g., common FAQ responses) is cached to reduce SDK calls and costs.',
    '<b>Retry Logic:</b> The SDK implements exponential backoff retry logic for transient failures, with a maximum retry count to prevent indefinite retries.',
    '<b>Timeout Configuration:</b> Each SDK call has a configured timeout to prevent long-running requests from blocking the application.'
]
for pattern in sdk_patterns:
    story.append(bullet(pattern, s))
story.append(Spacer(1, 12))

# ── 8. AI Configuration Guide ──
story.append(heading('8. AI Configuration Guide', 'H1', s, 0))
story.append(body('This section provides practical guidance for configuring AI features in NEXUS HRMS, including prompt engineering best practices, scoring threshold configuration, and model selection strategies.', s))
story.append(Spacer(1, 6))

story.append(heading('8.1 Prompt Engineering Best Practices', 'H2', s, 1))
prompt_practices = [
    '<b>Be Specific and Structured:</b> Provide clear, specific instructions in system prompts. Use structured output formats (JSON) for AI responses that need to be parsed programmatically.',
    '<b>Include Context:</b> Always include relevant context in prompts — job details for interview questions, policy text for assistant responses, scoring rubrics for evaluations.',
    '<b>Define Output Format:</b> Explicitly specify the expected output format, structure, and length. Example: "Generate exactly 5 questions in JSON format with fields: question, category, difficulty, competency."',
    '<b>Set Role and Persona:</b> Define a clear role for the AI in the system prompt. Example: "You are an experienced HR interviewer evaluating candidates for a senior software engineer position."',
    '<b>Use Examples (Few-Shot):</b> Include 1-2 examples of desired input-output pairs in the prompt to guide the AI toward the expected response style and quality.',
    '<b>Add Constraints:</b> Specify what the AI should NOT do. Example: "Do not generate questions about salary expectations. Do not include any biased language regarding age, gender, or ethnicity."',
    '<b>Version Your Prompts:</b> Maintain versioned prompt templates in the AI Admin Console with change logs. This enables A/B testing and rollback if a new prompt version underperforms.',
    '<b>Test Iteratively:</b> Test prompts with diverse inputs before deployment. Evaluate output quality, consistency, and bias across multiple runs with different inputs.'
]
for practice in prompt_practices:
    story.append(bullet(practice, s))
story.append(Spacer(1, 8))

story.append(heading('8.2 Scoring Threshold Configuration', 'H2', s, 1))
story.append(body('Scoring thresholds determine how AI-generated scores are interpreted and what actions are triggered:', s))
threshold_tbl = make_table(
    ['Configuration', 'Default', 'Range', 'Description'],
    [
        ['Interview Pass Threshold', '6.0', '0.0 - 10.0', 'Minimum aiScore for candidate to pass AI interview'],
        ['Auto-Shortlist Threshold', '8.0', '0.0 - 10.0', 'Score above which candidate is auto-shortlisted'],
        ['Auto-Reject Threshold', '3.0', '0.0 - 10.0', 'Score below which candidate is auto-rejected (with review)'],
        ['Bias Alert Threshold', '1.5 std dev', '0.5 - 3.0', 'Standard deviation threshold for bias flagging'],
        ['Confidence Threshold', '0.7', '0.0 - 1.0', 'Minimum AI confidence for auto-processing; below triggers human review'],
        ['Escalation Confidence', '0.4', '0.0 - 1.0', 'Confidence below which AI Assistant escalates to human'],
        ['Screening Score Weight', '0.4', '0.0 - 1.0', 'Weight of AI screening score in composite candidate ranking'],
    ],
    s, [130, 80, 80, 180]
)
story.append(threshold_tbl)
story.append(Spacer(1, 8))

story.append(heading('8.3 Model Selection Guide', 'H2', s, 1))
story.append(body('Selecting the appropriate AI model for each use case balances quality, cost, and latency:', s))
model_guide = make_table(
    ['Use Case', 'Recommended Model', 'Rationale', 'Cost Level'],
    [
        ['Interview Question Generation', 'GPT-4 / Claude Opus', 'High quality, nuanced questions', 'High'],
        ['Response Evaluation & Scoring', 'GPT-4 / Claude Sonnet', 'Accurate, consistent scoring', 'Medium-High'],
        ['Feedback Generation', 'GPT-4 / Claude Sonnet', 'Detailed, constructive feedback', 'Medium-High'],
        ['Chat Assistant (General)', 'GPT-3.5 / Claude Haiku', 'Fast, cost-effective for FAQ', 'Low'],
        ['Chat Assistant (Complex)', 'GPT-4 / Claude Sonnet', 'Complex queries need better reasoning', 'Medium-High'],
        ['Resume Screening', 'GPT-3.5 / Claude Haiku', 'Structured extraction, bulk processing', 'Low-Medium'],
        ['Performance Analytics', 'GPT-4 / Claude Sonnet', 'Nuanced analysis and recommendations', 'Medium-High'],
        ['Bias Detection', 'GPT-4 / Claude Opus', 'Requires strong reasoning for fairness', 'High'],
    ],
    s, [120, 120, 160, 80]
)
story.append(model_guide)
story.append(Spacer(1, 12))

# ── 9. AI Monitoring & Analytics ──
story.append(heading('9. AI Monitoring & Analytics', 'H1', s, 0))
story.append(body('Comprehensive monitoring and analytics are essential for maintaining AI system quality, managing costs, and ensuring ethical AI deployment. This section covers the monitoring framework, key metrics, and analytics capabilities.', s))
story.append(Spacer(1, 6))

story.append(heading('9.1 Usage Tracking', 'H2', s, 1))
usage_metrics = make_table(
    ['Metric', 'Granularity', 'Collection Method', 'Retention'],
    [
        ['API Call Count', 'Per route, per user, per tenant', 'Request logging middleware', '12 months'],
        ['Token Consumption', 'Per call, per module', 'SDK response metadata', '12 months'],
        ['Model Distribution', 'Per module, per model type', 'Configuration + request logging', '12 months'],
        ['User Adoption', 'Per module, per role', 'Feature usage tracking', 'Ongoing'],
        ['Session Metrics', 'Per chat session, per interview', 'Session start/end logging', '6 months'],
        ['Escalation Rate', 'Per module, per reason', 'Escalation event logging', '12 months'],
    ],
    s, [110, 130, 130, 100]
)
story.append(usage_metrics)
story.append(Spacer(1, 8))

story.append(heading('9.2 Cost Analysis', 'H2', s, 1))
story.append(body('Cost analysis provides financial visibility into AI operations:', s))
cost_items = [
    '<b>Per-Request Cost Calculation:</b> Each AI API call cost = (input tokens × input price) + (output tokens × output price) based on the model\'s published pricing.',
    '<b>Monthly Cost Trends:</b> Track month-over-month AI spending by module, model, and tenant to identify cost growth patterns.',
    '<b>Cost Per Outcome:</b> Calculate the cost of AI operations per business outcome (e.g., cost per interview conducted, cost per chat session resolved).',
    '<b>Budget Utilization:</b> Monitor budget consumption against allocated limits with alerting at 50%, 75%, 90%, and 100% thresholds.',
    '<b>Optimization Opportunities:</b> AI-driven identification of cost-saving opportunities such as model downgrades for simple tasks, caching for repeated queries, and batch processing for bulk operations.',
    '<b>ROI Estimation:</b> Estimate the return on AI investment by comparing AI operational costs against time saved, quality improvements, and error reduction metrics.'
]
for item in cost_items:
    story.append(bullet(item, s))
story.append(Spacer(1, 8))

story.append(heading('9.3 Performance Metrics', 'H2', s, 1))
perf_metrics = make_table(
    ['Metric', 'Target', 'Alert Threshold', 'Measurement'],
    [
        ['Average Response Time', '< 3 seconds', '> 5 seconds', 'P50 latency per API route'],
        ['P95 Response Time', '< 8 seconds', '> 12 seconds', 'P95 latency per API route'],
        ['Success Rate', '> 99%', '< 97%', 'Successful responses / total requests'],
        ['Timeout Rate', '< 0.1%', '> 0.5%', 'Timeout errors / total requests'],
        ['Content Filter Rate', '< 1%', '> 3%', 'Filtered responses / total requests'],
        ['User Satisfaction', '> 4.0/5', '< 3.5/5', 'User rating of AI interactions'],
        ['First-Contact Resolution', '> 70%', '< 50%', 'AI-resolved / total chat sessions'],
        ['Escalation Rate', '< 20%', '> 35%', 'Escalated sessions / total sessions'],
    ],
    s, [120, 80, 80, 180]
)
story.append(perf_metrics)
story.append(Spacer(1, 12))

# ── 10. AI Ethics & Bias Mitigation ──
story.append(heading('10. AI Ethics & Bias Mitigation', 'H1', s, 0))
story.append(body('Ethical AI deployment is paramount in an HRMS platform where AI decisions directly impact people\'s careers and livelihoods. NEXUS implements a comprehensive ethics framework and bias mitigation strategy to ensure fair, transparent, and accountable AI operations.', s))
story.append(Spacer(1, 6))

story.append(heading('10.1 Ethical AI Principles', 'H2', s, 1))
ethics_principles = [
    '<b>Fairness:</b> AI systems must treat all individuals equitably regardless of protected characteristics (age, gender, race, religion, disability, etc.). All AI models undergo bias testing before deployment.',
    '<b>Transparency:</b> AI decision-making processes must be explainable. Users affected by AI decisions have the right to understand how the decision was made and what factors were considered.',
    '<b>Accountability:</b> Clear accountability structures must exist for AI decisions. No fully automated decision should be final without human review for high-impact outcomes (hiring, termination, compensation).',
    '<b>Privacy:</b> AI systems must respect data privacy principles, processing only necessary data and maintaining confidentiality. Personal data used for AI training must be anonymized.',
    '<b>Safety:</b> AI systems must be designed to prevent harm. Fail-safe mechanisms ensure that AI errors do not result in adverse outcomes for employees or candidates.',
    '<b>Human Oversight:</b> Critical AI decisions require human oversight. The system is designed as human-in-the-loop, not fully autonomous, for decisions affecting employment outcomes.'
]
for principle in ethics_principles:
    story.append(bullet(principle, s))
story.append(Spacer(1, 8))

story.append(heading('10.2 Bias Mitigation Strategies', 'H2', s, 1))
bias_mitigation = [
    '<b>Debiased Training Data:</b> Ensure training data represents diverse populations. Audit training datasets for representation gaps and augment underrepresented groups.',
    '<b>Blind Processing:</b> Remove personally identifiable information (names, photos, demographics) from AI input where possible to prevent demographic-based scoring variations.',
    '<b>Regular Bias Audits:</b> Conduct quarterly bias audits of all AI models, analyzing score distributions across demographic groups for statistically significant disparities.',
    '<b>Diverse Testing:</b> Test AI systems with diverse input data representing different demographics, communication styles, and backgrounds before deployment.',
    '<b>Adversarial Testing:</b> Intentionally test AI systems with inputs designed to trigger biased outputs, and use findings to improve model behavior.',
    '<b>Human Review Requirement:</b> For interview scoring and candidate ranking, AI results are advisory — final decisions must involve human review. The system enforces this through workflow configuration.',
    '<b>Feedback Loop:</b> Implement a feedback mechanism where users can report perceived bias. All reports are investigated and findings inform model improvements.',
    '<b>Transparency Reports:</b> Publish periodic AI fairness reports showing score distributions, bias detection results, and mitigation actions taken.'
]
for item in bias_mitigation:
    story.append(bullet(item, s))
story.append(Spacer(1, 8))

story.append(heading('10.3 AI Governance Framework', 'H2', s, 1))
story.append(body('The AI Governance Framework establishes organizational structures and processes for responsible AI deployment:', s))
governance_tbl = make_table(
    ['Component', 'Description', 'Responsible Party'],
    [
        ['AI Ethics Committee', 'Reviews and approves AI feature deployments, audits bias reports', 'Leadership + HR + Legal'],
        ['Model Approval Process', 'New models and prompt templates require review before production use', 'AI Admin + Ethics Committee'],
        ['Incident Response', 'Process for handling AI-related incidents (bias reports, errors)', 'HR + AI Admin'],
        ['Regular Audits', 'Quarterly bias and performance audits of all AI features', 'AI Ethics Committee'],
        ['Transparency Obligations', 'Requirements for disclosing AI usage to candidates and employees', 'Legal + HR'],
        ['Continuous Monitoring', 'Ongoing monitoring of AI fairness metrics and performance', 'AI Admin + Engineering'],
    ],
    s, [120, 240, 110]
)
story.append(governance_tbl)

# ── Build ──
doc.multiBuild(story)

cover_pdf = generate_cover('AI<br/>Documentation', 'Module-wise AI Features, Capabilities &amp; Configuration Guide', 'ai_cover')
size = merge_cover_body(cover_pdf, BODY_PATH, OUTPUT_PATH, 'NEXUS HRMS AI Documentation')
print(f'PDF created: {OUTPUT_PATH} ({size:,} bytes)')
