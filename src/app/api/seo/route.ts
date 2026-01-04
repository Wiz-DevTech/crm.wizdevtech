import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const pageId = searchParams.get('pageId')
    
    if (pageId) {
      // Get SEO data for specific page
      const seoData = await db.seoMeta.findUnique({
        where: { pageId },
        include: {
          page: {
            select: {
              id: true,
              title: true,
              slug: true,
              content: true
            }
          }
        }
      })
      
      if (!seoData) {
        return NextResponse.json(
          { error: 'SEO data not found' },
          { status: 404 }
        )
      }
      
      return NextResponse.json(seoData)
    } else {
      // Get SEO overview for all pages
      const pages = await db.page.findMany({
        include: {
          seo: true,
          _count: {
            select: {
              keywords: true
            }
          }
        }
      })
      
      // Calculate SEO scores
      const seoScores = await Promise.all(
        pages.map(async (page) => {
          const score = await calculateSeoScore(page)
          return {
            pageId: page.id,
            title: page.title,
            slug: page.slug,
            score: score.overall,
            breakdown: score
          }
        })
      )
      
      return NextResponse.json({
        scores: seoScores,
        overview: {
          totalPages: pages.length,
          avgScore: Math.round(seoScores.reduce((acc, curr) => acc + curr.score, 0) / seoScores.length),
          optimizedPages: seoScores.filter(s => s.score >= 80).length,
          needsImprovement: seoScores.filter(s => s.score < 80).length
        }
      })
    }
  } catch (error) {
    console.error('Error fetching SEO data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch SEO data' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { pageId, ...seoData } = body
    
    if (!pageId) {
      return NextResponse.json(
        { error: 'Page ID is required' },
        { status: 400 }
      )
    }
    
    // Check if page exists
    const page = await db.page.findUnique({
      where: { id: pageId }
    })
    
    if (!page) {
      return NextResponse.json(
        { error: 'Page not found' },
        { status: 404 }
      )
    }
    
    // Update or create SEO metadata
    const seo = await db.seoMeta.upsert({
      where: { pageId },
      update: seoData,
      create: {
        pageId,
        ...seoData
      }
    })
    
    return NextResponse.json(seo)
  } catch (error) {
    console.error('Error updating SEO data:', error)
    return NextResponse.json(
      { error: 'Failed to update SEO data' },
      { status: 500 }
    )
  }
}

async function calculateSeoScore(page: any) {
  let score = {
    overall: 0,
    content: 0,
    technical: 0,
    meta: 0
  }
  
  // Content score (40%)
  const wordCount = page.content.length / 5 // Rough estimate
  if (wordCount >= 300) score.content += 25
  if (wordCount >= 1000) score.content += 15
  if (page.content.includes('h1>') || page.content.includes('<h1')) score.content += 20
  if (page.content.includes('h2>') || page.content.includes('<h2')) score.content += 20
  if (page.content.includes('img')) score.content += 20
  
  // Technical SEO score (30%)
  if (page.slug && page.slug.length > 0) score.technical += 30
  if (page.status === 'PUBLISHED') score.technical += 40
  if (page.updatedAt) score.technical += 30
  
  // Meta score (30%)
  if (page.seo) {
    if (page.seo.metaTitle && page.seo.metaTitle.length > 0) score.meta += 20
    if (page.seo.metaDescription && page.seo.metaDescription.length > 0) score.meta += 20
    if (page.seo.ogTitle && page.seo.ogTitle.length > 0) score.meta += 15
    if (page.seo.ogDescription && page.seo.ogDescription.length > 0) score.meta += 15
    if (page.seo.focusKeywords && page.seo.focusKeywords.length > 0) score.meta += 30
  }
  
  // Calculate overall score
  score.overall = Math.round(
    (score.content * 0.4) + (score.technical * 0.3) + (score.meta * 0.3)
  )
  
  return score
}