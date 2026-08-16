export type AgentRunResult = {
  text: string;
  promptTokens: number;
  completionTokens: number;
  ok: boolean;
};

export type AgentRunner = {
  run(input: {
    agentId: string;
    prompt: string;
  }): Promise<AgentRunResult>;
};
