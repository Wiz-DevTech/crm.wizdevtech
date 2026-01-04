import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status') || '';
    const customerId = searchParams.get('customerId') || '';

    const where: any = {};
    
    if (status) {
      where.status = status;
    }
    
    if (customerId) {
      where.customerId = customerId;
    }

    const [payments, total] = await Promise.all([
      db.payment.findMany({
        where,
        include: {
          customer: {
            select: { id: true, name: true, email: true }
          },
          invoice: {
            select: { id: true, invoiceNumber: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      db.payment.count({ where })
    ]);

    return NextResponse.json({
      payments,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching payments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payments' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      amount, 
      currency, 
      customerId, 
      paymentMethodId, 
      invoiceId, 
      description,
      metadata 
    } = body;

    if (!amount || !customerId) {
      return NextResponse.json(
        { error: 'Amount and customer ID are required' },
        { status: 400 }
      );
    }

    // Create payment intent (simplified - in production use Stripe SDK)
    const paymentIntent = {
      id: `pi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      amount,
      currency: currency || 'USD',
      status: 'REQUIRES_PAYMENT_METHOD',
      client_secret: `pi_${Date.now()}_secret_${Math.random().toString(36).substr(2, 9)}`
    };

    // Save payment to database
    const payment = await db.payment.create({
      data: {
        stripePaymentIntentId: paymentIntent.id,
        amount,
        currency: currency || 'USD',
        status: 'PENDING',
        customerId,
        paymentMethodId: paymentMethodId || null,
        invoiceId: invoiceId || null,
        description: description || null,
        metadata: metadata || {},
        stripeResponse: paymentIntent
      },
      include: {
        customer: {
          select: { id: true, name: true, email: true }
        },
        invoice: {
          select: { id: true, invoiceNumber: true }
        }
      }
    });

    return NextResponse.json({
      payment,
      client_secret: paymentIntent.client_secret
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating payment:', error);
    return NextResponse.json(
      { error: 'Failed to create payment' },
      { status: 500 }
    );
  }
}