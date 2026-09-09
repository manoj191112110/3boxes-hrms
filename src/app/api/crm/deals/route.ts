import { NextResponse } from 'next/server';

/* ───────────────────────────────────────────────────────────────
   3Boxes HRMS — CRM Deals API
   CRUD operations for CRM deals.
   ─────────────────────────────────────────────────────────────── */

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const stage = searchParams.get('stage') || 'All';
    const owner = searchParams.get('owner') || 'All';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    // Demo data
    const deals = [
      { id: 1, name: 'Enterprise SaaS Platform', contact: 'Rajesh Kumar', company: 'TechVista Solutions', value: 4200000, stage: 'Negotiation', probability: 85, closeDate: '2025-07-15', owner: 'Arjun Mehta' },
      { id: 2, name: 'Cloud Migration Project', contact: 'Sneha Iyer', company: 'DataCore Inc.', value: 2800000, stage: 'Proposal', probability: 60, closeDate: '2025-08-01', owner: 'Sneha Iyer' },
      { id: 3, name: 'Digital Transformation', contact: 'Vikram Patel', company: 'GreenLeaf Corp.', value: 3500000, stage: 'Negotiation', probability: 75, closeDate: '2025-07-20', owner: 'Vikram Patel' },
      { id: 4, name: 'Analytics Platform', contact: 'Priya Sharma', company: 'MegaSoft Ltd.', value: 1900000, stage: 'Qualified', probability: 40, closeDate: '2025-09-10', owner: 'Priya Sharma' },
      { id: 5, name: 'CRM Implementation', contact: 'Amit Desai', company: 'BuildRight Inc.', value: 1200000, stage: 'Proposal', probability: 55, closeDate: '2025-08-15', owner: 'Arjun Mehta' },
      { id: 8, name: 'Data Warehouse', contact: 'Nisha Patel', company: 'InfoBase Analytics', value: 3100000, stage: 'Closed Won', probability: 100, closeDate: '2025-06-20', owner: 'Arjun Mehta' },
      { id: 9, name: 'Security Audit', contact: 'Kiran Joshi', company: 'SafeNet', value: 680000, stage: 'Closed Lost', probability: 0, closeDate: '2025-06-10', owner: 'Sneha Iyer' },
    ];

    let filtered = deals;
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(d => d.name.toLowerCase().includes(q) || d.company.toLowerCase().includes(q) || d.contact.toLowerCase().includes(q));
    }
    if (stage !== 'All') filtered = filtered.filter(d => d.stage === stage);
    if (owner !== 'All') filtered = filtered.filter(d => d.owner === owner);

    const start = (page - 1) * limit;
    const paged = filtered.slice(start, start + limit);

    // Stats
    const active = filtered.filter(d => !['Closed Won', 'Closed Lost'].includes(d.stage));
    const won = filtered.filter(d => d.stage === 'Closed Won');
    const lost = filtered.filter(d => d.stage === 'Closed Lost');
    const totalPipeline = active.reduce((s, d) => s + d.value, 0);
    const weightedPipeline = active.reduce((s, d) => s + (d.value * d.probability / 100), 0);
    const winRate = (won.length + lost.length) > 0 ? (won.length / (won.length + lost.length)) * 100 : 0;

    return NextResponse.json({
      deals: paged,
      total: filtered.length,
      page,
      limit,
      totalPages: Math.ceil(filtered.length / limit),
      stats: { totalPipeline, weightedPipeline, avgDealSize: active.length ? totalPipeline / active.length : 0, winRate, wonCount: won.length, lostCount: lost.length, activeCount: active.length },
    });
  } catch (error) {
    console.error('CRM Deals GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch deals' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, contact, value, stage, probability, closeDate, description } = body;

    if (!name || !value) {
      return NextResponse.json({ error: 'Deal name and value are required' }, { status: 400 });
    }

    const newDeal = {
      id: Date.now(),
      name,
      contact: contact || '',
      company: '',
      value: parseInt(value) || 0,
      stage: stage || 'Lead',
      probability: parseInt(probability) || 0,
      closeDate: closeDate || 'TBD',
      owner: 'Current User',
      description: description || '',
      createdAt: new Date().toISOString().split('T')[0],
    };

    return NextResponse.json({ deal: newDeal, message: 'Deal created successfully' }, { status: 201 });
  } catch (error) {
    console.error('CRM Deals POST error:', error);
    return NextResponse.json({ error: 'Failed to create deal' }, { status: 500 });
  }
}
