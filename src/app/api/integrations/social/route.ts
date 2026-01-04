import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const platform = searchParams.get('platform') || '';
    const status = searchParams.get('status') || '';

    const where: any = {};
    
    if (platform) {
      where.platform = platform;
    }
    
    if (status) {
      where.status = status;
    }

    const [posts, total] = await Promise.all([
      db.socialMediaPost.findMany({
        where,
        include: {
          page: {
            select: { id: true, title: true, slug: true }
          },
          scheduledBy: {
            select: { id: true, name: true, email: true }
          }
        },
        orderBy: { scheduledAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      db.socialMediaPost.count({ where })
    ]);

    return NextResponse.json({
      posts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching social media posts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch social media posts' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      platform, 
      content, 
      imageUrl, 
      linkUrl, 
      scheduledAt, 
      pageId, 
      status, 
      scheduledById,
      hashtags 
    } = body;

    if (!platform || !content) {
      return NextResponse.json(
        { error: 'Platform and content are required' },
        { status: 400 }
      );
    }

    const post = await db.socialMediaPost.create({
      data: {
        platform,
        content,
        imageUrl: imageUrl || null,
        linkUrl: linkUrl || null,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        pageId: pageId || null,
        status: status || 'DRAFT',
        scheduledById: scheduledById || null,
        hashtags: hashtags || []
      },
      include: {
        page: {
          select: { id: true, title: true, slug: true }
        },
        scheduledBy: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    return NextResponse.json(post, { status: 201 });
  } catch (error) {
    console.error('Error creating social media post:', error);
    return NextResponse.json(
      { error: 'Failed to create social media post' },
      { status: 500 }
    );
  }
}