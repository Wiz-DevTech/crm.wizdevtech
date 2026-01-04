import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST /api/crm/email-campaigns/[id]/send - Send campaign
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const campaign = await db.emailCampaign.findUnique({
      where: { id: params.id },
      include: {
        template: true,
        emailList: true
      }
    });

    if (!campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      );
    }

    // Cannot send already sent campaigns
    if (campaign.status === 'SENT') {
      return NextResponse.json(
        { error: 'Campaign already sent' },
        { status: 400 }
      );
    }

    // Check if campaign has email list
    if (!campaign.emailList) {
      return NextResponse.json(
        { error: 'Campaign must have an email list to send' },
        { status: 400 }
      );
    }

    // Parse contact IDs from email list
    const contactIds = JSON.parse(campaign.emailList.contacts || '[]');
    
    if (contactIds.length === 0) {
      return NextResponse.json(
        { error: 'Email list is empty' },
        { status: 400 }
      );
    }

    // Get contacts for the campaign
    const contacts = await db.contact.findMany({
      where: {
        id: { in: contactIds }
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true
      }
    });

    if (contacts.length === 0) {
      return NextResponse.json(
        { error: 'No valid contacts found in email list' },
        { status: 400 }
      );
    }

    // Create recipients for the campaign
    const recipients = contacts.map(contact => ({
      campaignId: campaign.id,
      contactId: contact.id,
      email: contact.email,
      status: 'PENDING'
    }));

    await db.emailCampaignRecipient.createMany({
      data: recipients
    });

    // Update campaign status
    await db.emailCampaign.update({
      where: { id: params.id },
      data: {
        status: 'SENDING',
        sentAt: new Date(),
        totalRecipients: contacts.length,
        totalSent: contacts.length
      }
    });

    // TODO: Implement actual email sending logic here
    // This would integrate with an email service like SendGrid, Mailgun, etc.
    
    // For now, we'll simulate sending by marking all as sent
    await db.emailCampaignRecipient.updateMany({
      where: { campaignId: params.id },
      data: { status: 'SENT' }
    });

    // Update campaign status to sent
    await db.emailCampaign.update({
      where: { id: params.id },
      data: { status: 'SENT' }
    });

    return NextResponse.json({
      message: 'Campaign sent successfully',
      recipientsSent: contacts.length
    });
  } catch (error) {
    console.error('Error sending campaign:', error);
    return NextResponse.json(
      { error: 'Failed to send campaign' },
      { status: 500 }
    );
  }
}