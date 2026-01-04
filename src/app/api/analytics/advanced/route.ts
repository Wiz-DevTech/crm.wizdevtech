import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pageId = searchParams.get('pageId');
    const period = searchParams.get('period') || '7d';
    const type = searchParams.get('type') || 'overview';

    if (!pageId && type === 'page') {
      return NextResponse.json(
        { error: 'Page ID is required for page-specific analytics' },
        { status: 400 }
      );
    }

    // Calculate date range
    const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    if (type === 'heatmap') {
      // Get heatmap data
      const heatmapData = await db.userBehavior.findMany({
        where: {
          pageId: pageId || undefined,
          timestamp: { gte: startDate }
        },
        select: {
          eventType: true,
          elementSelector: true,
          positionX: true,
          positionY: true,
          viewportWidth: true,
          viewportHeight: true,
          timestamp: true
        },
        orderBy: { timestamp: 'desc' },
        take: 10000
      });

      // Process heatmap data
      const clicks = heatmapData.filter(h => h.eventType === 'CLICK');
      const movements = heatmapData.filter(h => h.eventType === 'MOVE');
      const scrolls = heatmapData.filter(h => h.eventType === 'SCROLL');

      // Create heatmap grid data
      const gridSize = 50;
      const clickHeatmap = createHeatmapGrid(clicks, gridSize);
      const movementHeatmap = createHeatmapGrid(movements, gridSize);

      return NextResponse.json({
        period,
        heatmapData: {
          clicks: clickHeatmap,
          movements: movementHeatmap,
          totalClicks: clicks.length,
          totalMovements: movements.length,
          totalScrolls: scrolls.length
        }
      });
    }

    if (type === 'behavior') {
      // Get behavior flow data
      const behaviorData = await db.userBehavior.findMany({
        where: {
          pageId: pageId || undefined,
          timestamp: { gte: startDate }
        },
        select: {
          sessionId: true,
          eventType: true,
          elementSelector: true,
          timestamp: true,
          pageUrl: true,
          userAgent: true,
          referrer: true
        },
        orderBy: { timestamp: 'asc' }
      });

      // Process behavior flow
      const sessionFlows = processSessionFlows(behaviorData);
      const topPages = await getTopPages(startDate);
      const exitPages = await getExitPages(startDate);
      const avgSessionDuration = await getAvgSessionDuration(startDate);

      return NextResponse.json({
        period,
        behaviorData: {
          sessionFlows,
          topPages,
          exitPages,
          avgSessionDuration,
          totalSessions: new Set(behaviorData.map(b => b.sessionId)).size
        }
      });
    }

    // Overview analytics
    const [totalEvents, uniqueSessions, topPages, bounceRate] = await Promise.all([
      db.userBehavior.count({
        where: {
          pageId: pageId || undefined,
          timestamp: { gte: startDate }
        }
      }),
      getUniqueSessions(pageId, startDate),
      getTopPages(startDate),
      getBounceRate(pageId, startDate)
    ]);

    return NextResponse.json({
      period,
      overview: {
        totalEvents,
        uniqueSessions,
        topPages,
        bounceRate,
        engagementRate: 100 - bounceRate
      }
    });

  } catch (error) {
    console.error('Error fetching advanced analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch advanced analytics' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      sessionId, 
      pageId, 
      eventType, 
      elementSelector, 
      positionX, 
      positionY, 
      viewportWidth, 
      viewportHeight, 
      pageUrl, 
      userAgent, 
      referrer 
    } = body;

    if (!sessionId || !pageId || !eventType) {
      return NextResponse.json(
        { error: 'Session ID, page ID, and event type are required' },
        { status: 400 }
      );
    }

    const behavior = await db.userBehavior.create({
      data: {
        sessionId,
        pageId,
        eventType,
        elementSelector: elementSelector || null,
        positionX: positionX || null,
        positionY: positionY || null,
        viewportWidth: viewportWidth || null,
        viewportHeight: viewportHeight || null,
        pageUrl: pageUrl || null,
        userAgent: userAgent || null,
        referrer: referrer || null
      }
    });

    return NextResponse.json(behavior, { status: 201 });
  } catch (error) {
    console.error('Error creating behavior record:', error);
    return NextResponse.json(
      { error: 'Failed to create behavior record' },
      { status: 500 }
    );
  }
}

