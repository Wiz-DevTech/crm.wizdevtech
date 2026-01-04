import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pageId = searchParams.get('pageId');
    const period = searchParams.get('period') || '7d';
    const metric = searchParams.get('metric') || 'overview';

    // Calculate date range
    const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    if (metric === 'overview') {
      // Get overview analytics
      const [totalPageViews, uniqueUsers, avgSessionDuration, bounceRate] = await Promise.all([
        db.ga4Event.count({
          where: {
            eventName: 'page_view',
            timestamp: { gte: startDate }
          }
        }),
        getUniqueUsers(startDate),
        getAvgSessionDuration(startDate),
        getBounceRate(startDate)
      ]);

      // Get top pages
      const topPages = await db.ga4Event.groupBy({
        by: ['pagePath'],
        where: {
          eventName: 'page_view',
          timestamp: { gte: startDate }
        },
        _count: { pagePath: true },
        orderBy: { _count: { pagePath: 'desc' } },
        take: 10
      });

      // Get top events
      const topEvents = await db.ga4Event.groupBy({
        by: ['eventName'],
        where: {
          timestamp: { gte: startDate }
        },
        _count: { eventName: true },
        orderBy: { _count: { eventName: 'desc' } },
        take: 10
      });

      return NextResponse.json({
        period,
        overview: {
          totalPageViews,
          uniqueUsers,
          avgSessionDuration,
          bounceRate,
          pagesPerSession: totalPageViews / Math.max(uniqueUsers, 1)
        },
        topPages: topPages.map(p => ({
          page: p.pagePath,
          views: p._count.pagePath
        })),
        topEvents: topEvents.map(e => ({
          event: e.eventName,
          count: e._count.eventName
        }))
      });
    }

    if (metric === 'realtime') {
      // Get real-time data (last 30 minutes)
      const realtimeStart = new Date();
      realtimeStart.setMinutes(realtimeStart.getMinutes() - 30);

      const [activeUsers, recentEvents] = await Promise.all([
        getActiveUsers(realtimeStart),
        db.ga4Event.findMany({
          where: {
            timestamp: { gte: realtimeStart }
          },
          select: {
            eventName: true,
            pagePath: true,
            timestamp: true,
            userId: true
          },
          orderBy: { timestamp: 'desc' },
          take: 50
        })
      ]);

      return NextResponse.json({
        period: 'realtime',
        activeUsers,
        recentEvents: recentEvents.map(event => ({
          event: event.eventName,
          page: event.pagePath,
          timestamp: event.timestamp,
          userId: event.userId
        }))
      });
    }

    if (metric === 'conversions') {
      // Get conversion events
      const conversions = await db.ga4Event.findMany({
        where: {
          eventName: { in: ['purchase', 'sign_up', 'form_submit', 'cta_click'] },
          timestamp: { gte: startDate }
        },
        select: {
          eventName: true,
          eventParams: true,
          timestamp: true,
          pagePath: true
        },
        orderBy: { timestamp: 'desc' }
      });

      // Group conversions by event type
      const conversionSummary = conversions.reduce((acc, conv) => {
        const eventName = conv.eventName;
        if (!acc[eventName]) {
          acc[eventName] = 0;
        }
        acc[eventName]++;
        return acc;
      }, {} as Record<string, number>);

      return NextResponse.json({
        period,
        conversions: {
          summary: conversionSummary,
          total: conversions.length,
          details: conversions.map(conv => ({
            event: conv.eventName,
            page: conv.pagePath,
            timestamp: conv.timestamp,
            value: conv.eventParams?.value || null
          }))
        }
      });
    }

    return NextResponse.json(
      { error: 'Invalid metric type' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Error fetching GA4 data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch GA4 data' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      eventName, 
      pagePath, 
      userId, 
      sessionId, 
      eventParams 
    } = body;

    if (!eventName) {
      return NextResponse.json(
        { error: 'Event name is required' },
        { status: 400 }
      );
    }

    const event = await db.ga4Event.create({
      data: {
        eventName,
        pagePath: pagePath || null,
        userId: userId || null,
        sessionId: sessionId || null,
        eventParams: eventParams || {}
      }
    });

    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    console.error('Error creating GA4 event:', error);
    return NextResponse.json(
      { error: 'Failed to create GA4 event' },
      { status: 500 }
    );
  }
}

// Helper functions
async function getUniqueUsers(startDate: Date) {
  const events = await db.ga4Event.findMany({
    where: {
      timestamp: { gte: startDate },
      userId: { not: null }
    },
    select: { userId: true }
  });
  
  return new Set(events.map(e => e.userId)).size;
}

async function getAvgSessionDuration(startDate: Date) {
  const sessions = await db.ga4Event.findMany({
    where: {
      timestamp: { gte: startDate },
      sessionId: { not: null }
    },
    select: { sessionId: true, timestamp: true },
    orderBy: { timestamp: 'asc' }
  });

  const sessionMap = new Map();
  sessions.forEach(session => {
    if (!sessionMap.has(session.sessionId)) {
      sessionMap.set(session.sessionId, []);
    }
    sessionMap.get(session.sessionId).push(session.timestamp);
  });

  const durations = Array.from(sessionMap.values())
    .filter(times => times.length > 1)
    .map(times => {
      const start = new Date(times[0]).getTime();
      const end = new Date(times[times.length - 1]).getTime();
      return end - start;
    });

  return durations.length > 0 ? 
    durations.reduce((a, b) => a + b, 0) / durations.length / 1000 : 0; // Convert to seconds
}

async function getBounceRate(startDate: Date) {
  const sessions = await db.ga4Event.groupBy({
    by: ['sessionId'],
    where: {
      timestamp: { gte: startDate },
      sessionId: { not: null }
    },
    _count: { sessionId: true },
    having: {
      sessionId: {
        _count: { equals: 1 }
      }
    }
  });

  const totalSessions = await db.ga4Event.groupBy({
    by: ['sessionId'],
    where: {
      timestamp: { gte: startDate },
      sessionId: { not: null }
    }
  });

  const bouncedSessions = sessions.length;
  const totalSessionCount = totalSessions.length;
  
  return totalSessionCount > 0 ? (bouncedSessions / totalSessionCount) * 100 : 0;
}

async function getActiveUsers(startDate: Date) {
  const events = await db.ga4Event.findMany({
    where: {
      timestamp: { gte: startDate },
      userId: { not: null }
    },
    select: { userId: true }
  });
  
  return new Set(events.map(e => e.userId)).size;
}