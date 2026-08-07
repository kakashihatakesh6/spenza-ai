// @ts-nocheck
import { tool } from 'npm:@langchain/core/tools';
import { z } from 'npm:zod@^3.22.4';
import { generateEmbedding } from '../../_shared/embeddingService.ts';
import { Logger } from '../observability.ts';

export function createKnowledgeRetrievalTools(
  supabaseAdmin: any,
  apiKey: string,
  onCitationsCollected?: (citations: any[]) => void,
  onLog?: (entry: any) => void
) {
  const searchKnowledgeBaseTool = tool(
    async (input) => {
      const startTime = Date.now();
      try {
        Logger.info(`[SearchKnowledgeBaseTool] Querying pgvector RAG: "${input.query}"`);

        const questionEmbedding = await generateEmbedding(input.query, apiKey);

        const { data: matchedChunks, error: searchError } = await supabaseAdmin.rpc(
          'match_document_chunks_hybrid',
          {
            query_text: input.query,
            query_embedding: questionEmbedding,
            match_threshold: 0.35,
            match_count: input.topK || 5,
            filter_uploaded_by: null,
            vector_weight: 0.6,
            full_text_weight: 0.4
          }
        );

        if (searchError) {
          throw new Error(`pgvector hybrid search failed: ${searchError.message}`);
        }

        if (!matchedChunks || matchedChunks.length === 0) {
          const duration = Date.now() - startTime;
          onLog?.({ toolName: 'search_knowledge_base', executionTimeMs: duration, success: true, timestamp: new Date().toISOString() });
          return JSON.stringify({
            success: true,
            found: false,
            message: 'No relevant documentation chunks found matching the query.',
            chunks: []
          });
        }

        const seen = new Set();
        const uniqueChunks = [];
        for (const chunk of matchedChunks) {
          if (!seen.has(chunk.chunk_text)) {
            seen.add(chunk.chunk_text);
            uniqueChunks.push(chunk);
          }
        }

        const citations = uniqueChunks.map((chunk: any) => ({
          chunk_id: chunk.chunk_id,
          title: chunk.document_title || chunk.document_filename,
          filename: chunk.document_filename,
          page_number: chunk.page_number,
          section: chunk.section,
          similarity: chunk.similarity,
        }));

        onCitationsCollected?.(citations);

        const duration = Date.now() - startTime;
        onLog?.({ toolName: 'search_knowledge_base', executionTimeMs: duration, success: true, timestamp: new Date().toISOString() });

        return JSON.stringify({
          success: true,
          found: true,
          count: uniqueChunks.length,
          chunks: uniqueChunks.map((c: any, i: number) => ({
            sourceNumber: i + 1,
            documentTitle: c.document_title || c.document_filename,
            filename: c.document_filename,
            pageOrRow: c.page_number || 'N/A',
            section: c.section || 'General',
            similarity: c.similarity,
            content: c.chunk_text
          }))
        });
      } catch (err: any) {
        const duration = Date.now() - startTime;
        Logger.error(`[SearchKnowledgeBaseTool Error]`, err);
        onLog?.({ toolName: 'search_knowledge_base', executionTimeMs: duration, success: false, error: err.message, timestamp: new Date().toISOString() });
        return JSON.stringify({ success: false, error: err.message || 'Failed to search knowledge base.' });
      }
    },
    {
      name: 'search_knowledge_base',
      description: 'Search official Spendly documentation, FAQs, and Q&A guides for Spendly app features, receipt OCR scanner, offline mode, guides, and policies.',
      schema: z.object({
        query: z.string().describe('Search query or question about Spendly app features, FAQs, OCR scanner, offline mode, guides, or policies'),
        topK: z.number().optional().default(5).describe('Top-K relevant chunks to retrieve')
      })
    }
  );

  return [searchKnowledgeBaseTool];
}
