import type OpenAI from 'openai';

import {
  categoriesPromptAddendum,
  EXTRACTION_SYSTEM_PROMPT,
  extractionResultSchema,
  RECORD_EXPENSE_LINES_TOOL,
  TABULAR_PROMPT_ADDENDUM,
  type ValidatedExtraction,
} from '@/src/ai/extraction-contract';
import { ai, MODELS } from '../../ai/client';
import type { ParsedSource } from './parse';

export interface ExtractionOutcome {
  result: ValidatedExtraction;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number;
}

type Msg = OpenAI.Chat.Completions.ChatCompletionMessageParam;

// Reasoning tokens count against this (CLAUDE.md §2). A 37-row sheet used
// 8 096 on 2026-10-10, so 8 192 was one row from a cut-off; the model accepts
// 32 768 but 16 384 keeps a bound on a runaway reasoning chain.
export const EXTRACT_MAX_TOKENS = 16384;

/** One extraction call can legitimately run 1–3 min; never let the SDK retry it. */
const EXTRACT_TIMEOUT_MS = 8 * 60_000;

function userMessage(source: ParsedSource, filename: string | null): Msg {
  const name = filename ? ` (file: ${filename})` : '';
  switch (source.kind) {
    case 'table':
      return {
        role: 'user',
        content: `Spreadsheet export${name}, sheet "${source.sheetName}", ${source.rowCount} rows as TSV:\n\n${source.text}`,
      };
    case 'text':
      return { role: 'user', content: `Text extracted from a ${source.pageCount}-page PDF${name}:\n\n${source.text}` };
    case 'scan':
      // Best effort: OpenAI-compatible "file" content part. Providers that do
      // not support it return 4xx, which process.ts turns into a clear failure.
      return {
        role: 'user',
        content: [
          { type: 'text', text: `Scanned ${source.pageCount}-page PDF${name}. Transcribe every line.` },
          {
            type: 'file',
            file: { filename: filename ?? 'document.pdf', file_data: `data:application/pdf;base64,${source.pdf.toString('base64')}` },
          },
        ],
      };
  }
}

/** Pulls the tool arguments, or falls back to the first JSON object in the content. */
function extractJson(message: OpenAI.Chat.Completions.ChatCompletionMessage): unknown {
  const call = message.tool_calls?.find((c) => c.type === 'function');
  if (call && call.type === 'function' && call.function.arguments) {
    return JSON.parse(call.function.arguments);
  }
  const content = typeof message.content === 'string' ? message.content : '';
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('Model returned no structured data');
  return JSON.parse(content.slice(start, end + 1));
}

/**
 * One model call per import. Forced tool-calling first; if the provider
 * ignores `tool_choice`, the JSON fallback still gives us something to
 * validate rather than failing the whole file.
 */
export async function runExtraction(
  source: ParsedSource,
  opts: { filename: string | null; categoryNames: string[] },
): Promise<ExtractionOutcome> {
  const system =
    EXTRACTION_SYSTEM_PROMPT +
    (source.kind === 'table' ? `\n\n${TABULAR_PROMPT_ADDENDUM}` : '') +
    categoriesPromptAddendum(opts.categoryNames);

  const started = Date.now();
  const completion = await ai.chat.completions.create({
    model: MODELS.extract,
    temperature: 0,
    // Includes the model's reasoning tokens, not just the tool arguments.
    max_tokens: EXTRACT_MAX_TOKENS,
    messages: [{ role: 'system', content: system }, userMessage(source, opts.filename)],
    tools: [RECORD_EXPENSE_LINES_TOOL as unknown as OpenAI.Chat.Completions.ChatCompletionTool],
    tool_choice: { type: 'function', function: { name: RECORD_EXPENSE_LINES_TOOL.function.name } },
  }, { timeout: EXTRACT_TIMEOUT_MS, maxRetries: 0 });
  const latencyMs = Date.now() - started;

  const choice = completion.choices[0];
  const message = choice?.message;
  if (!message) throw new Error('Model returned no choices');
  // A cut-off reply leaves truncated tool arguments that would fail JSON
  // parsing with an obscure error. Fail clearly instead; process.ts maps
  // this message to "split the file" for the user.
  if (choice.finish_reason === 'length') {
    throw new Error(`Model output hit the maximum tokens (${EXTRACT_MAX_TOKENS}) before finishing; the document is too long for one pass`);
  }
  const parsed = extractionResultSchema.safeParse(extractJson(message));
  if (!parsed.success) {
    throw new Error(`Model output failed validation: ${parsed.error.issues[0]?.message ?? 'unknown'}`);
  }

  return {
    result: parsed.data,
    model: completion.model ?? MODELS.extract,
    inputTokens: completion.usage?.prompt_tokens ?? null,
    outputTokens: completion.usage?.completion_tokens ?? null,
    latencyMs,
  };
}
