import {
  getOpenRouterFallbackModel,
  isOpenRouterRateLimited,
} from "@/lib/openrouter-errors";
import { resolveChatCompletionsUrl } from "@/lib/model-router";

export type OpenRouterFetchResult = {
  res: Response;
  /** Set only when !res.ok (body already consumed). */
  errorBody: string;
  modelUsed: string;
};

/** POST chat/completions; on 429 retries once with OPENROUTER_FALLBACK_MODEL. */
export async function fetchOpenRouterCompletions(opts: {
  headers: Record<string, string>;
  body: Record<string, unknown>;
  primaryModel: string;
  signal?: AbortSignal;
}): Promise<OpenRouterFetchResult> {
  const primary = opts.primaryModel.trim();
  const fallback = getOpenRouterFallbackModel();

  const attempt = async (model: string): Promise<OpenRouterFetchResult> => {
    const res = await fetch(resolveChatCompletionsUrl(), {
      method: "POST",
      headers: opts.headers,
      body: JSON.stringify({ ...opts.body, model }),
      signal: opts.signal,
    });
    if (!res.ok) {
      const errorBody = await res.text();
      return { res, errorBody, modelUsed: model };
    }
    return { res, errorBody: "", modelUsed: model };
  };

  let result = await attempt(primary);
  if (
    !result.res.ok &&
    isOpenRouterRateLimited(result.res.status, result.errorBody) &&
    primary !== fallback
  ) {
    result = await attempt(fallback);
  }
  return result;
}
