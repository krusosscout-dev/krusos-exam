import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { INITIAL_EXAMS, ExamRecord } from '@/services/examData';

const DATA_DIR = path.join(process.cwd(), 'src', 'data');
const DATA_FILE = path.join(DATA_DIR, 'exams.json');

// Memory cache as fallback if filesystem is read-only in serverless environment
let inMemoryExamsCache: ExamRecord[] | null = null;

function readExamsFromStorage(): ExamRecord[] {
  if (inMemoryExamsCache && inMemoryExamsCache.length > 0) {
    return inMemoryExamsCache;
  }

  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(INITIAL_EXAMS, null, 2), 'utf-8');
      inMemoryExamsCache = INITIAL_EXAMS;
      return INITIAL_EXAMS;
    }
    const content = fs.readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed) && parsed.length > 0) {
      inMemoryExamsCache = parsed;
      return parsed;
    }
    return INITIAL_EXAMS;
  } catch (error) {
    console.error('Error reading exams data file, using fallback/in-memory:', error);
    return inMemoryExamsCache || INITIAL_EXAMS;
  }
}

function writeExamsToStorage(exams: ExamRecord[]): boolean {
  inMemoryExamsCache = exams;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(exams, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('Error writing exams to disk (cached in memory):', error);
    return false;
  }
}

export async function GET() {
  try {
    const exams = readExamsFromStorage();
    return NextResponse.json({ success: true, exams }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const exams = body.exams || (Array.isArray(body) ? body : null);

    if (!Array.isArray(exams)) {
      return NextResponse.json({ success: false, error: 'Expected an array of exams' }, { status: 400 });
    }

    writeExamsToStorage(exams);
    return NextResponse.json({ success: true, count: exams.length }, { status: 200 });
  } catch (error: any) {
    console.error('Error in POST /api/exams:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
