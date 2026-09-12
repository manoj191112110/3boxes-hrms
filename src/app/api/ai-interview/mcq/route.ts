import { NextRequest, NextResponse } from 'next/server';

// POST /api/ai-interview/mcq — Generate MCQ questions
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { jobTitle, difficulty = 'medium', category } = body;

    // Generate MCQ questions based on job title and category
    const questions = generateMCQQuestions(jobTitle || 'Software Engineer', difficulty, category);

    return NextResponse.json({ questions });
  } catch (error: unknown) {
    console.error('MCQ generation error:', error);
    return NextResponse.json({ error: 'Failed to generate questions' }, { status: 500 });
  }
}

function generateMCQQuestions(jobTitle: string, difficulty: string, category?: string): unknown[] {
  const questionBank: Record<string, unknown[]> = {
    'Software Engineer': [
      {
        id: 'mcq-1',
        question: 'Which data structure provides O(1) average time complexity for insertions and lookups?',
        options: ['Array', 'Linked List', 'Hash Table', 'Binary Search Tree'],
        correctIndex: 2,
        explanation: 'Hash tables provide O(1) average time complexity for both insertions and lookups using hashing.',
        category: 'Data Structures',
        difficulty: 'easy',
      },
      {
        id: 'mcq-2',
        question: 'What is the time complexity of binary search on a sorted array?',
        options: ['O(n)', 'O(log n)', 'O(n log n)', 'O(1)'],
        correctIndex: 1,
        explanation: 'Binary search divides the search space in half with each step, giving O(log n) time complexity.',
        category: 'Algorithms',
        difficulty: 'easy',
      },
      {
        id: 'mcq-3',
        question: 'In a microservices architecture, which pattern helps prevent cascading failures?',
        options: ['Singleton Pattern', 'Circuit Breaker Pattern', 'Observer Pattern', 'Factory Pattern'],
        correctIndex: 1,
        explanation: 'The Circuit Breaker pattern detects failures and prevents cascading by stopping requests to failing services.',
        category: 'System Design',
        difficulty: 'medium',
      },
      {
        id: 'mcq-4',
        question: 'What does the CAP theorem state about distributed systems?',
        options: [
          'They can achieve Consistency, Availability, and Partition tolerance simultaneously',
          'They can achieve at most 2 of: Consistency, Availability, Partition tolerance',
          'They must sacrifice Performance for Consistency',
          'They can only be Either Consistent or Available'
        ],
        correctIndex: 1,
        explanation: 'The CAP theorem states that in a distributed system, you can only guarantee two of three properties: Consistency, Availability, and Partition tolerance.',
        category: 'System Design',
        difficulty: 'medium',
      },
      {
        id: 'mcq-5',
        question: 'Which HTTP method is idempotent?',
        options: ['POST', 'PATCH', 'PUT', 'None of the above'],
        correctIndex: 2,
        explanation: 'PUT is idempotent — making the same request multiple times produces the same result as making it once.',
        category: 'Web Development',
        difficulty: 'easy',
      },
      {
        id: 'mcq-6',
        question: 'What is the primary benefit of using a message queue in a distributed system?',
        options: [
          'Faster database queries',
          'Decoupling services and asynchronous processing',
          'Reduced memory usage',
          'Better UI rendering performance'
        ],
        correctIndex: 1,
        explanation: 'Message queues decouple services by enabling asynchronous communication, improving reliability and scalability.',
        category: 'System Design',
        difficulty: 'medium',
      },
      {
        id: 'mcq-7',
        question: 'In React, what hook is used to perform side effects in function components?',
        options: ['useState', 'useMemo', 'useEffect', 'useRef'],
        correctIndex: 2,
        explanation: 'useEffect is the hook designed for performing side effects like data fetching, subscriptions, or DOM manipulation.',
        category: 'Frontend',
        difficulty: 'easy',
      },
      {
        id: 'mcq-8',
        question: 'Which database indexing technique is best for range queries?',
        options: ['Hash Index', 'B-Tree Index', 'Bitmap Index', 'Full-text Index'],
        correctIndex: 1,
        explanation: 'B-Tree indexes maintain sorted order, making them ideal for range queries (e.g., WHERE age BETWEEN 25 AND 35).',
        category: 'Databases',
        difficulty: 'medium',
      },
      {
        id: 'mcq-9',
        question: 'What is the purpose of a load balancer in a web application architecture?',
        options: [
          'Encrypt data in transit',
          'Distribute incoming traffic across multiple servers',
          'Cache frequently accessed data',
          'Compress response payloads'
        ],
        correctIndex: 1,
        explanation: 'A load balancer distributes incoming network traffic across multiple servers to ensure no single server is overwhelmed.',
        category: 'Infrastructure',
        difficulty: 'easy',
      },
      {
        id: 'mcq-10',
        question: 'What is the difference between Docker containers and virtual machines?',
        options: [
          'Containers share the host OS kernel; VMs have their own OS',
          'Containers are slower than VMs',
          'VMs are more portable than containers',
          'There is no significant difference'
        ],
        correctIndex: 0,
        explanation: 'Containers share the host OS kernel, making them lightweight and fast. VMs include a full OS, making them heavier but more isolated.',
        category: 'DevOps',
        difficulty: 'medium',
      },
    ],
  };

  // Get questions for the job title, or fall back to software engineer questions
  const questions = questionBank[jobTitle] || questionBank['Software Engineer'];

  // Filter by difficulty if specified
  if (difficulty && difficulty !== 'all') {
    return questions.filter((q: Record<string, unknown>) => q.difficulty === difficulty);
  }

  // Filter by category if specified
  if (category) {
    return questions.filter((q: Record<string, unknown>) => q.category === category);
  }

  return questions;
}
