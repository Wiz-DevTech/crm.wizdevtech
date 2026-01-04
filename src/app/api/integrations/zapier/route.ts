import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status') || '';

    const where: any = {};
    
    if (status) {
      where.status = status;
    }

    const [webhooks, total] = await Promise.all([
      db.webhook.findMany({
        where,
        include: {
          createdBy: {
            select: { id: true, name: true, email: true }
          },
          _count: {
            select: {
              logs: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      db.webhook.count({ where })
    ]);

    return NextResponse.json({
      webhooks,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching webhooks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch webhooks' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      name, 
      url, 
      events, 
      secret, 
      isActive, 
      createdById 
    } = body;

    if (!name || !url || !events) {
      return NextResponse.json(
        { error: 'Name, URL, and events are required' },
        { status: 400 }
      );
    }

    const webhook = await db.webhook.create({
      data: {
        name,
        url,
        events,
        secret: secret || null,
        isActive: isActive !== undefined ? isActive : true,
        createdById: createdById || null
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    return NextResponse.json(webhook, { status: 201 });
  } catch (error) {
    console.error('Error creating webhook:', error);
    return NextResponse.json(
      { error: 'Failed to create webhook' },
      { status: 500 }
    );
  }
}