import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug?: string[] }> }
) {
  const { slug = [] } = await params
  const path = slug.join('/')
  
  // Determine the file path
  let filePath: string
  
  // Handle assets (JS, CSS, images, etc.)
  if (path.startsWith('assets/') || path.startsWith('img/') || path.includes('.')) {
    // This is an asset file
    filePath = join(process.cwd(), 'public', 'docs-static', path)
  } else if (path === '' || path === 'index' || !path) {
    // Root /docs should serve overview
    filePath = join(process.cwd(), 'public', 'docs-static', 'overview', 'index.html')
  } else {
    // Check if it's a directory (needs index.html) or a file
    const dirPath = join(process.cwd(), 'public', 'docs-static', path)
    const filePathWithHtml = join(process.cwd(), 'public', 'docs-static', `${path}.html`)
    const indexPath = join(dirPath, 'index.html')
    
    if (existsSync(indexPath)) {
      filePath = indexPath
    } else if (existsSync(filePathWithHtml)) {
      filePath = filePathWithHtml
    } else {
      // Try as directory with index.html
      filePath = indexPath
    }
  }
  
  // Check if file exists
  if (!existsSync(filePath)) {
    // Try 404 page
    const notFoundPath = join(process.cwd(), 'public', 'docs-static', '404.html')
    if (existsSync(notFoundPath)) {
      const content = await readFile(notFoundPath, 'utf-8')
      return new NextResponse(content, {
        status: 404,
        headers: {
          'Content-Type': 'text/html',
        },
      })
    }
    return new NextResponse('Not Found', { status: 404 })
  }
  
  try {
    // Read file as buffer for binary files, text for HTML/JS/CSS
    const isBinary = filePath.match(/\.(png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/i)
    const content = isBinary 
      ? await readFile(filePath)
      : await readFile(filePath, 'utf-8')
    
    // Determine content type from extension
    const ext = filePath.split('.').pop()?.toLowerCase()
    const contentTypes: Record<string, string> = {
      'html': 'text/html',
      'js': 'application/javascript',
      'css': 'text/css',
      'json': 'application/json',
      'xml': 'application/xml',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'svg': 'image/svg+xml',
      'ico': 'image/x-icon',
      'woff': 'font/woff',
      'woff2': 'font/woff2',
      'ttf': 'font/ttf',
      'eot': 'application/vnd.ms-fontobject',
    }
    
    const contentType = contentTypes[ext || ''] || 'text/html'
    
    return new NextResponse(content, {
      headers: {
        'Content-Type': contentType,
      },
    })
  } catch (error) {
    console.error('Error reading file:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

