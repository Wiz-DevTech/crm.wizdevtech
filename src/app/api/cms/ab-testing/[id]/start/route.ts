import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST /api/cms/ab-testing/[id]/start - Start A/B test
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

    if (test.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Only draft tests can be started' },
        { status: 400 }
      );
    }

    const updatedTest = await db.aBTest.update({
      where: { id: params.id },
      data: {
        status: 'RUNNING',
        startDate: new Date()
      }
    });

    return NextResponse.json(updatedTest);
  } catch (error) {
    console.error('Error starting A/B test:', error);
    return NextResponse.json(
      { error: 'Failed to start A/B test' },
      { status: 500 }
    );
  }
}