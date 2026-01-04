import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

// GET /api/crm/documents - List documents
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const contactId = searchParams.get('contactId');
    const dealId = searchParams.get('dealId');
    const search = searchParams.get('search') || '';

    const where: any = {};
    
    if (type) where.type = type;
    if (status) where.status = status;
    if (contactId) where.contactId = contactId;
    if (dealId) where.dealId = dealId;
    
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } }
      ];
    }

    const [documents, total] = await Promise.all([
      db.document.findMany({
        where,
        include: {
          uploader: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          contact: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              company: true
            }
          },
          deal: {
            select: {
              id: true,
              title: true,
              value: true,
              currency: true
            }
          },
          _count: {
            select: {
              versions: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      db.document.count({ where })
    ]);

    return NextResponse.json({
      documents,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching documents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    );
  }
}

// POST /api/crm/documents - Upload new document
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    const type = formData.get('type') as string;
    const contactId = formData.get('contactId') as string;
    const dealId = formData.get('dealId') as string;
    const tags = formData.get('tags') as string;
    const uploadedBy = formData.get('uploadedBy') as string;

    // Validate required fields
    if (!file || !name || !type || !uploadedBy) {
      return NextResponse.json(
        { error: 'File, name, type, and uploadedBy are required' },
        { status: 400 }
      );
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size must be less than 10MB' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/jpeg',
      'image/png',
      'image/gif',
      'video/mp4',
      'video/webm'
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'File type not allowed' },
        { status: 400 }
      );
    }

    // Verify contact exists if provided
    if (contactId) {
      const contact = await db.contact.findUnique({
        where: { id: contactId }
      });

      if (!contact) {
        return NextResponse.json(
          { error: 'Contact not found' },
          { status: 404 }
        );
      }
    }

    // Verify deal exists if provided
    if (dealId) {
      const deal = await db.deal.findUnique({
        where: { id: dealId }
      });

      if (!deal) {
        return NextResponse.json(
          { error: 'Deal not found' },
          { status: 404 }
        );
      }
    }

    // Create uploads directory if it doesn't exist
    const uploadsDir = join(process.cwd(), 'uploads', 'documents');
    try {
      await mkdir(uploadsDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }

    // Generate unique filename
    const fileExtension = file.name.split('.').pop();
    const uniqueFileName = `${uuidv4()}.${fileExtension}`;
    const filePath = join(uploadsDir, uniqueFileName);

    // Save file to disk
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // Create document record
    const document = await db.document.create({
      data: {
        name,
        description,
        fileName: file.name,
        filePath: `/uploads/documents/${uniqueFileName}`,
        fileSize: file.size,
        mimeType: file.type,
        type,
        contactId,
        dealId,
        tags,
        uploadedBy
      },
      include: {
        uploader: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            company: true
          }
        },
        deal: {
          select: {
            id: true,
            title: true,
            value: true,
            currency: true
          }
        }
      }
    });

    return NextResponse.json(document, { status: 201 });
  } catch (error) {
    console.error('Error uploading document:', error);
    return NextResponse.json(
      { error: 'Failed to upload document' },
      { status: 500 }
    );
  }
}