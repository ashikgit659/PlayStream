import { NextRequest, NextResponse } from 'next/server';
import { stat, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { createReadStream, openSync, closeSync, readSync } from 'fs';

const UPLOAD_DIR = '/home/z/my-project/upload';

const CONTENT_TYPES: Record<string, string> = {
  mp4: 'video/mp4',
  webm: 'video/webm',
  ogg: 'video/ogg',
  ogv: 'video/ogg',
  mov: 'video/quicktime',
  m4v: 'video/mp4',
  avi: 'video/x-msvideo',
  mkv: 'video/x-matroska',
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ file: string }> }
) {
  try {
    const { file: filename } = await params;

    // Sanitize filename to prevent directory traversal
    const sanitized = path.basename(filename);
    const filePath = path.join(UPLOAD_DIR, sanitized);

    // Check file exists
    if (!existsSync(filePath)) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    // Get file stats
    const fileStat = await stat(filePath);
    const fileSize = fileStat.size;

    // Determine content type
    const ext = path.extname(sanitized).toLowerCase().replace('.', '');
    const contentType = CONTENT_TYPES[ext] || 'application/octet-stream';

    // Handle range requests for video seeking
    const rangeHeader = request.headers.get('range');

    if (rangeHeader) {
      // Parse the Range header (e.g., "bytes=0-1023")
      const rangeMatch = rangeHeader.match(/bytes=(\d*)-(\d*)/);
      if (!rangeMatch) {
        return NextResponse.json(
          { error: 'Invalid range header' },
          { status: 416 }
        );
      }

      const startStr = rangeMatch[1];
      const endStr = rangeMatch[2];

      let start: number;
      let end: number;

      if (startStr === '' && endStr === '') {
        return NextResponse.json(
          { error: 'Invalid range' },
          { status: 416 }
        );
      }

      if (startStr === '') {
        // Suffix range: bytes=-N means the last N bytes
        const suffixLength = parseInt(endStr, 10);
        start = Math.max(0, fileSize - suffixLength);
        end = fileSize - 1;
      } else {
        start = parseInt(startStr, 10);
        if (endStr === '') {
          end = fileSize - 1;
        } else {
          end = parseInt(endStr, 10);
        }
      }

      // Clamp values
      if (start >= fileSize || end >= fileSize) {
        return new NextResponse(null, {
          status: 416,
          headers: {
            'Content-Range': `bytes */${fileSize}`,
          },
        });
      }

      start = Math.max(0, start);
      end = Math.min(fileSize - 1, end);

      const contentLength = end - start + 1;

      // Read only the requested chunk using file descriptor
      // Note: readFile from fs/promises does NOT support start/end options,
      // so we must use a manual read with a fd for range requests.
      const buffer = Buffer.alloc(contentLength);
      const fd = openSync(filePath, 'r');
      try {
        readSync(fd, buffer, 0, contentLength, start);
      } finally {
        closeSync(fd);
      }

      return new NextResponse(buffer, {
        status: 206,
        headers: {
          'Content-Type': contentType,
          'Content-Length': contentLength.toString(),
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    }

    // No range request - serve the entire file
    // For large files, use streaming via a ReadableStream
    const stream = createReadStream(filePath);
    const readableStream = new ReadableStream({
      start(controller) {
        stream.on('data', (chunk: Buffer) => {
          controller.enqueue(chunk);
        });
        stream.on('end', () => {
          controller.close();
        });
        stream.on('error', (err) => {
          controller.error(err);
        });
      },
      cancel() {
        stream.destroy();
      },
    });

    return new NextResponse(readableStream, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': fileSize.toString(),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });

  } catch (error) {
    console.error('File serve error:', error);
    return NextResponse.json(
      { error: 'Failed to serve file' },
      { status: 500 }
    );
  }
}
