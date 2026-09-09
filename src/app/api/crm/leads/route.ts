import { NextResponse } from 'next/server';

/* ───────────────────────────────────────────────────────────────
   3Boxes HRMS — CRM Leads API
   CRUD operations for CRM leads.
   ─────────────────────────────────────────────────────────────── */

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || 'All';
    const source = searchParams.get('source') || 'All';
    const temperature = searchParams.get('temperature') || 'All';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    // Demo data
    const leads = [
      { id: 1, firstName: 'Arun', lastName: 'Mehta', email: 'arun@zenith.com', company: 'Zenith Corp.', source: 'Website', status: 'New', score: 82, temperature: 'Hot', assignedTo: 'Arjun Mehta', estimatedValue: 2500000 },
      { id: 2, firstName: 'Deepa', lastName: 'Reddy', email: 'deepa@pinnacle.com', company: 'Pinnacle Systems', source: 'Referral', status: 'Contacted', score: 71, temperature: 'Hot', assignedTo: 'Vikram Patel', estimatedValue: 1800000 },
      { id: 3, firstName: 'Suresh', lastName: 'Menon', email: 'suresh@apex.com', company: 'Apex Industries', source: 'LinkedIn', status: 'Qualified', score: 65, temperature: 'Warm', assignedTo: 'Priya Sharma', estimatedValue: 3200000 },
      { id: 4, firstName: 'Ritu', lastName: 'Bhat', email: 'ritu@novatech.com', company: 'NovaTech', source: 'Events', status: 'Contacted', score: 48, temperature: 'Warm', assignedTo: 'Arjun Mehta', estimatedValue: 950000 },
      { id: 5, firstName: 'Kiran', lastName: 'Joshi', email: 'kiran@orion.com', company: 'Orion Labs', source: 'Cold Call', status: 'Unqualified', score: 25, temperature: 'Cold', assignedTo: 'Sneha Iyer', estimatedValue: 0 },
      { id: 9, firstName: 'Ravi', lastName: 'Kumar', email: 'ravi@innovate.com', company: 'Innovate Solutions', source: 'Events', status: 'Converted', score: 95, temperature: 'Hot', assignedTo: 'Vikram Patel', estimatedValue: 3500000 },
    ];

    let filtered = leads;
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(l => `${l.firstName} ${l.lastName}`.toLowerCase().includes(q) || l.company.toLowerCase().includes(q));
    }
    if (status !== 'All') filtered = filtered.filter(l => l.status === status);
    if (source !== 'All') filtered = filtered.filter(l => l.source === source);
    if (temperature !== 'All') filtered = filtered.filter(l => l.temperature === temperature);

    const start = (page - 1) * limit;
    const paged = filtered.slice(start, start + limit);

    const stats = {
      total: leads.length,
      new: leads.filter(l => l.status === 'New').length,
      contacted: leads.filter(l => l.status === 'Contacted').length,
      qualified: leads.filter(l => l.status === 'Qualified').length,
      converted: leads.filter(l => l.status === 'Converted').length,
      unqualified: leads.filter(l => l.status === 'Unqualified').length,
      hot: leads.filter(l => l.temperature === 'Hot').length,
      avgScore: leads.length ? Math.round(leads.reduce((s, l) => s + l.score, 0) / leads.length) : 0,
      conversionRate: leads.length ? ((leads.filter(l => l.status === 'Converted').length / leads.length) * 100).toFixed(1) : '0',
    };

    return NextResponse.json({
      leads: paged,
      total: filtered.length,
      page,
      limit,
      totalPages: Math.ceil(filtered.length / limit),
      stats,
    });
  } catch (error) {
    console.error('CRM Leads GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { firstName, lastName, email, phone, company, source, score, assignedTo } = body;

    if (!firstName || !lastName || !email) {
      return NextResponse.json({ error: 'First name, last name, and email are required' }, { status: 400 });
    }

    const parsedScore = parseInt(score) || 50;
    const temperature = parsedScore >= 70 ? 'Hot' : parsedScore >= 40 ? 'Warm' : 'Cold';

    const newLead = {
      id: Date.now(),
      firstName,
      lastName,
      email,
      phone: phone || '',
      company: company || '',
      source: source || 'Website',
      status: 'New',
      score: parsedScore,
      temperature,
      assignedTo: assignedTo || 'Unassigned',
      createdAt: new Date().toISOString().split('T')[0],
    };

    return NextResponse.json({ lead: newLead, message: 'Lead created successfully' }, { status: 201 });
  } catch (error) {
    console.error('CRM Leads POST error:', error);
    return NextResponse.json({ error: 'Failed to create lead' }, { status: 500 });
  }
}
