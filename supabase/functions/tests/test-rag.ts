// @ts-ignore Deno remote import resolution
import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
// @ts-ignore Deno ts extension import resolution
import { chunkText } from '../_shared/documentParser.ts';

// declare Deno namespace for standard Node-based IDE compilation
declare const Deno: any;

Deno.test('Semantic Chunker - Splits text correctly', () => {
  const sampleText = `
# Section 1: Introduction
This is the first paragraph of our document. It contains some basic introductory text that needs to be parsed and chunked.

# Section 2: Details
Here is some more detailed text. We want to verify that when we split this, the headers are preserved correctly and prefixed to the resulting chunks.
This paragraph contains details about the RAG implementation, pgvector dimensions, and Deno edge runtime configurations.
  `;

  // Run chunking with small chunk size to trigger splits
  const chunks = chunkText(sampleText, 120, 20);

  // Assertions
  assertEquals(chunks.length > 0, true);
  
  // Verify that the sections are captured in chunk metadata
  const firstChunk = chunks[0];
  assertEquals(firstChunk.section, 'Section 1: Introduction');

  const detailChunk = chunks.find(c => c.section === 'Section 2: Details');
  assertEquals(!!detailChunk, true);
});

Deno.test('Semantic Chunker - Handles empty input', () => {
  const chunks = chunkText('');
  assertEquals(chunks.length, 0);
});
