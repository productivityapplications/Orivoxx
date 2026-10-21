import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const openAIConstructor = vi.hoisted(() => vi.fn());
const createCompletion = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));

vi.mock("openai", () => ({
  default: openAIConstructor,
}));

import { pingModel } from "./index";

describe("pingModel", () => {
  beforeEach(() => {
    vi.stubEnv("NEBIUS_API_KEY", "unit-test-key");
    vi.stubEnv("NEBIUS_BASE_URL", "");
    vi.stubEnv("NEBIUS_MODEL_ID", "");

    openAIConstructor.mockReset();
    openAIConstructor.mockImplementation(function () {
      return {
        chat: {
          completions: {
            create: createCompletion,
          },
        },
      };
    });

    createCompletion.mockReset();
    createCompletion.mockResolvedValue({
      id: "chatcmpl-test",
      object: "chat.completion",
      model: "nvidia/Nemotron-3.5-Super-VL",
      choices: [
        {
          index: 0,
          finish_reason: "stop",
          message: {
            role: "assistant",
            content: '{"ok":true,"model":"nvidia/Nemotron-3.5-Super-VL"}',
          },
        },
      ],
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("parses a minimal response and reports the model ID", async () => {
    const result = await pingModel("Reply with valid JSON only.");

    expect(openAIConstructor).toHaveBeenCalledWith({
      apiKey: "unit-test-key",
      baseURL: "https://api.tokenfactory.nebius.com/v1/",
      timeout: 30_000,
      maxRetries: 0,
    });
    expect(result.modelId).toBe("nvidia/Nemotron-3.5-Super-VL");
    expect(result.rawShape).toEqual({
      object: "chat.completion",
      choiceCount: 1,
      finishReason: "stop",
      messageKeys: ["role", "content"],
      contentParsedAsJson: true,
      contentJsonKeys: ["ok", "model"],
    });
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });
});
