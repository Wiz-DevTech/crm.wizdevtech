// src/app/api/crm/segments/route.ts

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