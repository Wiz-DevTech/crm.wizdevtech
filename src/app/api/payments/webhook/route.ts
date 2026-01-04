import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, data } = body;

    // Handle different Stripe webhook events
    switch (type) {
      case 'payment_intent.succeeded':
        await handlePaymentSucceeded(data.object);
        break;
      
      case 'payment_intent.payment_failed':
        await handlePaymentFailed(data.object);
        break;
      
      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(data.object);
        break;
      
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(data.object);
        break;
      
      case 'customer.subscription.created':
        await handleSubscriptionCreated(data.object);
        break;
      
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(data.object);
        break;
      
      default:
        console.log(`Unhandled webhook type: ${type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

async function handlePaymentSucceeded(paymentIntent: any) {
  // Update payment status
  await db.payment.updateMany({
    where: { stripePaymentIntentId: paymentIntent.id },
    data: {
      status: 'COMPLETED',
      paidAt: new Date(),
      stripeResponse: paymentIntent
    }
  });

  // Create transaction record
  await db.transaction.create({
    data: {
      type: 'PAYMENT',
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: 'COMPLETED',
      customerId: paymentIntent.customer,
      paymentId: paymentIntent.id,
      description: `Payment for ${paymentIntent.description || 'services'}`,
      metadata: paymentIntent.metadata || {},
      stripeTransactionId: paymentIntent.charges?.data?.[0]?.id || null
    }
  });
}

async function handlePaymentFailed(paymentIntent: any) {
  // Update payment status
  await db.payment.updateMany({
    where: { stripePaymentIntentId: paymentIntent.id },
    data: {
      status: 'FAILED',
      stripeResponse: paymentIntent
    }
  });
}

async function handleInvoicePaymentSucceeded(invoice: any) {
  // Update invoice status
  await db.invoice.updateMany({
    where: { stripeInvoiceId: invoice.id },
    data: {
      status: 'PAID',
      paidAt: new Date(),
      stripeResponse: invoice
    }
  });

  // Create transaction record
  await db.transaction.create({
    data: {
      type: 'INVOICE_PAYMENT',
      amount: invoice.amount_paid,
      currency: invoice.currency,
      status: 'COMPLETED',
      customerId: invoice.customer,
      invoiceId: invoice.id,
      description: `Payment for invoice ${invoice.number}`,
      metadata: { invoiceId: invoice.id },
      stripeTransactionId: invoice.charge || null
    }
  });
}

async function handleInvoicePaymentFailed(invoice: any) {
  // Update invoice status
  await db.invoice.updateMany({
    where: { stripeInvoiceId: invoice.id },
    data: {
      status: 'FAILED',
      stripeResponse: invoice
    }
  });
}

async function handleSubscriptionCreated(subscription: any) {
  // Create subscription record
  await db.subscription.create({
    data: {
      stripeSubscriptionId: subscription.id,
      customerId: subscription.customer,
      status: 'ACTIVE',
      priceId: subscription.items?.data?.[0]?.price?.id || null,
      amount: subscription.items?.data?.[0]?.price?.unit_amount || 0,
      currency: subscription.currency || 'USD',
      interval: subscription.items?.data?.[0]?.price?.recurring?.interval || 'month',
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      stripeResponse: subscription
    }
  });
}

async function handleSubscriptionDeleted(subscription: any) {
  // Update subscription status
  await db.subscription.updateMany({
    where: { stripeSubscriptionId: subscription.id },
    data: {
      status: 'CANCELED',
      canceledAt: new Date(),
      stripeResponse: subscription
    }
  });
}