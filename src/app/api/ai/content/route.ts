import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      type, 
      topic, 
      keywords, 
      tone, 
      length, 
      targetAudience, 
      pageId,
      createdById 
    } = body;

    if (!type || !topic) {
      return NextResponse.json(
        { error: 'Type and topic are required' },
        { status: 400 }
      );
    }

    // Generate content using AI (simplified - in production use OpenAI/LLM SDK)
    const generatedContent = await generateContent({
      type,
      topic,
      keywords: keywords || [],
      tone: tone || 'professional',
      length: length || 'medium',
      targetAudience: targetAudience || 'general'
    });

    // Save generated content
    const contentGeneration = await db.contentGeneration.create({
      data: {
        type,
        topic,
        keywords: keywords || [],
        tone: tone || 'professional',
        length: length || 'medium',
        targetAudience: targetAudience || 'general',
        generatedContent: generatedContent.content,
        generatedTitle: generatedContent.title,
        generatedMeta: generatedContent.meta,
        status: 'COMPLETED',
        pageId: pageId || null,
        createdById: createdById || null,
        model: 'gpt-4',
        prompt: generatedContent.prompt
      },
      include: {
        page: {
          select: { id: true, title: true, slug: true }
        },
        createdBy: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    return NextResponse.json(contentGeneration, { status: 201 });
  } catch (error) {
    console.error('Error generating content:', error);
    return NextResponse.json(
      { error: 'Failed to generate content' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const type = searchParams.get('type') || '';
    const status = searchParams.get('status') || '';

    const where: any = {};
    
    if (type) {
      where.type = type;
    }
    
    if (status) {
      where.status = status;
    }

    const [generations, total] = await Promise.all([
      db.contentGeneration.findMany({
        where,
        include: {
          page: {
            select: { id: true, title: true, slug: true }
          },
          createdBy: {
            select: { id: true, name: true, email: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      db.contentGeneration.count({ where })
    ]);

    return NextResponse.json({
      generations,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching content generations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch content generations' },
      { status: 500 }
    );
  }
}

// AI Content Generation Function (simplified)
async function generateContent(params: {
  type: string;
  topic: string;
  keywords: string[];
  tone: string;
  length: string;
  targetAudience: string;
}) {
  const { type, topic, keywords, tone, length, targetAudience } = params;
  
  // Build prompt based on type
  let prompt = `Generate ${type} content about "${topic}"`;
  
  if (keywords.length > 0) {
    prompt += ` using these keywords: ${keywords.join(', ')}`;
  }
  
  prompt += `. Use a ${tone} tone for ${targetAudience} audience. `;
  
  // Adjust length
  const wordCount = length === 'short' ? '300-500' : length === 'medium' ? '800-1200' : '1500-2000';
  prompt += `The content should be ${wordCount} words.`;

  // Simulate AI content generation (in production, use actual AI service)
  const generatedContent = generateMockContent(type, topic, keywords, tone);
  
  return {
    content: generatedContent.content,
    title: generatedContent.title,
    meta: {
      description: generatedContent.description,
      keywords: keywords
    },
    prompt
  };
}

// Mock content generation (replace with actual AI service)
function generateMockContent(type: string, topic: string, keywords: string[], tone: string) {
  const titles = {
    blog: `The Ultimate Guide to ${topic}`,
    service: `${topic}: Professional Services That Deliver Results`,
    page: `${topic} - Complete Solution for Your Business`,
    email: `Important Update About ${topic}`,
    social: `Exciting News: ${topic} is Here!`
  };

  const content = `
# ${titles[type as keyof typeof titles] || topic}

${topic} is transforming the way businesses operate in today's competitive landscape. 
Our comprehensive approach ensures that you get the best possible results while maintaining 
the highest standards of quality and professionalism.

## Why Choose Our ${topic} Solutions?

With years of experience in the industry, we understand the unique challenges that businesses 
face when implementing ${topic} solutions. Our team of experts is dedicated to providing 
tailored solutions that meet your specific needs.

### Key Benefits:

1. **Expert Implementation**: Our team brings extensive experience in ${topic} deployment
2. **Custom Solutions**: We tailor our approach to your specific business requirements
3. **Ongoing Support**: Continuous monitoring and optimization for optimal performance
4. **Proven Results**: Track record of successful ${topic} implementations across industries

## Our Process

We follow a systematic approach to ensure successful ${topic} implementation:

1. **Discovery Phase**: Understanding your unique requirements and challenges
2. **Planning Phase**: Developing a comprehensive strategy tailored to your needs
3. **Implementation Phase**: Executing the plan with precision and expertise
4. **Optimization Phase**: Continuous improvement and fine-tuning

## Get Started Today

Ready to transform your business with ${topic}? Contact our team to learn more about 
how we can help you achieve your goals.

${keywords.map(keyword => `#${keyword}`).join(' ')}
  `.trim();

  const description = `Discover how our ${topic} solutions can transform your business. 
  Expert implementation, custom solutions, and proven results for ${targetAudience}.`;

  return {
    title: titles[type as keyof typeof titles] || topic,
    content,
    description
  };
}