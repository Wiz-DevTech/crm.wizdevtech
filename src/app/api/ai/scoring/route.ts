import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { leadId, contactId, dealId, forceRecalculate = false } = body;

    if (!leadId && !contactId && !dealId) {
      return NextResponse.json(
        { error: 'Lead ID, Contact ID, or Deal ID is required' },
        { status: 400 }
      );
    }

    let scoringResult;

    if (leadId) {
      scoringResult = await scoreLead(leadId, forceRecalculate);
    } else if (contactId) {
      scoringResult = await scoreContact(contactId, forceRecalculate);
    } else if (dealId) {
      scoringResult = await scoreDeal(dealId, forceRecalculate);
    }

    return NextResponse.json(scoringResult);
  } catch (error) {
    console.error('Error scoring lead:', error);
    return NextResponse.json(
      { error: 'Failed to score lead' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const entityType = searchParams.get('entityType') || '';
    const minScore = parseInt(searchParams.get('minScore') || '0');

    const where: any = {
      score: { gte: minScore }
    };
    
    if (entityType) {
      where.entityType = entityType;
    }

    const [scores, total] = await Promise.all([
      db.leadScore.findMany({
        where,
        include: {
          lead: {
            select: { id: true, firstName: true, lastName: true, email: true, company: true }
          },
          contact: {
            select: { id: true, firstName: true, lastName: true, email: true, company: true }
          },
          deal: {
            select: { id: true, name: true, value: true, stage: true }
          }
        },
        orderBy: { score: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      db.leadScore.count({ where })
    ]);

    return NextResponse.json({
      scores,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching lead scores:', error);
    return NextResponse.json(
      { error: 'Failed to fetch lead scores' },
      { status: 500 }
    );
  }
}

// Lead Scoring Functions
async function scoreLead(leadId: string, forceRecalculate: boolean = false) {
  // Check if recent score exists
  if (!forceRecalculate) {
    const existingScore = await db.leadScore.findFirst({
      where: {
        leadId,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
      }
    });

    if (existingScore) {
      return existingScore;
    }
  }

  // Get lead data
  const lead = await db.lead.findUnique({
    where: { id: leadId },
    include: {
      assignedUser: true
    }
  });

  if (!lead) {
    throw new Error('Lead not found');
  }

  // Calculate score based on various factors
  const score = calculateLeadScore(lead);
  
  // Save or update score
  const leadScore = await db.leadScore.upsert({
    where: {
      leadId
    },
    update: {
      score: score.total,
      scoreBreakdown: score.breakdown,
      grade: score.grade,
      factors: score.factors,
      lastCalculated: new Date()
    },
    create: {
      leadId,
      entityType: 'LEAD',
      score: score.total,
      scoreBreakdown: score.breakdown,
      grade: score.grade,
      factors: score.factors,
      lastCalculated: new Date()
    }
  });

  // Update lead score if high
  if (score.total >= 80) {
    await db.lead.update({
      where: { id: leadId },
      data: { score: 'HIGH' }
    });
  } else if (score.total >= 50) {
    await db.lead.update({
      where: { id: leadId },
      data: { score: 'MEDIUM' }
    });
  } else {
    await db.lead.update({
      where: { id: leadId },
      data: { score: 'LOW' }
    });
  }

  return leadScore;
}

async function scoreContact(contactId: string, forceRecalculate: boolean = false) {
  // Similar implementation for contacts
  const contact = await db.contact.findUnique({
    where: { id: contactId },
    include: {
      deals: true,
      interactions: true
    }
  });

  if (!contact) {
    throw new Error('Contact not found');
  }

  const score = calculateContactScore(contact);
  
  return await db.leadScore.upsert({
    where: {
      contactId
    },
    update: {
      score: score.total,
      scoreBreakdown: score.breakdown,
      grade: score.grade,
      factors: score.factors,
      lastCalculated: new Date()
    },
    create: {
      contactId,
      entityType: 'CONTACT',
      score: score.total,
      scoreBreakdown: score.breakdown,
      grade: score.grade,
      factors: score.factors,
      lastCalculated: new Date()
    }
  });
}

async function scoreDeal(dealId: string, forceRecalculate: boolean = false) {
  // Similar implementation for deals
  const deal = await db.deal.findUnique({
    where: { id: dealId },
    include: {
      contact: true,
      tasks: true
    }
  });

  if (!deal) {
    throw new Error('Deal not found');
  }

  const score = calculateDealScore(deal);
  
  return await db.leadScore.upsert({
    where: {
      dealId
    },
    update: {
      score: score.total,
      scoreBreakdown: score.breakdown,
      grade: score.grade,
      factors: score.factors,
      lastCalculated: new Date()
    },
    create: {
      dealId,
      entityType: 'DEAL',
      score: score.total,
      scoreBreakdown: score.breakdown,
      grade: score.grade,
      factors: score.factors,
      lastCalculated: new Date()
    }
  });
}

// Scoring Algorithms
function calculateLeadScore(lead: any) {
  let score = 0;
  const breakdown: any = {};
  const factors: string[] = [];

  // Email domain quality (10 points)
  if (lead.email) {
    const domain = lead.email.split('@')[1];
    if (domain && !domain.includes('gmail') && !domain.includes('yahoo') && !domain.includes('hotmail')) {
      score += 10;
      breakdown.emailDomain = 10;
      factors.push('Professional email domain');
    }
  }

  // Company information (15 points)
  if (lead.company) {
    score += 15;
    breakdown.companyInfo = 15;
    factors.push('Company provided');
  }

  // Source quality (20 points)
  const sourceScores: Record<string, number> = {
    'WEBSITE': 20,
    'REFERRAL': 25,
    'PAID_AD': 15,
    'SOCIAL': 10,
    'EMAIL': 12,
    'PHONE': 18,
    'CONTENT': 22,
    'OTHER': 5
  };
  
  if (lead.source && sourceScores[lead.source]) {
    score += sourceScores[lead.source];
    breakdown.source = sourceScores[lead.source];
    factors.push(`Quality source: ${lead.source}`);
  }

  // Status progression (20 points)
  const statusScores: Record<string, number> = {
    'NEW': 5,
    'CONTACTED': 10,
    'QUALIFIED': 20,
    'CONVERTED': 25,
    'UNQUALIFIED': 0
  };
  
  if (lead.status && statusScores[lead.status]) {
    score += statusScores[lead.status];
    breakdown.status = statusScores[lead.status];
    factors.push(`Status: ${lead.status}`);
  }

  // Assigned user (10 points)
  if (lead.assignedTo) {
    score += 10;
    breakdown.assignedUser = 10;
    factors.push('Assigned to sales rep');
  }

  // Recent activity (15 points)
  const daysSinceCreation = Math.floor((Date.now() - new Date(lead.createdAt).getTime()) / (1000 * 60 * 60 * 24));
  if (daysSinceCreation <= 7) {
    score += 15;
    breakdown.recentActivity = 15;
    factors.push('Recent lead (within 7 days)');
  } else if (daysSinceCreation <= 30) {
    score += 10;
    breakdown.recentActivity = 10;
    factors.push('Recent lead (within 30 days)');
  }

  // Phone number provided (10 points)
  if (lead.phone) {
    score += 10;
    breakdown.phoneProvided = 10;
    factors.push('Phone number provided');
  }

  // Determine grade
  let grade: string;
  if (score >= 80) grade = 'A';
  else if (score >= 60) grade = 'B';
  else if (score >= 40) grade = 'C';
  else if (score >= 20) grade = 'D';
  else grade = 'F';

  return {
    total: Math.min(score, 100),
    breakdown,
    grade,
    factors
  };
}

function calculateContactScore(contact: any) {
  let score = 0;
  const breakdown: any = {};
  const factors: string[] = [];

  // Deal value potential (30 points)
  const totalDealValue = contact.deals?.reduce((sum: number, deal: any) => sum + (deal.value || 0), 0) || 0;
  if (totalDealValue > 50000) {
    score += 30;
    breakdown.dealValue = 30;
    factors.push('High-value deals');
  } else if (totalDealValue > 10000) {
    score += 20;
    breakdown.dealValue = 20;
    factors.push('Medium-value deals');
  } else if (totalDealValue > 0) {
    score += 10;
    breakdown.dealValue = 10;
    factors.push('Low-value deals');
  }

  // Interaction frequency (25 points)
  const interactionCount = contact.interactions?.length || 0;
  if (interactionCount >= 10) {
    score += 25;
    breakdown.interactions = 25;
    factors.push('High engagement');
  } else if (interactionCount >= 5) {
    score += 15;
    breakdown.interactions = 15;
    factors.push('Medium engagement');
  } else if (interactionCount >= 2) {
    score += 8;
    breakdown.interactions = 8;
    factors.push('Low engagement');
  }

  // Contact status (20 points)
  const statusScores: Record<string, number> = {
    'VIP': 25,
    'ACTIVE': 20,
    'NEW': 15,
    'INACTIVE': 5,
    'CHURNED': 0
  };
  
  if (contact.status && statusScores[contact.status]) {
    score += statusScores[contact.status];
    breakdown.status = statusScores[contact.status];
    factors.push(`Status: ${contact.status}`);
  }

  // Contact type (15 points)
  const typeScores: Record<string, number> = {
    'CUSTOMER': 20,
    'PARTNER': 18,
    'PROSPECT': 12,
    'VENDOR': 8
  };
  
  if (contact.type && typeScores[contact.type]) {
    score += typeScores[contact.type];
    breakdown.type = typeScores[contact.type];
    factors.push(`Type: ${contact.type}`);
  }

  // Company information (10 points)
  if (contact.company) {
    score += 10;
    breakdown.company = 10;
    factors.push('Company information');
  }

  let grade: string;
  if (score >= 80) grade = 'A';
  else if (score >= 60) grade = 'B';
  else if (score >= 40) grade = 'C';
  else if (score >= 20) grade = 'D';
  else grade = 'F';

  return {
    total: Math.min(score, 100),
    breakdown,
    grade,
    factors
  };
}

function calculateDealScore(deal: any) {
  let score = 0;
  const breakdown: any = {};
  const factors: string[] = [];

  // Deal value (30 points)
  if (deal.value >= 100000) {
    score += 30;
    breakdown.value = 30;
    factors.push('High-value deal');
  } else if (deal.value >= 50000) {
    score += 25;
    breakdown.value = 25;
    factors.push('Medium-high value deal');
  } else if (deal.value >= 10000) {
    score += 15;
    breakdown.value = 15;
    factors.push('Medium value deal');
  } else if (deal.value > 0) {
    score += 8;
    breakdown.value = 8;
    factors.push('Low value deal');
  }

  // Deal stage (25 points)
  const stageScores: Record<string, number> = {
    'NEGOTIATION': 30,
    'PROPOSAL': 25,
    'QUALIFIED': 20,
    'LEAD': 10,
    'CLOSED_WON': 35,
    'CLOSED_LOST': 0
  };
  
  if (deal.stage && stageScores[deal.stage]) {
    score += stageScores[deal.stage];
    breakdown.stage = stageScores[deal.stage];
    factors.push(`Stage: ${deal.stage}`);
  }

  // Priority (20 points)
  const priorityScores: Record<string, number> = {
    'URGENT': 25,
    'HIGH': 20,
    'MEDIUM': 12,
    'LOW': 5
  };
  
  if (deal.priority && priorityScores[deal.priority]) {
    score += priorityScores[deal.priority];
    breakdown.priority = priorityScores[deal.priority];
    factors.push(`Priority: ${deal.priority}`);
  }

  // Probability (15 points)
  if (deal.probability >= 80) {
    score += 15;
    breakdown.probability = 15;
    factors.push('High probability');
  } else if (deal.probability >= 50) {
    score += 10;
    breakdown.probability = 10;
    factors.push('Medium probability');
  } else if (deal.probability >= 20) {
    score += 5;
    breakdown.probability = 5;
    factors.push('Low probability');
  }

  // Expected close date (10 points)
  if (deal.expectedCloseDate) {
    const daysToClose = Math.floor((new Date(deal.expectedCloseDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysToClose <= 30 && daysToClose >= 0) {
      score += 10;
      breakdown.closeDate = 10;
      factors.push('Closing soon');
    } else if (daysToClose <= 90 && daysToClose >= 0) {
      score += 5;
      breakdown.closeDate = 5;
      factors.push('Closing this quarter');
    }
  }

  let grade: string;
  if (score >= 80) grade = 'A';
  else if (score >= 60) grade = 'B';
  else if (score >= 40) grade = 'C';
  else if (score >= 20) grade = 'D';
  else grade = 'F';

  return {
    total: Math.min(score, 100),
    breakdown,
    grade,
    factors
  };
}