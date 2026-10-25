import { Plugin } from "@opencode/plugin"
import { RedeemResetRpc } from "./rpc"

const BASE_URL = "https://chatgpt.com/backend-api/wham/rate-limit-reset-credits"
const ACCOUNT_CLAIM = "https://api.openai.com/auth"

type ResetCredit = {
  id?: unknown
  credit_id?: unknown
  status?: unknown
  expires_at?: unknown
}

export default Plugin.define({
  id: "local.redeem-reset.server",
  async setup(ctx) {
    await ctx.rpc.register(RedeemResetRpc, {
      preview: async (_input, rpc) => {
        try {
          const { credits } = await getResetCredits(ctx)
          const next = listAvailableCredits(credits)[0]
          if (!next) throw new Error("No available, unexpired banked reset was found.")
          return { creditId: next.id, expiresAt: new Date(next.expiresAt).toISOString() }
        } catch (error) {
          const message = errorMessage(error)
          return rpc.error("failed", message, { message })
        }
      },
      redeem: async ({ creditId }, rpc) => {
        try {
          const { headers, credits } = await getResetCredits(ctx)
          const selected = listAvailableCredits(credits).find((credit) => credit.id === creditId)
          if (!selected) {
            throw new Error("Invalid reset ID: the selected reset is unavailable or expired. Nothing was redeemed.")
          }

          let response: Response
          try {
            response = await fetch(`${BASE_URL}/consume`, {
              method: "POST",
              headers: { ...headers, "Content-Type": "application/json" },
              body: JSON.stringify({ redeem_request_id: crypto.randomUUID(), credit_id: creditId }),
              signal: rpc.signal,
            })
          } catch {
            throw new Error("The redemption request failed before a result was confirmed. Check your usage before trying again.")
          }
          if (!response.ok) {
            throw new Error(`OpenAI did not confirm the reset redemption (${response.status}).`)
          }
          return { success: true }
        } catch (error) {
          const message = errorMessage(error)
          return rpc.error("failed", message, { message })
        }
      },
    })
  },
})

function decodeJwtClaims(token: string): Record<string, unknown> | undefined {
  try {
    const part = token.split(".")[1]
    if (!part) return
    const base64 = part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "=")
    const binary = atob(base64)
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
    const claims: unknown = JSON.parse(new TextDecoder().decode(bytes))
    return isObject(claims) ? claims : undefined
  } catch {
    return
  }
}

async function getResetCredits(ctx: Parameters<Parameters<typeof Plugin.define>[0]["setup"]>[0]) {
  const connection = await ctx.integration.connection.active("openai")
  if (!connection) throw new Error("Connect OpenAI with ChatGPT OAuth first.")

  const credential = await ctx.integration.connection.resolve(connection)
  if (credential?.type !== "oauth") throw new Error("ChatGPT OAuth is required to list reset credits.")
  if (credential.expires <= Date.now()) throw new Error("OpenAI OAuth token is expired. Reconnect OpenAI in /connect.")

  const claims = decodeJwtClaims(credential.access)
  const namespace = claims?.[ACCOUNT_CLAIM]
  const accountId = isObject(namespace) && typeof namespace.chatgpt_account_id === "string"
    ? namespace.chatgpt_account_id
    : undefined
  if (!accountId) throw new Error("OpenAI OAuth token does not contain a ChatGPT account ID.")

  const headers = {
    Authorization: `Bearer ${credential.access}`,
    Accept: "application/json",
    "ChatGPT-Account-Id": accountId,
    "OpenAI-Beta": "codex-1",
    originator: "Codex Desktop",
  }
  const response = await fetch(BASE_URL, { headers })
  if (!response.ok) throw new Error(`Could not list reset credits (${response.status}).`)
  const payload: unknown = await response.json()
  const credits = isObject(payload) && Array.isArray(payload.credits) ? payload.credits : []
  return { headers, credits }
}

function listAvailableCredits(credits: unknown[]) {
  const now = Date.now()
  return credits
    .filter((credit): credit is ResetCredit => isObject(credit) && credit.status === "available")
    .map((credit) => ({
      id: typeof credit.credit_id === "string" ? credit.credit_id : typeof credit.id === "string" ? credit.id : undefined,
      expiresAt: typeof credit.expires_at === "string" ? Date.parse(credit.expires_at) : Number.NaN,
    }))
    .filter((credit): credit is { id: string; expiresAt: number } => Boolean(credit.id) && Number.isFinite(credit.expiresAt) && credit.expiresAt > now)
    .sort((left, right) => left.expiresAt - right.expiresAt)
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Reset request failed."
}
