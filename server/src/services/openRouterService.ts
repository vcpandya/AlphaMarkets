// ─── Tool-use types ─────────────────────────────────────────

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

interface OpenRouterChatResponse {
  id: string;
  choices: {
    message: {
      role: string;
      content: string | null;
      tool_calls?: ToolCall[];
    };
    finish_reason: string;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface OpenRouterModel {
  id: string;
  name: string;
  description?: string;
  context_length: number;
  pricing: {
    prompt: string;
    completion: string;
  };
  architecture?: {
    modality: string;
    tokenizer: string;
    instruct_type: string | null;
  };
}

interface OpenRouterModelsResponse {
  data: OpenRouterModel[];
}

export interface ChatCompletionOptions {
  /** Force JSON output via response_format */
  jsonMode?: boolean;
  /** JSON schema for structured output (used with supported models) */
  jsonSchema?: { name: string; schema: Record<string, unknown> };
}

export async function chatCompletion(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  options: ChatCompletionOptions = {},
): Promise<string> {
  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: 0.3,
    max_tokens: 40000,
  };

  // Use structured output when available. json_schema provides the strongest
  // guarantee; json_object is the fallback that still constrains to valid JSON.
  if (options.jsonSchema) {
    body.response_format = {
      type: "json_schema",
      json_schema: options.jsonSchema,
    };
  } else if (options.jsonMode) {
    body.response_format = { type: "json_object" };
  }

  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:5173",
        "X-Title": "AlphaMarkets",
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw Object.assign(
      new Error(
        `OpenRouter API error: ${response.status} - ${errorText}`
      ),
      { statusCode: response.status }
    );
  }

  const json = (await response.json()) as OpenRouterChatResponse;

  if (!json.choices || json.choices.length === 0) {
    throw new Error("OpenRouter returned no choices in response");
  }

  return json.choices[0].message.content || "";
}

/**
 * Agentic tool-use loop: sends messages with tools, executes tool calls,
 * feeds results back, and repeats until the LLM produces a final text response.
 */
export async function agenticCompletion(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  tools: ToolDefinition[],
  executeTool: (name: string, args: Record<string, unknown>) => Promise<string>,
  options: ChatCompletionOptions & {
    maxIterations?: number;
    onProgress?: (event: { type: string; message: string; detail?: string }) => void;
  } = {},
): Promise<string> {
  const maxIterations = options.maxIterations ?? 10;
  const onProgress = options.onProgress;
  const conversation = [...messages];

  onProgress?.({ type: "start", message: "Starting analysis..." });

  for (let i = 0; i < maxIterations; i++) {
    const isLastIteration = i === maxIterations - 1;
    // On the second-to-last and last iteration, stop offering tools
    // so the model is forced to produce a final response
    const isWindingDown = i >= maxIterations - 2;

    const body: Record<string, unknown> = {
      model,
      messages: conversation,
      temperature: 0.3,
      max_tokens: 40000,
    };

    // Only provide tools if we're not winding down
    if (!isWindingDown) {
      body.tools = tools;
    } else {
      onProgress?.({ type: "analyzing", message: "Analyzing gathered data..." });
    }

    // On last iteration or when winding down, request JSON output
    if (isWindingDown && options.jsonMode) {
      body.response_format = { type: "json_object" };
    }

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "http://localhost:5173",
          "X-Title": "AlphaMarkets",
        },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw Object.assign(
        new Error(`OpenRouter API error: ${response.status} - ${errorText}`),
        { statusCode: response.status },
      );
    }

    const json = (await response.json()) as OpenRouterChatResponse;

    if (!json.choices || json.choices.length === 0) {
      throw new Error("OpenRouter returned no choices in response");
    }

    const choice = json.choices[0];
    const assistantMsg = choice.message;

    // If the model made tool calls, execute them and loop back
    if (assistantMsg.tool_calls && assistantMsg.tool_calls.length > 0) {
      // Add the assistant's tool-call message to the conversation
      conversation.push({
        role: "assistant",
        content: assistantMsg.content,
        tool_calls: assistantMsg.tool_calls,
      });

      // Execute all tool calls in parallel
      const toolResults = await Promise.all(
        assistantMsg.tool_calls.map(async (tc) => {
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(tc.function.arguments);
          } catch {
            // If arg parsing fails, pass empty
          }

          const toolName = tc.function.name;

          // Build a brief description of args for the progress event
          let briefDetail = toolName;
          if (toolName === "alpha_vantage") {
            briefDetail = `Querying Alpha Vantage: ${args.function_name || "unknown"} for ${args.symbol || "unknown"}`;
          } else if (toolName === "web_search") {
            briefDetail = `Searching web: ${args.query || ""}`;
          } else if (toolName === "read_webpage") {
            briefDetail = `Reading page: ${args.url || ""}`;
          }

          onProgress?.({ type: "tool_call", message: "Fetching data...", detail: briefDetail });

          let result: string;
          try {
            result = await executeTool(toolName, args);
          } catch (err) {
            result = `Error: ${err instanceof Error ? err.message : String(err)}`;
          }

          onProgress?.({ type: "tool_result", message: "Data received", detail: toolName });

          return { id: tc.id, result };
        }),
      );

      // Add tool results to conversation
      for (const tr of toolResults) {
        conversation.push({
          role: "tool",
          content: tr.result,
          tool_call_id: tr.id,
        });
      }

      // If we're about to wind down, add a nudge to produce the final answer
      if (i === maxIterations - 3) {
        conversation.push({
          role: "user",
          content: "You have gathered enough data. Please produce your final JSON analysis now based on all the data you've collected. No more tool calls needed.",
        });
      }

      continue; // Loop back for the next LLM turn
    }

    // No tool calls — this is the final response
    if (assistantMsg.content) {
      onProgress?.({ type: "complete", message: "Analysis complete" });
      return assistantMsg.content;
    }
  }

  // Fallback: try to find any assistant content in the conversation
  for (let j = conversation.length - 1; j >= 0; j--) {
    const msg = conversation[j];
    if (msg.role === "assistant" && msg.content) {
      return msg.content;
    }
  }

  throw new Error("Agentic loop exceeded maximum iterations without producing a final response");
}

export async function listModels(
  apiKey: string
): Promise<
  { id: string; name: string; contextLength: number; promptPrice: string; completionPrice: string }[]
> {
  const response = await fetch("https://openrouter.ai/api/v1/models", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw Object.assign(
      new Error(
        `OpenRouter Models API error: ${response.status} - ${errorText}`
      ),
      { statusCode: response.status }
    );
  }

  const json = (await response.json()) as OpenRouterModelsResponse;
  const models = json.data || [];

  // Filter to text/chat models and return simplified list
  return models
    .filter((m) => {
      const modality = m.architecture?.modality || "";
      return modality.includes("text") || modality === "";
    })
    .map((m) => ({
      id: m.id,
      name: m.name,
      contextLength: m.context_length,
      promptPrice: m.pricing.prompt,
      completionPrice: m.pricing.completion,
    }));
}
