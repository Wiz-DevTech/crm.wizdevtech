import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    const language = searchParams.get('language') || '';
    const status = searchParams.get('status') || '';

    const where: any = {};
    
    if (search) {
      where.OR = [
        { key: { contains: search, mode: 'insensitive' } },
        { namespace: { contains: search, mode: 'insensitive' } }
      ];
    }
    
    if (language) {
      where.language = language;
    }
    
    if (status) {
      where.status = status;
    }

    const [translations, total] = await Promise.all([
      db.translation.findMany({
        where,
        include: {
          updatedBy: {
            select: { id: true, name: true, email: true }
          }
        },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      db.translation.count({ where })
    ]);

    return NextResponse.json({
      translations,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching translations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch translations' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { key, namespace, language, value, status, updatedById } = body;

    if (!key || !language || !value) {
      return NextResponse.json(
        { error: 'Key, language, and value are required' },
        { status: 400 }
      );
    }

    // Check if translation already exists
    const existingTranslation = await db.translation.findUnique({
      where: {
        key_namespace_language: {
          key,
          namespace: namespace || 'default',
          language
        }
      }
    });

    let translation;
    if (existingTranslation) {
      // Update existing translation
      translation = await db.translation.update({
        where: { id: existingTranslation.id },
        data: {
          value,
          status: status || 'PUBLISHED',
          updatedById: updatedById || null
        },
        include: {
          updatedBy: {
            select: { id: true, name: true, email: true }
          }
        }
      });
    } else {
      // Create new translation
      translation = await db.translation.create({
        data: {
          key,
          namespace: namespace || 'default',
          language,
          value,
          status: status || 'PUBLISHED',
          updatedById: updatedById || null
        },
        include: {
          updatedBy: {
            select: { id: true, name: true, email: true }
          }
        }
      });
    }

    return NextResponse.json(translation, { status: 201 });
  } catch (error) {
    console.error('Error creating translation:', error);
    return NextResponse.json(
      { error: 'Failed to create translation' },
      { status: 500 }
    );
  }
}