/**
 * F3.3 — probes what the TensorX key can do. No dependencies; run with:
 *
 *   node --env-file=.env scripts/tensorx-check.mjs
 *
 * Prints: available model ids, whether forced tool-calling works on the
 * extraction model, and whether it accepts an image content part.
 *
 * Budgets are generous on purpose: these models reason first and reasoning
 * tokens count against max_tokens. A 32-token budget once produced an empty
 * answer that looked like "no vision support" but was only a cut-off.
 */
const base = (process.env.TENSORX_BASE_URL ?? 'https://api.tensorx.ai/v1').replace(/\/$/, '');
const key = process.env.TENSORX_API_KEY;
const extract = process.env.TENSORX_MODEL_EXTRACT ?? 'z-ai/glm-5.3-flash';
const narrative = process.env.TENSORX_MODEL_NARRATIVE ?? 'z-ai/glm-5.3';

if (!key) {
  console.error('TENSORX_API_KEY is not set in .env');
  process.exit(2);
}

const headers = { authorization: `Bearer ${key}`, 'content-type': 'application/json' };

async function post(body) {
  const res = await fetch(`${base}/chat/completions`, { method: 'POST', headers, body: JSON.stringify(body) });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 300) }; }
  return { status: res.status, json };
}

const out = { base, extract, narrative };

// 1. Models
try {
  const res = await fetch(`${base}/models`, { headers });
  const json = await res.json();
  const ids = (json.data ?? []).map((m) => m.id).sort();
  out.models = { status: res.status, count: ids.length, ids };
  out.extractModelListed = ids.includes(extract);
  out.narrativeModelListed = ids.includes(narrative);
} catch (err) {
  out.models = { error: String(err) };
}

// 2. Forced tool call
{
  const tool = {
    type: 'function',
    function: {
      name: 'record',
      description: 'Record the number',
      parameters: { type: 'object', properties: { n: { type: 'integer' } }, required: ['n'] },
    },
  };
  const { status, json } = await post({
    model: extract,
    max_tokens: 1024,
    messages: [{ role: 'user', content: 'The number is 42. Call the tool.' }],
    tools: [tool],
    tool_choice: { type: 'function', function: { name: 'record' } },
  });
  const call = json?.choices?.[0]?.message?.tool_calls?.[0];
  out.toolCalling = {
    status,
    ok: Boolean(call?.function?.arguments),
    arguments: call?.function?.arguments ?? null,
    error: json?.error ?? json?.raw ?? null,
  };
}

// 3. Image content part (1x1 red PNG)
{
  const png =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
  const { status, json } = await post({
    model: extract,
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'What colour is this image? One word.' },
          { type: 'image_url', image_url: { url: `data:image/png;base64,${png}` } },
        ],
      },
    ],
  });
  out.vision = {
    status,
    ok: status === 200 && Boolean(json?.choices?.[0]?.message?.content),
    answer: json?.choices?.[0]?.message?.content ?? null,
    finishReason: json?.choices?.[0]?.finish_reason ?? null,
    reasoningTokens: json?.usage?.completion_tokens_details?.reasoning_tokens ?? null,
    error: json?.error ?? json?.raw ?? null,
  };
}

// 4. JSON schema response_format
{
  const { status, json } = await post({
    model: extract,
    max_tokens: 1024,
    messages: [{ role: 'user', content: 'Return the number 7 as {"n": 7}.' }],
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'n', schema: { type: 'object', properties: { n: { type: 'integer' } }, required: ['n'] } },
    },
  });
  out.jsonSchema = {
    status,
    ok: status === 200,
    content: json?.choices?.[0]?.message?.content ?? null,
    error: json?.error ?? json?.raw ?? null,
  };
}

console.log(JSON.stringify(out, null, 2));
