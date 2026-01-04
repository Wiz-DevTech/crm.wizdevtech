import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/cms/content-calendar - List content calendar items
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const month = searchParams.get('month'); // Format: YYYY-MM
    const contentType = searchParams.get('contentType');
    const status = searchParams.get('status');
    const authorId = searchParams.get('authorId');

    const where: any = {};
    
    if (month) {
      const startDate = new Date(`${month}-01`);
      const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
      where.publishDate = {
        gte: startDate,
        lte: endDate
      };
    }
    
    if (contentType) where.contentType = contentType;
    if (status) where.status = status;
    if (authorId) where.authorId = authorId;

    const [items, total] = await Promise.all([
      db.contentCalendar.findMany({
        where,
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          page: {
            select: {
              id: true,
              title: true,
              slug: true,
              status: true
            }
          }
        },
        orderBy: { publishDate: 'asc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      db.contentCalendar.count({ where })
    ]);

    return NextResponse.json({
      items,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching content calendar:', error);
    return NextResponse.json(
      { error: 'Failed to fetch content calendar' },
      { status: 500 }
    );
  }
}

// POST /api/cms/content-calendar - Create new content calendar item
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      title,
      description,
      contentType,
      publishDate,
      authorId,
      pageId,
      tags
    } = body;

    // Validate required fields
    if (!title || !contentType || !publishDate || !authorId) {
      return NextResponse.json(
        { error: 'Title, contentType, publishDate, and authorId are required' },
        { status: 400 }
      );
    }

    // Validate content type
    const validTypes = ['BLOG', 'SOCIAL', 'EMAIL', 'NEWSLETTER', 'LANDING_PAGE', 'VIDEO', 'PODCAST'];
    if (!validTypes.includes(contentType)) {
      return NextResponse.json(
        { error: 'Invalid content type' },
        { status: 400 }
      );
    }

    // Verify author exists
    const author = await db.user.findUnique({
      where: { id: authorId }
    });

    if (!author) {
      return NextResponse.json(
        { error: 'Author not found' },
        { status: 404 }
      );
    }

    // Verify page exists if provided
    if (pageId) {
      const page = await db.page.findUnique({
        where: { id: pageId }
      });

      if (!page) {
        return NextResponse.json(
          { error: 'Page not found' },
          { status: 404 }
        );
      }
    }

    const item = await db.contentCalendar.create({
      data: {
        title,
        description,
        contentType,
        publishDate: new Date(publishDate),
        authorId,
        pageId,
        tags: tags ? JSON.stringify(tags) : null
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        page: {
          select: {
            id: true,
            title: true,
            slug: true,
            status: true
          }
        }
      }
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error('Error creating content calendar item:', error);
    return NextResponse.json(
      { error: 'Failed to create content calendar item' },
      { status: 500 }
    );
  }
}

// GET /api/cms/content-calendar/calendar - Get calendar view data
export async function GET_CALENDAR(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month'); // Format: YYYY-MM

    if (!month) {
      return NextResponse.json(
        { error: 'Month parameter is required' },
        { status: 400 }
      );
    }

    const startDate = new Date(`${month}-01`);
    const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);

    const items = await db.contentCalendar.findMany({
      where: {
        publishDate: {
          gte: startDate,
          lte: endDate
        }
      },
      include: {
        author: {
          select: {
            id: true,
            name: true
          }
        },
        page: {
          select: {
            id: true,
            title: true,
            status: true
          }
        }
      },
      orderBy: { publishDate: 'asc' }
    });

    // Group by date for calendar view
    const calendarData: any = {};
    
    items.forEach(item => {
      const dateKey = item.publishDate.toISOString().split('T')[0];
      if (!calendarData[dateKey]) {
        calendarData[dateKey] = [];
      }
      
      calendarData[dateKey].push({
        id: item.id,
        title: item.title,
        contentType: item.contentType,
        status: item.status,
        author: item.author.name,
        page: item.page
      });
    });

    return NextResponse.json({
      month,
      startDate,
      endDate,
      calendar: calendarData,
      totalItems: items.length
    });
  } catch (error) {
    console.error('Error fetching calendar data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch calendar data' },
      { status: 500 }
    );
  }
}