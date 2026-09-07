import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { url } = await request.json();
    
    if (!url || !url.includes('http')) {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
    }

    // Perform a HEAD request and follow redirects
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow', // Follow redirects to get the final URL
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });

    const finalUrl = response.url;
    
    // Extract coordinates from final URL
    // e.g., @33.272530,44.539200 or q=33.272530,44.539200 or ll=33.272530,44.539200
    const match = finalUrl.match(/([-+]?\d{1,2}\.\d+),\s*([-+]?\d{1,3}\.\d+)/);
    
    if (match) {
      return NextResponse.json({ 
        lat: match[1], 
        lng: match[2],
        finalUrl
      });
    }

    return NextResponse.json({ 
      error: 'Coordinates not found in final URL',
      finalUrl
    }, { status: 404 });
    
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
