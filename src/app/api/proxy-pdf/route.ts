import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
    const url = req.nextUrl.searchParams.get('url');
    const type = req.nextUrl.searchParams.get('type') || 'application/pdf';

    if (!url) {
        return new NextResponse('Missing URL', { status: 400 });
    }

    try {
        // Cloudinary sometimes blocks default Node.js fetches (no User-Agent) with a 401 Unauthorized.
        // We pass standard browser headers to bypass this.
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch from Cloudinary: ${response.status} ${response.statusText}`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        
        // Return the raw buffer with explicit headers to force inline rendering
        // We use the 'type' query parameter to ensure PDFs get 'application/pdf' even if Cloudinary sends 'image/...'
        return new NextResponse(arrayBuffer, {
            headers: {
                'Content-Type': type,
                'Content-Disposition': 'inline',
                'Cache-Control': 'public, max-age=31536000, immutable',
            }
        });
    } catch (error) {
        console.error("File Proxy error:", error);
        return new NextResponse('Error fetching file', { status: 500 });
    }
}
