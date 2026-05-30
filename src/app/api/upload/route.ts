import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const UPLOAD_DIR = '/home/z/my-project/upload';
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

const ALLOWED_EXTENSIONS: Set<string> = new Set([
  'mp4', 'webm', 'ogg', 'ogv', 'mov', 'm4v', 'avi', 'mkv',
]);

function generateUniqueFilename(originalName: string): string {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 10);
  const ext = path.extname(originalName).toLowerCase().replace('.', '');
  const baseName = path.basename(originalName, path.extname(originalName))
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .substring(0, 50);
  return `${baseName}_${timestamp}_${randomSuffix}.${ext}`;
}

export async function POST(request: NextRequest) {
  try {
    // Ensure upload directory exists (mkdir with recursive is idempotent)
    await mkdir(UPLOAD_DIR, { recursive: true });

    // Parse the multipart form data
    const formData = await request.formData();
    const file = formData.get('video') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No video file provided. Use "video" as the form field name.' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size exceeds the 500MB limit. Your file is ${(file.size / (1024 * 1024)).toFixed(1)}MB.` },
        { status: 413 }
      );
    }

    // Validate file extension
    const ext = path.extname(file.name).toLowerCase().replace('.', '');
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        { error: `Unsupported video format ".${ext}". Allowed formats: ${Array.from(ALLOWED_EXTENSIONS).join(', ')}` },
        { status: 415 }
      );
    }

    // Generate unique filename
    const uniqueFilename = generateUniqueFilename(file.name);
    const filePath = path.join(UPLOAD_DIR, uniqueFilename);

    // Write the file to disk
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    const url = `/api/upload/${uniqueFilename}`;

    return NextResponse.json({
      url,
      filename: uniqueFilename,
    }, { status: 201 });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload file. Please try again.' },
      { status: 500 }
    );
  }
}
