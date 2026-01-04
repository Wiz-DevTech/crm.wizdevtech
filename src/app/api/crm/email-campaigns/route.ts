import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/crm/email-campaigns - List email campaigns
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status') || '';
    const search = searchParams.get('search') || '';

    const where = {
      ...(status && { status }),
      ...(search && {
        OR: [
          { name: { contains: search } },
          { subject: { contains: search } }
        ]
      })
    };

    const [campaigns, total] = await Promise.all([
      db.emailCampaign.findMany({
        where,
        include: {
          template: {
            select: {
              id: true,
              name: true,
              type: true
            }
          },
          emailList: {
            select: {
              id: true,
              name: true
            }
          },
          creator: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          _count: {
            select: {
              recipients: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      db.emailCampaign.count({ where })
    ]);

    return NextResponse.json({
      campaigns,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching email campaigns:', error);
    return NextResponse.json(
      { error: 'Failed to fetch email campaigns' },
      { status: 500 }
    );
  }
}

// POST /api/crm/email-campaigns - Create new email campaign
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      subject,
      templateId,
      listId,
      scheduledAt,
      createdBy
    } = body;

    // Validate required fields
    if (!name || !subject || !templateId || !createdBy) {
      return NextResponse.json(
        { error: 'Name, subject, templateId, and createdBy are required' },
        { status: 400 }
      );
    }

    // Verify template exists
    const template = await db.emailTemplate.findUnique({
      where: { id: templateId }
    });

    if (!template) {
      return NextResponse.json(
        { error: 'Email template not found' },
        { status: 404 }
      );
    }

    // Verify email list exists if provided
    if (listId) {
      const emailList = await db.emailList.findUnique({
        where: { id: listId }
      });

      if (!emailList) {
        return NextResponse.json(
          { error: 'Email list not found' },
          { status: 404 }
        );
      }
    }

    // Create campaign
    const campaign = await db.emailCampaign.create({
      data: {
        name,
        subject,
        templateId,
        listId,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        createdBy,
        status: scheduledAt ? 'SCHEDULED' : 'DRAFT'
      },
      include: {
        template: true,
        emailList: true,
        creator: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    return NextResponse.json(campaign, { status: 201 });
  } catch (error) {
    console.error('Error creating email campaign:', error);
    return NextResponse.json(
      { error: 'Failed to create email campaign' },
      { status: 500 }
    );
  }
}