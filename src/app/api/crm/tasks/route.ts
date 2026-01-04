import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const priority = searchParams.get('priority') || ''
    const assignedTo = searchParams.get('assignedTo') || ''
    const type = searchParams.get('type') || ''
    
    const skip = (page - 1) * limit
    
    // Build where clause
    const where: any = {}
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } }
      ]
    }
    if (status) {
      where.status = status.toUpperCase()
    }
    if (priority) {
      where.priority = priority.toUpperCase()
    }
    if (assignedTo) {
      where.assignedTo = assignedTo
    }
    if (type) {
      where.type = type.toUpperCase()
    }
    
    // Get tasks with relations
    const tasks = await db.task.findMany({
      where,
      include: {
        assignedUser: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        creator: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        dueDate: 'asc'
      },
      skip,
      take: limit
    })
    
    // Get total count
    const total = await db.task.count({ where })
    
    // Calculate task statistics
    const stats = {
      total: total,
      todo: tasks.filter(t => t.status === 'TODO').length,
      inProgress: tasks.filter(t => t.status === 'IN_PROGRESS').length,
      completed: tasks.filter(t => t.status === 'COMPLETED').length,
      overdue: tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'COMPLETED').length
    }
    
    return NextResponse.json({
      tasks,
      stats,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching tasks:', error)
    return NextResponse.json(
      { error: 'Failed to fetch tasks' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      title,
      description,
      type,
      priority = 'MEDIUM',
      status = 'TODO',
      dueDate,
      assignedTo,
      relatedTo,
      relatedType,
      createdBy
    } = body
    
    // Validate required fields
    if (!title || !type || !assignedTo || !createdBy) {
      return NextResponse.json(
        { error: 'Title, type, assignedTo, and createdBy are required' },
        { status: 400 }
      )
    }
    
    // Create task
    const task = await db.task.create({
      data: {
        title,
        description,
        type: type.toUpperCase(),
        priority: priority.toUpperCase(),
        status: status.toUpperCase(),
        dueDate: dueDate ? new Date(dueDate) : null,
        assignedTo,
        relatedTo,
        relatedType,
        createdBy
      },
      include: {
        assignedUser: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        creator: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })
    
    return NextResponse.json(task, { status: 201 })
  } catch (error) {
    console.error('Error creating task:', error)
    return NextResponse.json(
      { error: 'Failed to create task' },
      { status: 500 }
    )
  }
}