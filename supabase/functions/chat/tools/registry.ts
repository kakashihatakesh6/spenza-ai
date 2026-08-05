// @ts-nocheck
import { createUserProfileTools } from './userProfileTool.ts';
import { createTransactionTools } from './transactionTool.ts';
import { createAnalyticsTools } from './analyticsTool.ts';
import { createKnowledgeRetrievalTools } from './knowledgeRetrievalTool.ts';
import { createBudgetTools } from './budgetTool.ts';
import { ToolLogEntry } from '../observability.ts';

export interface ToolRegistryOptions {
  supabaseClient: any;
  supabaseAdmin: any;
  userId: string;
  apiKey: string;
  onCitationsCollected?: (citations: any[]) => void;
  onToolExecuted?: (log: ToolLogEntry) => void;
}

/**
 * Creates and registers all production LangChain tools for the agent.
 */
export function getAgentTools(options: ToolRegistryOptions) {
  const {
    supabaseClient,
    supabaseAdmin,
    userId,
    apiKey,
    onCitationsCollected,
    onToolExecuted
  } = options;

  const profileTools = createUserProfileTools(supabaseClient, userId, onToolExecuted);
  const transactionTools = createTransactionTools(supabaseClient, userId, onToolExecuted);
  const analyticsTools = createAnalyticsTools(supabaseClient, userId, onToolExecuted);
  const knowledgeTools = createKnowledgeRetrievalTools(supabaseAdmin, apiKey, onCitationsCollected, onToolExecuted);
  const budgetTools = createBudgetTools(supabaseClient, userId, onToolExecuted);

  return [
    ...profileTools,
    ...transactionTools,
    ...analyticsTools,
    ...knowledgeTools,
    ...budgetTools
  ];
}
