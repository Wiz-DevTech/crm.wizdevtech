import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST /api/crm/segments/analyze - Analyze and suggest segments
export async function POST(request: NextRequest) {
  try {
    // Get all contacts for analysis
    const contacts = await db.contact.findMany({
      select: {
        id: true,
        company: true,
        status: true,
        source: true,
        createdAt: true
      }
    });

    // Get deals for analysis
    const deals = await db.deal.findMany({
      include: {
        contact: {
          select: {
            id: true,
            company: true,
            status: true
          }
        }
      }
    });

    // AI-powered segmentation analysis
    const suggestions = generateSegmentSuggestions(contacts, deals);

    return NextResponse.json({
      suggestions,
      totalContacts: contacts.length,
      totalDeals: deals.length
    });
  } catch (error) {
    console.error('Error analyzing segments:', error);
    return NextResponse.json(
      { error: 'Failed to analyze segments' },
      { status: 500 }
    );
  }
}

// AI-powered segment suggestions
function generateSegmentSuggestions(contacts: any[], deals: any[]) {
  const suggestions = [];

  // Analyze by company size (if available)
  const companies = contacts.filter(c => c.company).map(c => c.company);
  const uniqueCompanies = [...new Set(companies)];
  
  if (uniqueCompanies.length > 5) {
    suggestions.push({
      name: 'Enterprise Customers',
      description: 'Contacts from large companies',
      criteria: {
        company: { includes: 'Corp' }, // Simple heuristic
        status: ['ACTIVE']
      },
      estimatedSize: Math.floor(uniqueCompanies.length * 0.2)
    });
  }

  // Analyze by status
  const statusCounts = contacts.reduce((acc: any, contact) => {
    acc[contact.status] = (acc[contact.status] || 0) + 1;
    return acc;
  }, {});

  if (statusCounts.LEAD > 10) {
    suggestions.push({
      name: 'New Leads',
      description: 'Contacts that are still in lead status',
      criteria: {
        status: ['LEAD'],
        dateRange: {
          from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        }
      },
      estimatedSize: statusCounts.LEAD
    });
  }

  // Analyze by source
  const sourceCounts = contacts.reduce((acc: any, contact) => {
    if (contact.source) {
      acc[contact.source] = (acc[contact.source] || 0) + 1;
    }
    return acc;
  }, {});

  Object.entries(sourceCounts).forEach(([source, count]) => {
    if (count > 5) {
      suggestions.push({
        name: `${source} Sources`,
        description: `Contacts acquired from ${source}`,
        criteria: {
          source: [source]
        },
        estimatedSize: count as number
      });
    }
  });

  // Analyze by deal history
  const contactsWithDeals = deals.map(d => d.contact.id);
  const contactsWithoutDeals = contacts.filter(c => !contactsWithDeals.includes(c.id));

  if (contactsWithoutDeals.length > 10) {
    suggestions.push({
      name: 'Untapped Potential',
      description: 'Contacts without any deals yet',
      criteria: {
        hasDeals: false
      },
      estimatedSize: contactsWithoutDeals.length
    });
  }

  // High-value contacts
  const highValueContacts = deals
    .filter(d => d.value && d.value > 10000)
    .map(d => d.contact.id);

  if (highValueContacts.length > 0) {
    suggestions.push({
      name: 'High Value Prospects',
      description: 'Contacts with deals worth over $10,000',
      criteria: {
        dealValue: { min: 10000 }
      },
      estimatedSize: [...new Set(highValueContacts)].length
    });
  }

  return suggestions.slice(0, 6); // Return top 6 suggestions
}