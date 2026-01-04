import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/crm/email-lists - List email lists
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';

    const where = {
      ...(search && {
        name: { contains: search }
      })
    };

    const [lists, total] = await Promise.all([
      db.emailList.findMany({
        where,
        include: {
          creator: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          _count: {
            select: {
              campaigns: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      db.emailList.count({ where })
    ]);

    // Add contact count to each list
    const listsWithContactCount = await Promise.all(
      lists.map(async (list) => {
        const contacts = JSON.parse(list.contacts || '[]');
        return {
          ...list,
          contactCount: contacts.length
        };
      })
    );

    return NextResponse.json({
      lists: listsWithContactCount,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching email lists:', error);
    return NextResponse.json(
      { error: 'Failed to fetch email lists' },
      { status: 500 }
    );
  }
}

// POST /api/crm/email-lists - Create new email list
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      description,
      contacts,
      createdBy
    } = body;

    // Validate required fields
    if (!name || !createdBy) {
      return NextResponse.json(
        { error: 'Name and createdBy are required' },
        { status: 400 }
      );
    }

    // Validate contacts array
    const contactArray = Array.isArray(contacts) ? contacts : [];
    
    // Verify all contacts exist
    if (contactArray.length > 0) {
      const existingContacts = await db.contact.findMany({
        where: {
          id: { in: contactArray }
        },
        select: { id: true }
      });

      if (existingContacts.length !== contactArray.length) {
        return NextResponse.json(
          { error: 'One or more contacts not found' },
          { status: 404 }
        );
      }
    }

    const emailList = await db.emailList.create({
      data: {
        name,
        description,
        contacts: JSON.stringify(contactArray),
        createdBy
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    return NextResponse.json(emailList, { status: 201 });
  } catch (error) {
    console.error('Error creating email list:', error);
    return NextResponse.json(
      { error: 'Failed to create email list' },
      { status: 500 }
    );
  }
}