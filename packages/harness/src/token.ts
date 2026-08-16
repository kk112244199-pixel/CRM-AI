/** 无官方金额时的演示估算，使合计可核对。 */
export function estimateCny(promptTokens: number, completionTokens: number): number {
  return Number(((promptTokens + completionTokens) * 0.0002).toFixed(4));
}

export const SCRIPTED_TOKENS: Record<
  string,
  { prompt: number; completion: number }
> = {
  orchestrator: { prompt: 120, completion: 80 },
  "lead-intake": { prompt: 400, completion: 220 },
  pipeline: { prompt: 300, completion: 160 },
  followup: { prompt: 350, completion: 190 },
};