// Helper functions
function createHeatmapGrid(data: any[], gridSize: number) {
  const grid: { [key: string]: number } = {};
  
  data.forEach(point => {
    if (point.positionX && point.positionY && point.viewportWidth && point.viewportHeight) {
      const x = Math.floor((point.positionX / point.viewportWidth) * gridSize);
      const y = Math.floor((point.positionY / point.viewportHeight) * gridSize);
      const key = `${x},${y}`;
      grid[key] = (grid[key] || 0) + 1;
    }
  });

  return Object.entries(grid).map(([key, value]) => {
    const [x, y] = key.split(',').map(Number);
    return { x, y, intensity: value };
  });
}

function processSessionFlows(behaviorData: any[]) {
  const sessionMap = new Map();
  
  behaviorData.forEach(event => {
    if (!sessionMap.has(event.sessionId)) {
      sessionMap.set(event.sessionId, []);
    }
    sessionMap.get(event.sessionId).push(event);
  });

  const flows = Array.from(sessionMap.values()).map(session => {
    const pages = [...new Set(session.map(e => e.pageUrl).filter(Boolean))];
    return {
      sessionId: session[0].sessionId,
      pages,
      duration: session.length > 1 ? 
        new Date(session[session.length - 1].timestamp).getTime() - 
        new Date(session[0].timestamp).getTime() : 0,
      events: session.length
    };
  });

  return flows.sort((a, b) => b.duration - a.duration).slice(0, 100);
}

async function getUniqueSessions(pageId: string | null, startDate: Date) {
  const behaviors = await db.userBehavior.findMany({
    where: {
      pageId: pageId || undefined,
      timestamp: { gte: startDate }
    },
    select: { sessionId: true }
  });
  
  return new Set(behaviors.map(b => b.sessionId)).size;
}

async function getTopPages(startDate: Date) {
  const pageViews = await db.userBehavior.groupBy({
    by: ['pageUrl'],
    where: {
      timestamp: { gte: startDate },
      pageUrl: { not: null }
    },
    _count: { sessionId: true },
    orderBy: { _count: { sessionId: 'desc' } },
    take: 10
  });

  return pageViews.map(pv => ({
    page: pv.pageUrl,
    views: pv._count.sessionId
  }));
}

async function getExitPages(startDate: Date) {
  // This is a simplified version - in production you'd track actual exit events
  const allSessions = await db.userBehavior.findMany({
    where: {
      timestamp: { gte: startDate }
    },
    select: { sessionId: true, pageUrl: true, timestamp: true },
    orderBy: { timestamp: 'desc' }
  });

  const lastPages = new Map();
  allSessions.forEach(session => {
    if (!lastPages.has(session.sessionId) || 
        new Date(session.timestamp) > new Date(lastPages.get(session.sessionId).timestamp)) {
      lastPages.set(session.sessionId, {
        pageUrl: session.pageUrl,
        timestamp: session.timestamp
      });
    }
  });

  const exitCounts = new Map();
  lastPages.forEach(({ pageUrl }) => {
    if (pageUrl) {
      exitCounts.set(pageUrl, (exitCounts.get(pageUrl) || 0) + 1);
    }
  });

  return Array.from(exitCounts.entries())
    .map(([page, exits]) => ({ page, exits }))
    .sort((a, b) => b.exits - a.exits)
    .slice(0, 10);
}

async function getBounceRate(pageId: string | null, startDate: Date) {
  const sessions = await db.userBehavior.groupBy({
    by: ['sessionId'],
    where: {
      pageId: pageId || undefined,
      timestamp: { gte: startDate }
    },
    _count: { sessionId: true },
    having: {
      sessionId: {
        _count: { equals: 1 }
      }
    }
  });

  const totalSessions = await getUniqueSessions(pageId, startDate);
  const bouncedSessions = sessions.length;
  
  return totalSessions > 0 ? (bouncedSessions / totalSessions) * 100 : 0;
}

async function getAvgSessionDuration(startDate: Date) {
  const sessions = await db.userBehavior.findMany({
    where: {
      timestamp: { gte: startDate }
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
    durations.reduce((a, b) => a + b, 0) / durations.length : 0;
}