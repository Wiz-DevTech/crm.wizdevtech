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
    if (assignedTo) {
      where.assignedTo = assignedTo
    }
    
    // Get contacts with relations
    const contacts = await db.contact.findMany({
      where,
      include: {
        assignedUser: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        _count: {
          select: {
            interactions: true,
            deals: true
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
    const total = await db.contact.count({ where })
    
    return NextResponse.json({
      contacts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching contacts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch contacts' },
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
      linkedin,
      source,
      status = 'LEAD',
      priority = 'MEDIUM',
      tags,
      notes,
      assignedTo
    } = body
    
    // Validate required fields
    if (!firstName || !lastName || !email) {
      return NextResponse.json(
        { error: 'First name, last name, and email are required' },
        { status: 400 }
      )
    }
    
    // Check if email already exists
    const existingContact = await db.contact.findUnique({
      where: { email }
    })
    
    if (existingContact) {
      return NextResponse.json(
        { error: 'Contact with this email already exists' },
        { status: 409 }
      )
    }
    
    // Create contact
    const contact = await db.contact.create({
      data: {
        firstName,
        lastName,
        email,
        phone,
        company,
        jobTitle,
        website,
        linkedin,
        source,
        status: status.toUpperCase(),
        priority: priority.toUpperCase(),
        tags: tags ? JSON.stringify(tags) : null,
        notes: notes ? JSON.stringify(notes) : null,
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
    
    return NextResponse.json(contact, { status: 201 })
  } catch (error) {
    console.error('Error creating contact:', error)
    return NextResponse.json(
      { error: 'Failed to create contact' },
      { status: 500 }
    )
  }
}