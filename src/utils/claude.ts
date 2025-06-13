import { query, type ClaudeEvent, type TextContent } from "@anthropic-ai/claude-code"

/**
 * Query Claude using the claude-code SDK
 */
export async function askClaude(prompt: string): Promise<string> {
  const iter = query({ prompt }) as AsyncIterable<ClaudeEvent>

  let answer = ""
  for await (const ev of iter) {
    if (ev.type === "assistant" && ev.message) {
      // Claude streams an array of content blocks – grab the text ones
      for (const block of ev.message.content) {
        if (block.type === "text" && (block as TextContent).text) {
          answer += (block as TextContent).text
        }
      }
    }
  }
  return answer.trim()
}