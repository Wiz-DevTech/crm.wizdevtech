import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/crm/sales-forecast - Get sales forecasts
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '';
    const limit = parseInt(searchParams.get('limit') || '12');

    const where = period ? { period } : {};

    const forecasts = await db.salesForecast.findMany({
      where,
      orderBy: { period: 'desc' },
      take: limit
    });

    // Calculate current pipeline metrics
    const currentDeals = await db.deal.findMany({
      where: {
        status: 'OPEN'
      },
      select: {
        value: true,
        probability: true,
        stage: true
      }
    });

    const totalPipelineValue = currentDeals.reduce((sum, deal) => sum + (deal.value || 0), 0);
    const weightedPipelineValue = currentDeals.reduce((sum, deal) => 
      sum + ((deal.value || 0) * (deal.probability / 100)), 0
    );

    const dealsByStage = currentDeals.reduce((acc: any, deal) => {
      acc[deal.stage] = (acc[deal.stage] || 0) + 1;
      return acc;
    }, {});

    const avgDealSize = currentDeals.length > 0 
      ? totalPipelineValue / currentDeals.length 
      : 0;

    return NextResponse.json({
      forecasts,
      currentMetrics: {
        totalPipelineValue,
        weightedPipelineValue,
        totalDeals: currentDeals.length,
        avgDealSize,
        dealsByStage
      }
    });
  } catch (error) {
    console.error('Error fetching sales forecast:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sales forecast' },
      { status: 500 }
    );
  }
}

// POST /api/crm/sales-forecast - Generate new forecast
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { period, model } = body;

    if (!period) {
      return NextResponse.json(
        { error: 'Period is required' },
        { status: 400 }
      );
    }

    // Check if forecast already exists for this period
    const existingForecast = await db.salesForecast.findUnique({
      where: { period }
    });

    if (existingForecast) {
      return NextResponse.json(
        { error: 'Forecast already exists for this period' },
        { status: 400 }
      );
    }

    // Get historical data for AI model training
    const historicalDeals = await db.deal.findMany({
      where: {
        actualCloseDate: {
          not: null
        }
      },
      select: {
        value: true,
        actualCloseDate: true,
        status: true,
        createdAt: true
      },
      orderBy: { actualCloseDate: 'desc' },
      take: 100 // Use last 100 deals for training
    });

    // Get current open deals
    const openDeals = await db.deal.findMany({
      where: {
        status: 'OPEN'
      },
      select: {
        value: true,
        probability: true,
        expectedCloseDate: true,
        stage: true,
        createdAt: true
      }
    });

    // AI Sales Forecasting Algorithm
    const forecast = generateSalesForecast(period, historicalDeals, openDeals, model);

    // Save forecast to database
    const savedForecast = await db.salesForecast.create({
      data: {
        period,
        predictedRevenue: forecast.predictedRevenue,
        confidence: forecast.confidence,
        dealCount: forecast.dealCount,
        avgDealSize: forecast.avgDealSize,
        winRate: forecast.winRate,
        model: model || 'ensemble'
      }
    });

    return NextResponse.json(savedForecast, { status: 201 });
  } catch (error) {
    console.error('Error generating sales forecast:', error);
    return NextResponse.json(
      { error: 'Failed to generate sales forecast' },
      { status: 500 }
    );
  }
}

// AI Sales Forecasting Algorithm
function generateSalesForecast(period: string, historicalDeals: any[], openDeals: any[], model?: string) {
  // Historical win rate
  const wonDeals = historicalDeals.filter(deal => deal.status === 'WON');
  const historicalWinRate = historicalDeals.length > 0 ? wonDeals.length / historicalDeals.length : 0;
  
  // Average deal size from historical data
  const avgHistoricalDealSize = wonDeals.length > 0 
    ? wonDeals.reduce((sum, deal) => sum + (deal.value || 0), 0) / wonDeals.length 
    : 0;

  // Current pipeline analysis
  const totalPipelineValue = openDeals.reduce((sum, deal) => sum + (deal.value || 0), 0);
  const weightedPipelineValue = openDeals.reduce((sum, deal) => 
    sum + ((deal.value || 0) * (deal.probability / 100)), 0
  );

  // Deal aging analysis
  const now = new Date();
  const agedDeals = openDeals.filter(deal => {
    const daysSinceCreation = (now.getTime() - new Date(deal.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceCreation > 90; // Deals older than 90 days
  });

  // Stage-based conversion rates
  const stageConversionRates: any = {
    PROSPECTING: 0.1,
    QUALIFICATION: 0.25,
    NEED_ANALYSIS: 0.4,
    VALUE_PROPOSITION: 0.6,
    PROPOSAL: 0.75,
    NEGOTIATION: 0.9
  };

  // Calculate predicted revenue based on model
  let predictedRevenue = 0;
  let confidence = 0;

  if (model === 'conservative') {
    // Conservative model: Use weighted pipeline with historical win rate adjustment
    predictedRevenue = weightedPipelineValue * historicalWinRate * 0.8;
    confidence = 75;
  } else if (model === 'aggressive') {
    // Aggressive model: Use full pipeline with optimistic conversion
    predictedRevenue = totalPipelineValue * 0.3;
    confidence = 60;
  } else {
    // Ensemble model: Combine multiple approaches
    const conservative = weightedPipelineValue * historicalWinRate * 0.8;
    const aggressive = totalPipelineValue * 0.3;
    const stageBased = openDeals.reduce((sum, deal) => 
      sum + ((deal.value || 0) * (stageConversionRates[deal.stage] || 0.1)), 0
    );
    
    predictedRevenue = (conservative + aggressive + stageBased) / 3;
    confidence = 70;
  }

  // Adjust for aged deals (reduce confidence)
  const agedDealRatio = agedDeals.length / openDeals.length;
  confidence = confidence * (1 - agedDealRatio * 0.2);

  // Predict number of deals to close
  const expectedDealsToClose = openDeals.length * historicalWinRate * (1 - agedDealRatio * 0.3);

  return {
    predictedRevenue: Math.round(predictedRevenue * 100) / 100,
    confidence: Math.round(confidence),
    dealCount: Math.round(expectedDealsToClose),
    avgDealSize: avgHistoricalDealSize,
    winRate: Math.round(historicalWinRate * 100)
  };
}