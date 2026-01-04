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
    const source = searchParams.get('source') || ''
    const assignedTo = searchParams.get('assignedTo') || ''
    
    const skip = (page - 1) * limit
    
    // Build where clause
    const where: any = {}
    if (search) {
      where.OR = [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { email: { contains: search } },
        { company: { contains: search } }
      ]
    }
    if (status) {
      where.status = status.toUpperCase()
    }
    if (priority) {
      where.priority = priority.toUpperCase()
    }
    if (source) {
      where.source = source
    }
    if (assignedTo) {
      where.assignedTo = assignedTo
    }
    
    // Get leads with relations
    const leads = await db.lead.findMany({
      where,
      include: {
        assignedUser: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        convertedContact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip,
      take: limit
    })
    
    // Get total count
    const total = await db.lead.count({ where })
    
    // Calculate lead statistics
    const stats = {
      total: total,
      new: leads.filter(l => l.status === 'NEW').length,
      contacted: leads.filter(l => l.status === 'CONTACTED').length,
      qualified: leads.filter(l => l.status === 'QUALIFIED').length,
      converted: leads.filter(l => l.status === 'CONVERTED').length,
      avgScore: leads.length > 0 ? Math.round(leads.reduce((acc, lead) => acc + lead.score, 0) / leads.length) : 0
    }
    
    return NextResponse.json({
      leads,
      stats,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching leads:', error)
    return NextResponse.json(
      { error: 'Failed to fetch leads' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      firstName,
      lastName,
      email,
      phone,
      company,
      jobTitle,
      website,
      source,
      campaign,
      medium,
      content,
      status = 'NEW',
      priority = 'MEDIUM',
      score = 0,
      notes,
      assignedTo
    } = body
    
    // Create lead
    const lead = await db.lead.create({
      data: {
        firstName,
        lastName,
        email,
        phone,
        company,
        jobTitle,
        website,
        source,
        campaign,
        medium,
        content,
        status: status.toUpperCase(),
        priority: priority.toUpperCase(),
        score,
        notes,
        assignedTo
      },
      include: {
        assignedUser: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })
    
    return NextResponse.json(lead, { status: 201 })
  } catch (error) {
    console.error('Error creating lead:', error)
    return NextResponse.json(
      { error: 'Failed to create lead' },
      { status: 500 }
    )
  }
}