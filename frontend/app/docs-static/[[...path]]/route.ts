import { NextRequest, NextResponse } from 'next/server'
import { readFile, stat } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const { path: pathParts = [] } = await params
  let filePath = join(process.cwd(), 'public', 'docs-static', ...pathParts)
  
  if (!existsSync(filePath)) {
    return new NextResponse('Not Found', { status: 404 })
  }
  
  try {
    // Check if it's a directory
    const stats = await stat(filePath)
    if (stats.isDirectory()) {
      // If it's a directory, look for index.html inside it
      const indexPath = join(filePath, 'index.html')
      if (existsSync(indexPath)) {
        filePath = indexPath
      } else {
        return new NextResponse('Not Found', { status: 404 })
      }
    }
    
    // Read the file
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
    
    const contentType = contentTypes[ext || ''] || (isBinary ? 'application/octet-stream' : 'text/html')
    
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

