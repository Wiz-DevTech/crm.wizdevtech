import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/crm/calendar - List calendar events
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const createdBy = searchParams.get('createdBy');

    const where: any = {};
    
    if (startDate || endDate) {
      where.startTime = {};
      if (startDate) where.startTime.gte = new Date(startDate);
      if (endDate) where.startTime.lte = new Date(endDate);
    }
    
    if (type) where.type = type;
    if (status) where.status = status;
    if (createdBy) where.createdBy = createdBy;

    const [events, total] = await Promise.all([
      db.calendarEvent.findMany({
        where,
        include: {
          creator: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          contact: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          deal: {
            select: {
              id: true,
              title: true,
              value: true,
              currency: true
            }
          }
        },
        orderBy: { startTime: 'asc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      db.calendarEvent.count({ where })
    ]);

    return NextResponse.json({
      events,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch calendar events' },
      { status: 500 }
    );
  }
}

// POST /api/crm/calendar - Create new calendar event
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      title,
      description,
      startTime,
      endTime,
      location,
      isAllDay,
      type,
      provider,
      externalId,
      contactId,
      dealId,
      createdBy
    } = body;

    // Validate required fields
    if (!title || !startTime || !endTime || !type || !createdBy) {
      return NextResponse.json(
        { error: 'Title, startTime, endTime, type, and createdBy are required' },
        { status: 400 }
      );
    }

    // Validate time range
    const start = new Date(startTime);
    const end = new Date(endTime);
    
    if (end <= start) {
      return NextResponse.json(
        { error: 'End time must be after start time' },
        { status: 400 }
      );
    }

    // Verify contact exists if provided
    if (contactId) {
      const contact = await db.contact.findUnique({
        where: { id: contactId }
      });

      if (!contact) {
        return NextResponse.json(
          { error: 'Contact not found' },
          { status: 404 }
        );
      }
    }

    // Verify deal exists if provided
    if (dealId) {
      const deal = await db.deal.findUnique({
        where: { id: dealId }
      });

      if (!deal) {
        return NextResponse.json(
          { error: 'Deal not found' },
          { status: 404 }
        );
      }
    }

    const event = await db.calendarEvent.create({
      data: {
        title,
        description,
        startTime: start,
        endTime: end,
        location,
        isAllDay: isAllDay || false,
        type,
        provider,
        externalId,
        contactId,
        dealId,
        createdBy
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        deal: {
          select: {
            id: true,
            title: true,
            value: true,
            currency: true
          }
        }
      }
    });

    // TODO: If provider is specified, sync with external calendar
    // This would integrate with Google Calendar API, Outlook Calendar API, etc.

    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    console.error('Error creating calendar event:', error);
    return NextResponse.json(
      { error: 'Failed to create calendar event' },
      { status: 500 }
    );
  }
}