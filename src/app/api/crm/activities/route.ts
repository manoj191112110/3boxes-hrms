import { NextResponse } from 'next/server';

/* ───────────────────────────────────────────────────────────────
   3Boxes HRMS — CRM Activities API
   CRUD operations for CRM activities.
   ─────────────────────────────────────────────────────────────── */

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const type = searchParams.get('type') || 'all';
    const status = searchParams.get('status') || 'all';
    const contact = searchParams.get('contact') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    // Demo data
    const activities = [
      { id: 1, type: 'call', title: 'Discovery call with Rajesh Kumar', description: 'Discussed SaaS platform requirements and pricing expectations.', contact: 'Rajesh Kumar', deal: 'Enterprise SaaS Platform', date: '2025-07-01', time: '10:30 AM', duration: '32 min', status: 'completed', outcome: 'Positive — scheduling follow-up demo', createdBy: 'Arjun Mehta' },
      { id: 2, type: 'email', title: 'Revised proposal sent to DataCore', description: 'Sent updated proposal with revised pricing tiers.', contact: 'Sneha Iyer', deal: 'Cloud Migration Project', date: '2025-07-01', time: '2:15 PM', duration: '', status: 'completed', outcome: 'Awaiting response', createdBy: 'Sneha Iyer' },
      { id: 3, type: 'meeting', title: 'Product demo for GreenLeaf Corp.', description: 'Conducted live product demo for manufacturing use cases.', contact: 'Vikram Patel', deal: 'Digital Transformation', date: '2025-06-30', time: '11:00 AM', duration: '1 hr', status: 'completed', outcome: 'Very engaged — moving to negotiation', createdBy: 'Vikram Patel' },
      { id: 4, type: 'task', title: 'Prepare competitive analysis for MegaSoft', description: 'Research competitor pricing and feature comparisons.', contact: 'Priya Sharma', deal: 'Analytics Platform', date: '2025-07-02', time: '', duration: '', status: 'pending', outcome: '', createdBy: 'Priya Sharma' },
      { id: 7, type: 'meeting', title: 'Quarterly business review with BuildRight', description: 'Q2 performance review.', contact: 'Amit Desai', deal: 'CRM Implementation', date: '2025-07-03', time: '2:00 PM', duration: '1.5 hr', status: 'scheduled', outcome: '', createdBy: 'Arjun Mehta' },
    ];

    let filtered = activities;
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(a => a.title.toLowerCase().includes(q) || a.contact.toLowerCase().includes(q) || a.description.toLowerCase().includes(q));
    }
    if (type !== 'all') filtered = filtered.filter(a => a.type === type);
    if (status !== 'all') filtered = filtered.filter(a => a.status === status);
    if (contact) filtered = filtered.filter(a => a.contact === contact);

    const start = (page - 1) * limit;
    const paged = filtered.slice(start, start + limit);

    const stats = {
      total: activities.length,
      calls: activities.filter(a => a.type === 'call').length,
      emails: activities.filter(a => a.type === 'email').length,
      meetings: activities.filter(a => a.type === 'meeting').length,
      tasks: activities.filter(a => a.type === 'task').length,
      notes: activities.filter(a => a.type === 'note').length,
      completed: activities.filter(a => a.status === 'completed').length,
      pending: activities.filter(a => a.status === 'pending').length,
      scheduled: activities.filter(a => a.status === 'scheduled').length,
    };

    return NextResponse.json({
      activities: paged,
      total: filtered.length,
      page,
      limit,
      totalPages: Math.ceil(filtered.length / limit),
      stats,
    });
  } catch (error) {
    console.error('CRM Activities GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch activities' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, title, description, contact, deal, date, time, duration, outcome } = body;

    if (!title || !date) {
      return NextResponse.json({ error: 'Title and date are required' }, { status: 400 });
    }

    const newActivity = {
      id: Date.now(),
      type: type || 'note',
      title,
      description: description || '',
      contact: contact || '',
      deal: deal || '',
      date,
      time: time || '',
      duration: duration || '',
      status: 'pending',
      outcome: outcome || '',
      createdBy: 'Current User',
      createdAt: new Date().toISOString().split('T')[0],
    };

    return NextResponse.json({ activity: newActivity, message: 'Activity created successfully' }, { status: 201 });
  } catch (error) {
    console.error('CRM Activities POST error:', error);
    return NextResponse.json({ error: 'Failed to create activity' }, { status: 500 });
  }
}
