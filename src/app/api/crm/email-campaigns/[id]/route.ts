import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/crm/email-campaigns/[id] - Get specific campaign
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const campaign = await db.emailCampaign.findUnique({
      where: { id: params.id },
      include: {
        template: true,
        emailList: true,
        creator: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        recipients: {
          select: {
            id: true,
            email: true,
            status: true,
            openedAt: true,
            clickedAt: true,
            bouncedAt: true
          }
        }
      }
    });

    if (!campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(campaign);
  } catch (error) {
    console.error('Error fetching campaign:', error);
    return NextResponse.json(
      { error: 'Failed to fetch campaign' },
      { status: 500 }
    );
  }
}

// PUT /api/crm/email-campaigns/[id] - Update campaign
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const {
      name,
      subject,
      templateId,
      listId,
      scheduledAt,
      status
    } = body;

    // Check if campaign exists and can be updated
    const existingCampaign = await db.emailCampaign.findUnique({
      where: { id: params.id }
    });

    if (!existingCampaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      );
    }

    // Cannot update sent campaigns
    if (existingCampaign.status === 'SENT') {
      return NextResponse.json(
        { error: 'Cannot update sent campaign' },
        { status: 400 }
      );
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (subject !== undefined) updateData.subject = subject;
    if (templateId !== undefined) updateData.templateId = templateId;
    if (listId !== undefined) updateData.listId = listId;
    if (scheduledAt !== undefined) {
      updateData.scheduledAt = scheduledAt ? new Date(scheduledAt) : null;
      updateData.status = scheduledAt ? 'SCHEDULED' : 'DRAFT';
    }
    if (status !== undefined) updateData.status = status;

    const campaign = await db.emailCampaign.update({
      where: { id: params.id },
      data: updateData,
      include: {
        template: true,
        emailList: true,
        creator: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    return NextResponse.json(campaign);
  } catch (error) {
    console.error('Error updating campaign:', error);
    return NextResponse.json(
      { error: 'Failed to update campaign' },
      { status: 500 }
    );
  }
}

// DELETE /api/crm/email-campaigns/[id] - Delete campaign
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const existingCampaign = await db.emailCampaign.findUnique({
      where: { id: params.id }
    });

    if (!existingCampaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      );
    }

    // Cannot delete sent campaigns
    if (existingCampaign.status === 'SENT') {
      return NextResponse.json(
        { error: 'Cannot delete sent campaign' },
        { status: 400 }
      );
    }

    await db.emailCampaign.delete({
      where: { id: params.id }
    });

    return NextResponse.json({ message: 'Campaign deleted successfully' });
  } catch (error) {
    console.error('Error deleting campaign:', error);
    return NextResponse.json(
      { error: 'Failed to delete campaign' },
      { status: 500 }
    );
  }
}