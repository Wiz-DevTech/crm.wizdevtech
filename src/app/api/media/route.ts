import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const type = searchParams.get('type') || ''
    
    const skip = (page - 1) * limit
    
    // Build where clause
    const where: any = {}
    if (type) {
      where.mimeType = { contains: type }
    }
    
    // Get media with relations
    const media = await db.media.findMany({
      where,
      include: {
        uploader: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        _count: {
          select: {
            pages: true
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
    const total = await db.media.count({ where })
    
    return NextResponse.json({
      media,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching media:', error)
    return NextResponse.json(
      { error: 'Failed to fetch media' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const alt = formData.get('alt') as string
    const caption = formData.get('caption') as string
    const uploadedBy = formData.get('uploadedBy') as string
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }
    
    if (!uploadedBy) {
      return NextResponse.json(
        { error: 'Uploader ID is required' },
        { status: 400 }
      )
    }
    
    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File size exceeds 10MB limit' },
        { status: 400 }
      )
    }
    
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'File type not allowed' },
        { status: 400 }
      )
    }
    
    // Generate unique filename
    const fileExtension = file.name.split('.').pop()
    const filename = `${uuidv4()}.${fileExtension}`
    
    // Ensure upload directory exists
    const uploadDir = join(process.cwd(), 'public', 'uploads')
    try {
      await mkdir(uploadDir, { recursive: true })
    } catch (error) {
      // Directory might already exist
    }
    
    // Save file to filesystem
    const filePath = join(uploadDir, filename)
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    
    await writeFile(filePath, buffer)
    
    // Get image dimensions if it's an image
    let width: number | undefined
    let height: number | undefined
    
    if (file.type.startsWith('image/')) {
      try {
        // For now, we'll skip image dimension detection
        // In a real implementation, you'd use a library like 'sharp' or 'jimp'
      } catch (error) {
        console.error('Error getting image dimensions:', error)
      }
    }
    
    // Save to database
    const media = await db.media.create({
      data: {
        filename,
        originalName: file.name,
        mimeType: file.type,
        size: file.size,
        path: filePath,
        url: `/uploads/${filename}`,
        alt,
        caption,
        width,
        height,
        uploadedBy
      },
      include: {
        uploader: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })
    
    return NextResponse.json(media, { status: 201 })
  } catch (error) {
    console.error('Error uploading media:', error)
    return NextResponse.json(
      { error: 'Failed to upload media' },
      { status: 500 }
    )
  }
}