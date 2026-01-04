import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST /api/cms/ab-testing/[id]/track - Track conversion
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { variant, sessionId } = body;

    if (!variant || !sessionId) {
      return NextResponse.json(
        { error: 'Variant and sessionId are required' },
        { status: 400 }
      );
    }

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
        { error: 'Test is not running' },
        { status: 400 }
      );
    }

    // Update conversion counts
    const updateData: any = {};
    if (variant === 'A') {
      updateData.conversionsA = { increment: 1 };
    } else if (variant === 'B') {
      updateData.conversionsB = { increment: 1 };
    } else {
      return NextResponse.json(
        { error: 'Invalid variant' },
        { status: 400 }
      );
    }

    await db.aBTest.update({
      where: { id: params.id },
      data: updateData
    });

    return NextResponse.json({ message: 'Conversion tracked' });
  } catch (error) {
    console.error('Error tracking conversion:', error);
    return NextResponse.json(
      { error: 'Failed to track conversion' },
      { status: 500 }
    );
  }
}