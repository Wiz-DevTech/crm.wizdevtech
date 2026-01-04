import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/crm/segments - List customer segments
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';

    const where = {
      ...(search && {
        name: { contains: search }
      })
    };

    const [segments, total] = await Promise.all([
      db.customerSegment.findMany({
        where,
        include: {
          creator: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      db.customerSegment.count({ where })
    ]);

    // Add contact count to each segment
    const segmentsWithContactCount = await Promise.all(
      segments.map(async (segment) => {
        const contactIds = JSON.parse(segment.contactIds || '[]');
        const contacts = await db.contact.findMany({
          where: { id: { in: contactIds } },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            company: true,
            status: true
          }
        });

        return {
          ...segment,
          contactCount: contacts.length,
          sampleContacts: contacts.slice(0, 5) // Show first 5 contacts as sample
        };
      })
    );

    return NextResponse.json({
      segments: segmentsWithContactCount,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching customer segments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch customer segments' },
      { status: 500 }
    );
  }
}

// POST /api/crm/segments - Create new customer segment
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      description,
      criteria,
      createdBy
    } = body;

    // Validate required fields
    if (!name || !criteria || !createdBy) {
      return NextResponse.json(
        { error: 'Name, criteria, and createdBy are required' },
        { status: 400 }
      );
    }

    // Parse and validate criteria
    let parsedCriteria;
    try {
      parsedCriteria = typeof criteria === 'string' ? JSON.parse(criteria) : criteria;
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid criteria format' },
        { status: 400 }
      );
    }

    // Find contacts matching the criteria
    const matchingContacts = await findContactsByCriteria(parsedCriteria);

    const segment = await db.customerSegment.create({
      data: {
        name,
        description,
        criteria: JSON.stringify(parsedCriteria),
        contactIds: JSON.stringify(matchingContacts.map(c => c.id)),
        createdBy
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    return NextResponse.json({
      ...segment,
      contactCount: matchingContacts.length
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating customer segment:', error);
    return NextResponse.json(
      { error: 'Failed to create customer segment' },
      { status: 500 }
    );
  }
}

// POST /api/crm/segments/analyze - Analyze and suggest segments
export async function POST(request: NextRequest) {
  try {
    // Get all contacts for analysis
    const contacts = await db.contact.findMany({
      select: {
        id: true,
        company: true,
        status: true,
        source: true,
        createdAt: true
      }
    });

    // Get deals for analysis
    const deals = await db.deal.findMany({
      include: {
        contact: {
          select: {
            id: true,
            company: true,
            status: true
          }
        }
      }
    });

    // AI-powered segmentation analysis
    const suggestions = generateSegmentSuggestions(contacts, deals);

    return NextResponse.json({
      suggestions,
      totalContacts: contacts.length,
      totalDeals: deals.length
    });
  } catch (error) {
    console.error('Error analyzing segments:', error);
    return NextResponse.json(
      { error: 'Failed to analyze segments' },
      { status: 500 }
    );
  }
}

// Find contacts by criteria
async function findContactsByCriteria(criteria: any) {
  const where: any = {};

  // Build where clause based on criteria
  if (criteria.status && criteria.status.length > 0) {
    where.status = { in: criteria.status };
  }

  if (criteria.source && criteria.source.length > 0) {
    where.source = { in: criteria.source };
  }

  if (criteria.company) {
    if (criteria.company.includes) {
      where.company = { contains: criteria.company.includes };
    }
    if (criteria.company.excludes) {
      where.company = { not: { contains: criteria.company.excludes } };
    }
  }

  if (criteria.dateRange) {
    where.createdAt = {};
    if (criteria.dateRange.from) {
      where.createdAt.gte = new Date(criteria.dateRange.from);
    }
    if (criteria.dateRange.to) {
      where.createdAt.lte = new Date(criteria.dateRange.to);
    }
  }

  if (criteria.hasDeals !== undefined) {
    if (criteria.hasDeals) {
      // Find contacts that have deals
      const contactsWithDeals = await db.deal.findMany({
        select: { contactId: true },
        distinct: ['contactId']
      });
      where.id = { in: contactsWithDeals.map(d => d.contactId) };
    } else {
      // Find contacts without deals
      const contactsWithDeals = await db.deal.findMany({
        select: { contactId: true },
        distinct: ['contactId']
      });
      where.id = { not: { in: contactsWithDeals.map(d => d.contactId) } };
    }
  }

  if (criteria.dealValue) {
    const contactIds = await db.deal.findMany({
      where: {
        value: {
          gte: criteria.dealValue.min || 0,
          lte: criteria.dealValue.max || 999999999
        }
      },
      select: { contactId: true },
      distinct: ['contactId']
    });
    where.id = { in: contactIds.map(d => d.contactId) };
  }

  return await db.contact.findMany({
    where,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      company: true,
      status: true,
      source: true
    }
  });
}

// AI-powered segment suggestions
function generateSegmentSuggestions(contacts: any[], deals: any[]) {
  const suggestions = [];

  // Analyze by company size (if available)
  const companies = contacts.filter(c => c.company).map(c => c.company);
  const uniqueCompanies = [...new Set(companies)];
  
  if (uniqueCompanies.length > 5) {
    suggestions.push({
      name: 'Enterprise Customers',
      description: 'Contacts from large companies',
      criteria: {
        company: { includes: 'Corp' }, // Simple heuristic
        status: ['ACTIVE']
      },
      estimatedSize: Math.floor(uniqueCompanies.length * 0.2)
    });
  }

  // Analyze by status
  const statusCounts = contacts.reduce((acc: any, contact) => {
    acc[contact.status] = (acc[contact.status] || 0) + 1;
    return acc;
  }, {});

  if (statusCounts.LEAD > 10) {
    suggestions.push({
      name: 'New Leads',
      description: 'Contacts that are still in lead status',
      criteria: {
        status: ['LEAD'],
        dateRange: {
          from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        }
      },
      estimatedSize: statusCounts.LEAD
    });
  }

  // Analyze by source
  const sourceCounts = contacts.reduce((acc: any, contact) => {
    if (contact.source) {
      acc[contact.source] = (acc[contact.source] || 0) + 1;
    }
    return acc;
  }, {});

  Object.entries(sourceCounts).forEach(([source, count]) => {
    if (count > 5) {
      suggestions.push({
        name: `${source} Sources`,
        description: `Contacts acquired from ${source}`,
        criteria: {
          source: [source]
        },
        estimatedSize: count as number
      });
    }
  });

  // Analyze by deal history
  const contactsWithDeals = deals.map(d => d.contact.id);
  const contactsWithoutDeals = contacts.filter(c => !contactsWithDeals.includes(c.id));

  if (contactsWithoutDeals.length > 10) {
    suggestions.push({
      name: 'Untapped Potential',
      description: 'Contacts without any deals yet',
      criteria: {
        hasDeals: false
      },
      estimatedSize: contactsWithoutDeals.length
    });
  }

  // High-value contacts
  const highValueContacts = deals
    .filter(d => d.value && d.value > 10000)
    .map(d => d.contact.id);

  if (highValueContacts.length > 0) {
    suggestions.push({
      name: 'High Value Prospects',
      description: 'Contacts with deals worth over $10,000',
      criteria: {
        dealValue: { min: 10000 }
      },
      estimatedSize: [...new Set(highValueContacts)].length
    });
  }

  return suggestions.slice(0, 6); // Return top 6 suggestions
}