import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST /api/cms/ab-testing/[id]/complete - Complete A/B test
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const test = await db.aBTest.findUnique({
      where: { id: params.id }
    });

    if (!test) {
      return NextResponse.json(
        { error: 'A/B test not found' },
        { status: 404 }
      );
    }

    if (test.status !== 'RUNNING') {
      return NextResponse.json(
        { error: 'Only running tests can be completed' },
        { status: 400 }
      );
    }

    // Calculate winner and confidence
    const stats = calculateABTestStats(test);
    const winner = determineWinner(test, stats);
    const confidence = calculateConfidence(test, stats);

    const updatedTest = await db.aBTest.update({
      where: { id: params.id },
      data: {
        status: 'COMPLETED',
        endDate: new Date(),
        winner,
        confidence
      }
    });

    return NextResponse.json({
      ...updatedTest,
      stats,
      winner,
      confidence
    });
  } catch (error) {
    console.error('Error completing A/B test:', error);
    return NextResponse.json(
      { error: 'Failed to complete A/B test' },
      { status: 500 }
    );
  }
}

// Calculate A/B test statistics
function calculateABTestStats(test: any) {
  const conversionRateA = test.impressionsA > 0 ? (test.conversionsA / test.impressionsA) * 100 : 0;
  const conversionRateB = test.impressionsB > 0 ? (test.conversionsB / test.impressionsB) * 100 : 0;
  
  const totalImpressions = test.impressionsA + test.impressionsB;
  const totalConversions = test.conversionsA + test.conversionsB;
  const overallConversionRate = totalImpressions > 0 ? (totalConversions / totalImpressions) * 100 : 0;

  return {
    conversionRateA: Math.round(conversionRateA * 100) / 100,
    conversionRateB: Math.round(conversionRateB * 100) / 100,
    totalImpressions,
    totalConversions,
    overallConversionRate: Math.round(overallConversionRate * 100) / 100,
    improvement: conversionRateA > 0 ? Math.round(((conversionRateB - conversionRateA) / conversionRateA) * 10000) / 100 : 0
  };
}

// Determine test winner
function determineWinner(test: any, stats: any) {
  if (stats.conversionRateA > stats.conversionRateB) {
    return 'A';
  } else if (stats.conversionRateB > stats.conversionRateA) {
    return 'B';
  } else {
    return 'INCONCLUSIVE';
  }
}

// Calculate statistical confidence
function calculateConfidence(test: any, stats: any) {
  // Simple Z-test for statistical significance
  const p1 = stats.conversionRateA / 100;
  const p2 = stats.conversionRateB / 100;
  const n1 = test.impressionsA;
  const n2 = test.impressionsB;

  if (n1 === 0 || n2 === 0) return 0;

  const pooledProportion = (test.conversionsA + test.conversionsB) / (n1 + n2);
  const standardError = Math.sqrt(pooledProportion * (1 - pooledProportion) * (1/n1 + 1/n2));
  
  if (standardError === 0) return 0;

  const zScore = Math.abs(p1 - p2) / standardError;
  const confidence = Math.round((1 - 2 * (1 - normalCDF(zScore))) * 100);

  return Math.max(0, Math.min(100, confidence));
}

// Normal cumulative distribution function approximation
function normalCDF(z: number) {
  return 0.5 * (1 + erf(z / Math.sqrt(2)));
}

// Error function approximation
function erf(x: number) {
  const a1 =  0.254829592;
  const a2 = -0.284496736;
  const a3 =  1.421413741;
  const a4 = -1.453152027;
  const a5 =  1.061405429;
  const p  =  0.3275911;

  const sign = x >= 0 ? 1 : -1;
  x = Math.abs(x);

  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return sign * y;
}