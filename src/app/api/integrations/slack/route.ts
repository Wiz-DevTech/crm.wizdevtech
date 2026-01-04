import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const channel = searchParams.get('channel') || '';

    const where: any = {};
    
    if (channel) {
      where.channel = channel;
    }

    const [notifications, total] = await Promise.all([
      db.slackNotification.findMany({
        where,
        include: {
          sentBy: {
            select: { id: true, name: true, email: true }
          }
        },
        orderBy: { sentAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      db.slackNotification.count({ where })
    ]);

    return NextResponse.json({
      notifications,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching Slack notifications:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Slack notifications' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      channel, 
      message, 
      webhookUrl, 
      sentById 
    } = body;

    if (!channel || !message) {
      return NextResponse.json(
        { error: 'Channel and message are required' },
        { status: 400 }
      );
    }

    // Send to Slack (simplified - in production you'd use proper Slack SDK)
    let slackResponse = null;
    let status = 'FAILED';
    
    if (webhookUrl) {
      try {
        const slackPayload = {
          channel,
          text: message,
          username: 'WizDevTech CMS'
        };

        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(slackPayload)
        });

        if (response.ok) {
          slackResponse = await response.text();
          status = 'SENT';
        }
      } catch (slackError) {
        console.error('Slack API error:', slackError);
        status = 'FAILED';
      }
    }

    // Log the notification
    const notification = await db.slackNotification.create({
      data: {
        channel,
        message,
        webhookUrl: webhookUrl || null,
        status,
        response: slackResponse,
        sentById: sentById || null
      },
      include: {
        sentBy: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    return NextResponse.json(notification, { status: 201 });
  } catch (error) {
    console.error('Error sending Slack notification:', error);
    return NextResponse.json(
      { error: 'Failed to send Slack notification' },
      { status: 500 }
    );
  }
}