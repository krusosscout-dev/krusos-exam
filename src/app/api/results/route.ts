import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const LOCAL_DATA_DIR = path.join(process.cwd(), 'src', 'data');
const LOCAL_RESULTS_FILE = path.join(LOCAL_DATA_DIR, 'results.json');
const TMP_RESULTS_FILE = path.join('/tmp', 'krusos_results.json');

let inMemoryResultsCache: any[] | null = null;

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
    console.warn('[Cloud KV Results] Error reading key:', key, err);
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
    console.warn('[Cloud KV Results] Error writing key:', key, err);
    return false;
  }
}

async function readResultsFromStorage(): Promise<any[]> {
  // 1. Try Cloud KV
  const cloudResults = await getCloudKV('krusos_results');
  if (Array.isArray(cloudResults)) {
    inMemoryResultsCache = cloudResults;
    return cloudResults;
  }

  // 2. Try In-Memory Cache
  if (inMemoryResultsCache !== null && Array.isArray(inMemoryResultsCache)) {
    return inMemoryResultsCache;
  }

  // 3. Try /tmp
  try {
    if (fs.existsSync(TMP_RESULTS_FILE)) {
      const content = fs.readFileSync(TMP_RESULTS_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        inMemoryResultsCache = parsed;
        return parsed;
      }
    }
  } catch (e) {}

  // 4. Try local repo file
  try {
    if (fs.existsSync(LOCAL_RESULTS_FILE)) {
      const content = fs.readFileSync(LOCAL_RESULTS_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      inMemoryResultsCache = Array.isArray(parsed) ? parsed : [];
      return inMemoryResultsCache;
    }
  } catch (error) {
    console.error('Error reading results data file:', error);
  }

  inMemoryResultsCache = [];
  return [];
}

async function writeResultsToStorage(results: any[]): Promise<boolean> {
  inMemoryResultsCache = results;

  // 1. Try Cloud KV
  await setCloudKV('krusos_results', results);

  // 2. Try /tmp (Vercel lambda)
  try {
    fs.writeFileSync(TMP_RESULTS_FILE, JSON.stringify(results, null, 2), 'utf-8');
  } catch (e) {}

  // 3. Try local repo file
  try {
    if (!fs.existsSync(LOCAL_DATA_DIR)) {
      fs.mkdirSync(LOCAL_DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(LOCAL_RESULTS_FILE, JSON.stringify(results, null, 2), 'utf-8');
    return true;
  } catch (error) {
    return false;
  }
}

export async function GET() {
  try {
    const results = await readResultsFromStorage();
    return NextResponse.json({ success: true, results }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const newResult = body.result || body;

    if (!newResult) {
      return NextResponse.json({ success: false, error: 'Empty payload' }, { status: 400 });
    }

    const existing = await readResultsFromStorage();

    // If an array is sent, replace all results (e.g. admin clearing results)
    if (Array.isArray(newResult)) {
      await writeResultsToStorage(newResult);
      return NextResponse.json({ success: true, count: newResult.length }, { status: 200 });
    }

    // Otherwise append new student result
    const filtered = existing.filter((r: any) => 
      !(r.id && newResult.id && r.id === newResult.id) &&
      !(r.accessCode === newResult.accessCode && r.studentId && newResult.studentId && r.studentId === newResult.studentId)
    );

    const updated = [newResult, ...filtered];
    await writeResultsToStorage(updated);

    return NextResponse.json({ success: true, result: newResult }, { status: 200 });
  } catch (error: any) {
    console.error('Error in POST /api/results:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
