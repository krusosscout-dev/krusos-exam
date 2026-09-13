import QRCode from 'qrcode';

export interface ExamAccessUrlConfig {
  baseUrl: string;
  accessCode: string;
  classroomId?: string; // Optional classroom pre-filter
}

/**
 * Builds the direct exam URL for a specific exam code.
 */
export function buildExamDirectUrl({
  baseUrl,
  accessCode,
  classroomId,
}: ExamAccessUrlConfig): string {
  const url = new URL(`/gateway/${accessCode}`, baseUrl);
  if (classroomId) {
    url.searchParams.set('classroomId', classroomId);
  }
  return url.toString();
}

/**
 * Generates QR Code as Base64 Data URL for embedding in HTML or printing.
 */
export async function generateExamQRCodeDataUrl(
  examUrl: string,
  options: { width?: number; margin?: number } = { width: 300, margin: 2 }
): Promise<string> {
  try {
    const dataUrl = await QRCode.toDataURL(examUrl, {
      width: options.width,
      margin: options.margin,
      color: {
        dark: '#0f172a', // Slate-900
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    });
    return dataUrl;
  } catch (error) {
    console.error('Failed to generate QR Code Data URL:', error);
    throw new Error('QR_CODE_GENERATION_FAILED');
  }
}

/**
 * Generates QR Code as pure SVG string.
 */
export async function generateExamQRCodeSvg(examUrl: string): Promise<string> {
  try {
    const svgString = await QRCode.toString(examUrl, {
      type: 'svg',
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    });
    return svgString;
  } catch (error) {
    console.error('Failed to generate QR Code SVG:', error);
    throw new Error('QR_CODE_SVG_GENERATION_FAILED');
  }
}
