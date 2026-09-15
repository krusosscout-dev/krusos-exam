import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { INITIAL_EXAMS, ExamRecord } from '@/services/examData';

const LOCAL_DATA_DIR = path.join(process.cwd(), 'src', 'data');
const LOCAL_DATA_FILE = path.join(LOCAL_DATA_DIR, 'exams.json');
const TMP_DATA_FILE = path.join('/tmp', 'krusos_exams.json');

// Memory cache as fast fallback
let inMemoryExamsCache: ExamRecord[] | null = null;

// Helper: Cloud KV (Upstash / Vercel KV)
async function getCloudKV(key: string): Promise<any | null> {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  try {
    const res = await fetch(`${url}/get/${key}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (res.ok) {
      const data = await res.json();
      if (data.result !== null && data.result !== undefined) {
        return typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
      }
    }
  } catch (err) {
    console.warn('[Cloud KV] Error reading key:', key, err);
  }
  return null;
}

async function setCloudKV(key: string, value: any): Promise<boolean> {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return false;

  try {
    const payload = typeof value === 'string' ? value : JSON.stringify(value);
    const res = await fetch(`${url}/set/${key}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch (err) {
    console.warn('[Cloud KV] Error writing key:', key, err);
    return false;
  }
}

async function readExamsFromStorage(): Promise<ExamRecord[]> {
  // 1. Try Cloud KV if configured (Upstash / Vercel KV)
  const cloudExams = await getCloudKV('krusos_exams');
  if (Array.isArray(cloudExams)) {
    inMemoryExamsCache = cloudExams;
    return cloudExams;
  }

  // 2. Try In-Memory cache (even if empty array [])
  if (inMemoryExamsCache !== null && Array.isArray(inMemoryExamsCache)) {
    return inMemoryExamsCache;
  }

  // 3. Try /tmp storage (writable on Vercel lambda)
  try {
    if (fs.existsSync(TMP_DATA_FILE)) {
      const content = fs.readFileSync(TMP_DATA_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        inMemoryExamsCache = parsed;
        return parsed;
      }
    }
  } catch (e) {}

  // 4. Try local repo file
  try {
    if (fs.existsSync(LOCAL_DATA_FILE)) {
      const content = fs.readFileSync(LOCAL_DATA_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        inMemoryExamsCache = parsed;
        return parsed;
      }
    }
  } catch (error) {
    console.error('Error reading local exams file:', error);
  }

  // 5. Default fallback
  inMemoryExamsCache = INITIAL_EXAMS;
  return INITIAL_EXAMS;
}

async function writeExamsToStorage(exams: ExamRecord[]): Promise<boolean> {
  inMemoryExamsCache = exams;

  // 1. Try Cloud KV if configured
  await setCloudKV('krusos_exams', exams);

  // 2. Try /tmp file (writable on Vercel)
  try {
    fs.writeFileSync(TMP_DATA_FILE, JSON.stringify(exams, null, 2), 'utf-8');
  } catch (e) {}

  // 3. Try local repo file (for local dev)
  try {
    if (!fs.existsSync(LOCAL_DATA_DIR)) {
      fs.mkdirSync(LOCAL_DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(LOCAL_DATA_FILE, JSON.stringify(exams, null, 2), 'utf-8');
    return true;
  } catch (error) {
    // Expected on Vercel read-only filesystem
    return false;
  }
}

export async function GET() {
  try {
    const exams = await readExamsFromStorage();
    return NextResponse.json({ success: true, exams }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const exams = body.exams !== undefined ? body.exams : (Array.isArray(body) ? body : null);

    if (!Array.isArray(exams)) {
      return NextResponse.json({ success: false, error: 'Expected an array of exams' }, { status: 400 });
    }

    await writeExamsToStorage(exams);
    return NextResponse.json({ success: true, count: exams.length }, { status: 200 });
  } catch (error: any) {
    console.error('Error in POST /api/exams:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
