// src/app/api/crm/workflows/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/crm/workflows - List workflows
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const trigger = searchParams.get('trigger');
    const isActive = searchParams.get('isActive');
    const search = searchParams.get('search') || '';

    const where: any = {};
    
    if (trigger) where.trigger = trigger;
    if (isActive !== undefined) where.isActive = isActive === 'true';
    
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } }
      ];
    }

    const [workflows, total] = await Promise.all([
      db.workflow.findMany({
        where,
        include: {
          creator: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          _count: {
            select: {
              executions: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      db.workflow.count({ where })
    ]);

    return NextResponse.json({
      workflows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching workflows:', error);
    return NextResponse.json(
      { error: 'Failed to fetch workflows' },
      { status: 500 }
    );
  }
}

// POST /api/crm/workflows - Create new workflow
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      description,
      trigger,
      conditions,
      actions,
      createdBy
    } = body;

    // Validate required fields
    if (!name || !trigger || !conditions || !actions || !createdBy) {
      return NextResponse.json(
        { error: 'Name, trigger, conditions, actions, and createdBy are required' },
        { status: 400 }
      );
    }

    // Validate trigger
    const validTriggers = [
      'CONTACT_CREATED',
      'DEAL_CREATED',
      'DEAL_STAGE_CHANGED',
      'TASK_COMPLETED',
      'EMAIL_OPENED',
      'FORM_SUBMITTED',
      'SCHEDULED',
      'WEBHOOK'
    ];

    if (!validTriggers.includes(trigger)) {
      return NextResponse.json(
        { error: 'Invalid trigger type' },
        { status: 400 }
      );
    }

    // Parse and validate conditions and actions
    let parsedConditions, parsedActions;
    try {
      parsedConditions = typeof conditions === 'string' ? JSON.parse(conditions) : conditions;
      parsedActions = typeof actions === 'string' ? JSON.parse(actions) : actions;
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid conditions or actions format' },
        { status: 400 }
      );
    }

    const workflow = await db.workflow.create({
      data: {
        name,
        description,
        trigger,
        conditions: JSON.stringify(parsedConditions),
        actions: JSON.stringify(parsedActions),
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

    return NextResponse.json(workflow, { status: 201 });
  } catch (error) {
    console.error('Error creating workflow:', error);
    return NextResponse.json(
      { error: 'Failed to create workflow' },
      { status: 500 }
    );
  }
}