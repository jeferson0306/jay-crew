import Anthropic from "@anthropic-ai/sdk";
import type { AgentCallOptions, AgentResult } from "./types/index.js";

const MODEL = "claude-opus-4-6";

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY is not set.\n" +
        "Copy .env.example to .env and add your key:\n" +
        "  cp .env.example .env"
      );
    }
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

export async function callAgent(options: AgentCallOptions): Promise<AgentResult> {
  const { agentName, systemPrompt, userMessage, maxTokens = 2048 } = options;
  const start = Date.now();

  try {
    const client = getClient();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const content = response.content
      .filter((block) => block.type === "text")
      .map((block) => (block as { type: "text"; text: string }).text)
      .join("\n");

    return {
      success: true,
      data: content,
      agentName,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[${agentName}] Error: ${error}`);
    return {
      success: false,
      data: "",
      error,
      agentName,
      durationMs: Date.now() - start,
    };
  }
}
