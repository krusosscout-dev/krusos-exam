import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'src', 'data');
const RESULTS_FILE = path.join(DATA_DIR, 'results.json');

let inMemoryResultsCache: any[] | null = null;

function readResultsFromStorage(): any[] {
  if (inMemoryResultsCache) {
    return inMemoryResultsCache;
  }

  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(RESULTS_FILE)) {
      fs.writeFileSync(RESULTS_FILE, JSON.stringify([], null, 2), 'utf-8');
      inMemoryResultsCache = [];
      return [];
    }
    const content = fs.readFileSync(RESULTS_FILE, 'utf-8');
    const parsed = JSON.parse(content);
    inMemoryResultsCache = Array.isArray(parsed) ? parsed : [];
    return inMemoryResultsCache;
  } catch (error) {
    console.error('Error reading results data file, using in-memory:', error);
    return inMemoryResultsCache || [];
  }
}

function writeResultsToStorage(results: any[]): boolean {
  inMemoryResultsCache = results;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('Error writing results to disk (cached in memory):', error);
    return false;
  }
}

export async function GET() {
  try {
    const results = readResultsFromStorage();
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

    const existing = readResultsFromStorage();

    // If an array is sent, replace all results (e.g. admin clearing results)
    if (Array.isArray(newResult)) {
      writeResultsToStorage(newResult);
      return NextResponse.json({ success: true, count: newResult.length }, { status: 200 });
    }

    // Otherwise append new student result
    const filtered = existing.filter((r: any) => 
      !(r.id && newResult.id && r.id === newResult.id) &&
      !(r.accessCode === newResult.accessCode && r.studentId && newResult.studentId && r.studentId === newResult.studentId)
    );

    const updated = [newResult, ...filtered];
    writeResultsToStorage(updated);

    return NextResponse.json({ success: true, result: newResult }, { status: 200 });
  } catch (error: any) {
    console.error('Error in POST /api/results:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
