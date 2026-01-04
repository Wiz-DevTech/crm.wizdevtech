import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { newsletterId, sendImmediately = false } = body;

    if (!newsletterId) {
      return NextResponse.json(
        { error: 'Newsletter ID is required' },
        { status: 400 }
      );
    }

    // Get newsletter and list
    const newsletter = await db.newsletter.findUnique({
      where: { id: newsletterId },
      include: {
        list: {
          include: {
            contacts: true
          }
        }
      }
    });

    if (!newsletter) {
      return NextResponse.json(
        { error: 'Newsletter not found' },
        { status: 404 }
      );
    }

    if (newsletter.status === 'SENT') {
      return NextResponse.json(
        { error: 'Newsletter has already been sent' },
        { status: 400 }
      );
    }

    // Update newsletter status
    const updatedNewsletter = await db.newsletter.update({
      where: { id: newsletterId },
      data: {
        status: sendImmediately ? 'SENDING' : 'SCHEDULED',
        sentAt: sendImmediately ? new Date() : null
      }
    });

    if (sendImmediately) {
      // Create email records for all contacts in the list
      const emailRecords = newsletter.list.contacts.map(contact => ({
        to: contact.email,
        subject: newsletter.subject,
        content: newsletter.content,
        htmlContent: newsletter.htmlContent,
        status: 'PENDING',
        newsletterId: newsletter.id,
        contactId: contact.id,
        listId: newsletter.listId,
        sentAt: new Date()
      }));

      // Bulk create email records
      await db.sentEmail.createMany({
        data: emailRecords
      });

      // Update newsletter status to SENT
      await db.newsletter.update({
        where: { id: newsletterId },
        data: { status: 'SENT' }
      });

      return NextResponse.json({
        success: true,
        message: `Newsletter scheduled for sending to ${newsletter.list.contacts.length} contacts`,
        totalRecipients: newsletter.list.contacts.length
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Newsletter scheduled successfully',
      scheduledAt: newsletter.scheduledAt
    });

  } catch (error) {
    console.error('Error sending newsletter:', error);
    return NextResponse.json(
      { error: 'Failed to send newsletter' },
      { status: 500 }
    );
  }
}