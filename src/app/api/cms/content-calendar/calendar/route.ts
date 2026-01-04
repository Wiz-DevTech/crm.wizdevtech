import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/cms/content-calendar/calendar - Get calendar view data
export async function GET(request: NextRequest) {
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