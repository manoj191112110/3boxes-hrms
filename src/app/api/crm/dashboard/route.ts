import { NextResponse } from 'next/server';

/* ───────────────────────────────────────────────────────────────
   3Boxes HRMS — CRM Dashboard API
   Returns aggregated CRM statistics for the dashboard.
   ─────────────────────────────────────────────────────────────── */

export async function GET() {
  try {
    // Demo data — in production, aggregate from database
    const stats = {
      totalContacts: 1248,
      activeDeals: 86,
      pipelineValue: 24500000,
      wonThisMonth: 12,
      lostThisMonth: 5,
      winRate: 70.6,
    };

    const pipelineByStage = [
      { stage: 'Qualification', value: 4200000, count: 24 },
      { stage: 'Proposal', value: 7800000, count: 18 },
      { stage: 'Negotiation', value: 6300000, count: 10 },
      { stage: 'Closed Won', value: 12200000, count: 48 },
      { stage: 'Closed Lost', value: 4700000, count: 22 },
    ];

    const monthlyRevenue = [
      { month: 'Jul', revenue: 2800000 },
      { month: 'Aug', revenue: 3500000 },
      { month: 'Sep', revenue: 3100000 },
      { month: 'Oct', revenue: 4200000 },
      { month: 'Nov', revenue: 3800000 },
      { month: 'Dec', revenue: 5100000 },
      { month: 'Jan', revenue: 4700000 },
      { month: 'Feb', revenue: 5500000 },
      { month: 'Mar', revenue: 6100000 },
      { month: 'Apr', revenue: 5800000 },
      { month: 'May', revenue: 6400000 },
      { month: 'Jun', revenue: 7200000 },
    ];

    const leadSources = [
      { name: 'Website', value: 320 },
      { name: 'Referral', value: 245 },
      { name: 'LinkedIn', value: 180 },
      { name: 'Events', value: 125 },
      { name: 'Cold Call', value: 88 },
      { name: 'Other', value: 52 },
    ];

    return NextResponse.json({
      stats,
      pipelineByStage,
      monthlyRevenue,
      leadSources,
    });
  } catch (error) {
    console.error('CRM Dashboard API error:', error);
    return NextResponse.json({ error: 'Failed to fetch CRM dashboard data' }, { status: 500 });
  }
}
