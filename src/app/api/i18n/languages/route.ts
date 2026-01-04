import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const languages = await db.language.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: {
            translations: true,
            pages: true
          }
        }
      }
    });

    return NextResponse.json({ languages });
  } catch (error) {
    console.error('Error fetching languages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch languages' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, name, nativeName, flag, isDefault, isRTL, enabled } = body;

    if (!code || !name || !nativeName) {
      return NextResponse.json(
        { error: 'Code, name, and native name are required' },
        { status: 400 }
      );
    }

    // If setting as default, unset other defaults
    if (isDefault) {
      await db.language.updateMany({
        where: { isDefault: true },
        data: { isDefault: false }
      });
    }

    const language = await db.language.create({
      data: {
        code,
        name,
        nativeName,
        flag: flag || '',
        isDefault: isDefault || false,
        isRTL: isRTL || false,
        enabled: enabled !== undefined ? enabled : true
      }
    });

    return NextResponse.json(language, { status: 201 });
  } catch (error) {
    console.error('Error creating language:', error);
    return NextResponse.json(
      { error: 'Failed to create language' },
      { status: 500 }
    );
  }
}