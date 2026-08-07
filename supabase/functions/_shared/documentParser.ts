// @ts-nocheck
import { getDocumentProxy, extractText } from 'npm:unpdf';
import mammoth from 'npm:mammoth@1.8.0';
import * as XLSX from 'npm:xlsx@0.18.5';

export interface DocumentChunk {
  chunk_text: string;
  page_number?: number;
  section?: string;
  metadata: Record<string, any>;
}

/**
 * Splits text into semantic chunks with a sliding window, optionally retaining the last section heading.
 */
export function chunkText(
  text: string,
  maxChunkSize = 800,
  overlap = 150,
  pageNumber?: number,
  metadata: Record<string, any> = {}
): DocumentChunk[] {
  const chunks: DocumentChunk[] = [];
  const lines = text.split('\n');
  
  let currentSection = '';
  let currentChunkText = '';
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    // Check if the line looks like a markdown heading or section header
    if (trimmed.startsWith('#') || (trimmed.length < 60 && /^[A-Z0-9\s\-_.:()]+$/.test(trimmed))) {
      currentSection = trimmed.replace(/^#+\s*/, '');
    }
    
    // If adding this line exceeds the chunk size, push the current chunk
    if (currentChunkText.length + trimmed.length > maxChunkSize) {
      if (currentChunkText.trim()) {
        chunks.push({
          chunk_text: currentChunkText.trim(),
          page_number: pageNumber,
          section: currentSection || undefined,
          metadata: { ...metadata, section: currentSection || undefined },
        });
      }
      
      // Start next chunk with overlap from the end of the previous chunk text
      const words = currentChunkText.split(' ');
      const overlapWords = words.slice(-Math.floor(overlap / 6)); // approximate words count
      currentChunkText = overlapWords.join(' ') + ' ' + trimmed + '\n';
    } else {
      currentChunkText += trimmed + '\n';
    }
  }
  
  if (currentChunkText.trim()) {
    chunks.push({
      chunk_text: currentChunkText.trim(),
      page_number: pageNumber,
      section: currentSection || undefined,
      metadata: { ...metadata, section: currentSection || undefined },
    });
  }
  
  return chunks;
}

/**
 * Parses a spreadsheet (Excel or CSV) and turns each row into a structured QA chunk.
 */
export function parseSpreadsheet(
  buffer: ArrayBuffer,
  fileType: string,
  metadata: Record<string, any> = {}
): DocumentChunk[] {
  const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
  const chunks: DocumentChunk[] = [];
  
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    // Convert to JSON array
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);
    
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];
      
      // Find Q&A columns if they exist (case-insensitive keys)
      let question = '';
      let answer = '';
      const otherFields: string[] = [];
      
      Object.entries(row).forEach(([key, val]) => {
        const lowerKey = key.toLowerCase();
        if (
          lowerKey === 'question' ||
          lowerKey === 'q' ||
          lowerKey === 'query' ||
          lowerKey === 'faq'
        ) {
          question = String(val).trim();
        } else if (
          lowerKey === 'answer' ||
          lowerKey === 'a' ||
          lowerKey === 'response' ||
          lowerKey === 'reply'
        ) {
          answer = String(val).trim();
        } else {
          otherFields.push(`${key}: ${val}`);
        }
      });
      
      let chunkText = '';
      if (question && answer) {
        chunkText = `Question: ${question}\nAnswer: ${answer}`;
        if (otherFields.length > 0) {
          chunkText += `\nMetadata: ${otherFields.join(', ')}`;
        }
      } else {
        // Fallback for general table row data
        chunkText = Object.entries(row)
          .map(([key, val]) => `${key}: ${val}`)
          .join('\n');
      }
      
      if (chunkText.trim()) {
        chunks.push({
          chunk_text: chunkText.trim(),
          page_number: rowIndex + 1, // Store Excel row index as "page number" for reference
          section: sheetName,
          metadata: {
            ...metadata,
            sheet_name: sheetName,
            row_number: rowIndex + 1,
            is_spreadsheet: true,
          },
        });
      }
    }
  }
  
  return chunks;
}

/**
 * Extracts and chunks document text based on file format.
 */
export async function parseDocument(
  buffer: ArrayBuffer,
  fileType: string,
  fileName: string,
  metadata: Record<string, any> = {}
): Promise<DocumentChunk[]> {
  const mimeType = fileType.toLowerCase();
  
  // 1. Spreadsheet Processing (Excel / CSV)
  if (
    mimeType === 'xlsx' ||
    mimeType === 'csv' ||
    fileName.endsWith('.xlsx') ||
    fileName.endsWith('.csv') ||
    mimeType.includes('spreadsheet') ||
    mimeType.includes('excel') ||
    mimeType.includes('csv')
  ) {
    return parseSpreadsheet(buffer, mimeType, metadata);
  }
  
  // 2. PDF Processing
  if (mimeType === 'pdf' || fileName.endsWith('.pdf') || mimeType.includes('pdf')) {
    const uint8Array = new Uint8Array(buffer);
    const pdf = await getDocumentProxy(uint8Array);
    const { text: pages } = await extractText(pdf, { mergePages: false });
    const chunks: DocumentChunk[] = [];
    
    pages.forEach((pageText: string, idx: number) => {
      const pageNum = idx + 1;
      if (pageText.trim()) {
        const pageChunks = chunkText(pageText, 800, 150, pageNum, metadata);
        chunks.push(...pageChunks);
      }
    });
    
    return chunks;
  }
  
  // 3. Word Processing (DOCX)
  if (
    mimeType === 'docx' ||
    fileName.endsWith('.docx') ||
    mimeType.includes('word') ||
    mimeType.includes('officedocument.wordprocessingml')
  ) {
    const result = await mammoth.extractRawText({ arrayBuffer: buffer });
    const parsedText = result.value || '';
    return chunkText(parsedText, 800, 150, 1, metadata);
  }
  
  // 4. Raw Text/Markdown (TXT / MD)
  const textContent = new TextDecoder('utf-8').decode(buffer);
  return chunkText(textContent, 800, 150, 1, metadata);
}
