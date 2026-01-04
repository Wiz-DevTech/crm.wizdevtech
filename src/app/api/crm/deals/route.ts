import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''
    const stage = searchParams.get('stage') || ''
    const status = searchParams.get('status') || ''
    const assignedTo = searchParams.get('assignedTo') || ''
    
    const skip = (page - 1) * limit
    
    // Build where clause
    const where: any = {}
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { contact: { firstName: { contains: search } } },
        { contact: { lastName: { contains: search } } },
        { contact: { company: { contains: search } } }
      ]
    }
    if (stage) {
      where.stage = stage.toUpperCase()
    }
    if (status) {
      where.status = status.toUpperCase()
    }
    if (assignedTo) {
      where.assignedTo = assignedTo
    }
    
    // Get deals with relations
    const deals = await db.deal.findMany({
      where,
      include: {
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            company: true
          }
        },
        assignedUser: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        _count: {
          select: {
            activities: true
          }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      },
      skip,
      take: limit
    })
    
    // Get total count
    const total = await db.deal.count({ where })
    
    // Calculate pipeline value
    const pipelineValue = deals.reduce((acc, deal) => acc + (deal.value || 0), 0)
    
    return NextResponse.json({
      deals,
      pipelineValue,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching deals:', error)
    return NextResponse.json(
      { error: 'Failed to fetch deals' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      contactId,
      title,
      description,
      value,
      currency = 'USD',
      stage = 'PROSPECTING',
      probability = 0,
      expectedCloseDate,
      assignedTo,
      tags,
      notes
    } = body
    
    // Validate required fields
    if (!contactId || !title) {
      return NextResponse.json(
        { error: 'Contact ID and title are required' },
        { status: 400 }
      )
    }
    
    // Check if contact exists
    const contact = await db.contact.findUnique({
      where: { id: contactId }
    })
    
    if (!contact) {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 }
      )
    }
    
    // Create deal
    const deal = await db.deal.create({
      data: {
        contactId,
        title,
        description,
        value,
        currency,
        stage: stage.toUpperCase(),
        probability,
        expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : null,
        assignedTo,
        tags: tags ? JSON.stringify(tags) : null,
        notes: notes ? JSON.stringify(notes) : null
      },
      include: {
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            company: true
          }
        },
        assignedUser: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })
    
    return NextResponse.json(deal, { status: 201 })
  } catch (error) {
    console.error('Error creating deal:', error)
    return NextResponse.json(
      { error: 'Failed to create deal' },
      { status: 500 }
    )
  }
}