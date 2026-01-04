import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status') || '';
    const listId = searchParams.get('listId') || '';

    const where: any = {};
    
    if (status) {
      where.status = status;
    }
    
    if (listId) {
      where.listId = listId;
    }

    const [newsletters, total] = await Promise.all([
      db.newsletter.findMany({
        where,
        include: {
          list: {
            select: { id: true, name: true }
          },
          createdBy: {
            select: { id: true, name: true, email: true }
          },
          _count: {
            select: {
              sentEmails: true,
              opens: true,
              clicks: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      db.newsletter.count({ where })
    ]);

    return NextResponse.json({
      newsletters,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching newsletters:', error);
    return NextResponse.json(
      { error: 'Failed to fetch newsletters' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      subject, 
      content, 
      htmlContent, 
      listId, 
      scheduledAt, 
      status, 
      createdById,
      template
    } = body;

    if (!subject || !content || !listId) {
      return NextResponse.json(
        { error: 'Subject, content, and list ID are required' },
        { status: 400 }
      );
    }

    const newsletter = await db.newsletter.create({
      data: {
        subject,
        content,
        htmlContent: htmlContent || null,
        listId,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        status: status || 'DRAFT',
        createdById: createdById || null,
        template: template || null
      },
      include: {
        list: {
          select: { id: true, name: true }
        },
        createdBy: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    return NextResponse.json(newsletter, { status: 201 });
  } catch (error) {
    console.error('Error creating newsletter:', error);
    return NextResponse.json(
      { error: 'Failed to create newsletter' },
      { status: 500 }
    );
  }
}