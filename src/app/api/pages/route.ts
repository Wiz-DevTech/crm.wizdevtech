import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const type = searchParams.get('type') || ''
    
    const skip = (page - 1) * limit
    
    // Build where clause
    const where: any = {}
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { slug: { contains: search } },
        { content: { contains: search } }
      ]
    }
    if (status) {
      where.status = status.toUpperCase()
    }
    if (type) {
      where.type = type.toUpperCase()
    }
    
    // Get pages with relations
    const pages = await db.page.findMany({
      where,
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        seo: true,
        _count: {
          select: {
            keywords: true,
            media: true
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
    const total = await db.page.count({ where })
    
    return NextResponse.json({
      pages,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching pages:', error)
    return NextResponse.json(
      { error: 'Failed to fetch pages' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      title,
      slug,
      content,
      excerpt,
      type = 'PAGE',
      template = 'default',
      parentId,
      authorId,
      status = 'DRAFT',
      seo,
      schema: schemaData
    } = body
    
    // Validate required fields
    if (!title || !slug || !content || !authorId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }
    
    // Check if slug already exists
    const existingPage = await db.page.findUnique({
      where: { slug }
    })
    
    if (existingPage) {
      return NextResponse.json(
        { error: 'Slug already exists' },
        { status: 409 }
      )
    }
    
    // Create page with transaction
    const result = await db.$transaction(async (tx) => {
      // Create the page
      const page = await tx.page.create({
        data: {
          title,
          slug,
          content,
          excerpt,
          type,
          template,
          parentId,
          authorId,
          status,
          publishedAt: status === 'PUBLISHED' ? new Date() : null
        }
      })
      
      // Create SEO metadata if provided
      if (seo) {
        await tx.seoMeta.create({
          data: {
            pageId: page.id,
            ...seo
          }
        })
      }
      
      // Create schema markup if provided
      if (schemaData) {
        await tx.schemaMarkup.create({
          data: {
            pageId: page.id,
            type: schemaData.type,
            data: JSON.stringify(schemaData.data)
          }
        })
      }
      
      // Create initial revision
      await tx.pageRevision.create({
        data: {
          pageId: page.id,
          title,
          content,
          excerpt,
          status,
          authorId,
          version: 1,
          changeLog: 'Initial version'
        }
      })
      
      return page
    })
    
    // Return the created page with relations
    const createdPage = await db.page.findUnique({
      where: { id: result.id },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        seo: true,
        schema: true
      }
    })
    
    return NextResponse.json(createdPage, { status: 201 })
  } catch (error) {
    console.error('Error creating page:', error)
    return NextResponse.json(
      { error: 'Failed to create page' },
      { status: 500 }
    )
  }
}