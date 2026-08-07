// @ts-nocheck
export interface ToolLogEntry {
  toolName: string;
  executionTimeMs: number;
  success: boolean;
  error?: string;
  timestamp: string;
}

export interface AgentMetrics {
  userId: string;
  conversationId: string;
  startTimeMs: number;
  endTimeMs?: number;
  totalDurationMs?: number;
  classifierRoute?: string;
  toolsCalled: ToolLogEntry[];
  retrievalLatencyMs?: number;
  llmLatencyMs?: number;
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export class Logger {
  static info(message: string, meta?: Record<string, any>) {
    console.log(`[ChatAgent INFO] ${message}`, meta ? JSON.stringify(meta) : '');
  }

  static warn(message: string, meta?: Record<string, any>) {
    console.warn(`[ChatAgent WARN] ${message}`, meta ? JSON.stringify(meta) : '');
  }

  static error(message: string, error?: any, meta?: Record<string, any>) {
    console.error(`[ChatAgent ERROR] ${message}`, error || '', meta ? JSON.stringify(meta) : '');
  }

  static logToolExecution(entry: ToolLogEntry) {
    console.log(
      `[ChatAgent TOOL] Name: ${entry.toolName} | Status: ${entry.success ? 'SUCCESS' : 'FAILED'} | Duration: ${entry.executionTimeMs}ms${entry.error ? ` | Error: ${entry.error}` : ''}`
    );
  }

  static logSummary(metrics: AgentMetrics) {
    const totalDuration = metrics.endTimeMs ? metrics.endTimeMs - metrics.startTimeMs : 0;
    console.log(`[ChatAgent TELEMETRY] Summary:`, {
      userId: metrics.userId,
      conversationId: metrics.conversationId,
      totalDurationMs: totalDuration,
      classifierRoute: metrics.classifierRoute,
      toolsUsedCount: metrics.toolsCalled.length,
      toolNames: metrics.toolsCalled.map(t => t.toolName),
      retrievalLatencyMs: metrics.retrievalLatencyMs || 0,
      llmLatencyMs: metrics.llmLatencyMs || 0,
      tokenUsage: metrics.tokenUsage || {}
    });
  }
}
