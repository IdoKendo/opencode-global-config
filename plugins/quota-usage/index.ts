import { Plugin } from "@opencode/plugin"
import { QuotaUsageRpc, type QuotaEntry } from "./rpc.js"

const DEFAULT_BASE_URL = "https://chatgpt.com/backend-api"

export default Plugin.define({
    id: "local.quota-usage-server",
    async setup(ctx) {
        await ctx.rpc.register(QuotaUsageRpc, {
            async read(_input, call) {
                try {
                    for (const integrationID of ["openai", "codex"]) {
                        const connection = await ctx.integration.connection.active(integrationID)
                        if (!connection) continue
                        const credential = await ctx.integration.connection.resolve(connection)
                        if (credential?.type !== "oauth") continue
                        const metadata = credential.metadata
                        const accountID = typeof metadata?.accountID === "string" ? metadata.accountID : undefined
                        const enterpriseUrl = typeof metadata?.enterpriseUrl === "string" ? metadata.enterpriseUrl : undefined
                        const baseUrl = process.env.OPENCODE_CODEX_BASE_URL ?? enterpriseUrl ?? DEFAULT_BASE_URL
                        const trimmed = baseUrl.replace(/\/+$/, "")
                        const normalized = /https:\/\/(chatgpt\.com|chat\.openai\.com)$/.test(trimmed) ? `${trimmed}/backend-api` : trimmed
                        const headers = {
                            Authorization: `Bearer ${credential.access}`,
                            Accept: "application/json",
                            ...(accountID ? { "ChatGPT-Account-Id": accountID } : {}),
                        }
                        const [payload, resetCredits] = await Promise.all([
                            fetchJson(trimmed.includes("/backend-api") ? `${trimmed}/wham/usage` : `${trimmed}/api/codex/usage`, headers, call.signal),
                            fetchJson(`${normalized}/wham/rate-limit-reset-credits`, {
                                ...headers,
                                "OpenAI-Beta": "codex-1",
                                originator: "Codex Desktop",
                            }, call.signal).catch(() => null),
                        ])
                        const entries = extractQuotaEntries(payload)
                        const resetEntry = extractResetCreditEntry(resetCredits)
                        if (resetEntry) entries.push(resetEntry)
                        if (entries.length === 0) return call.error("unavailable", "Quota payload did not include rate limits", {})
                        return { connected: true, entries }
                    }
                    return { connected: false, entries: [] }
                } catch {
                    // Never forward credential resolution errors or authenticated response bodies.
                    return call.error("unavailable", "Unable to load OpenAI quota usage", {})
                }
            },
        })
    },
})

async function fetchJson(url: string, headers: Record<string, string>, signal: AbortSignal): Promise<unknown> {
    const response = await fetch(url, {
        headers,
        redirect: "error",
        signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
    })
    if (!response.ok) throw new Error(`Quota request failed (${response.status})`)
    return response.json()
}

function extractQuotaEntries(payload: unknown): QuotaEntry[] {
    if (!isObject(payload)) return []
    const entries: QuotaEntry[] = []
    const rateLimit = isObject(payload.rate_limit) ? payload.rate_limit : null
    if (rateLimit) {
        const primary = isObject(rateLimit.primary_window) ? parseRateLimitWindow("primary", "Primary", rateLimit.primary_window) : null
        const secondary = isObject(rateLimit.secondary_window) ? parseRateLimitWindow("secondary", "Secondary", rateLimit.secondary_window) : null
        if (primary) entries.push(primary)
        if (secondary) entries.push(secondary)
    }
    const credits = isObject(payload.credits) ? payload.credits : null
    if (credits) {
        if (credits.unlimited === true) entries.push({ id: "credits", name: "Credits", remaining: 0, unit: "credits", info: "unlimited" })
        else {
            const balance = toNumber(credits.balance)
            if (balance !== null) entries.push({ id: "credits", name: "Credits", remaining: balance, unit: "credits", info: "remaining" })
        }
    }
    return entries
}

function parseRateLimitWindow(id: string, name: string, snapshot: Record<string, unknown>): QuotaEntry | null {
    const used = toNumber(snapshot.used_percent)
    if (used === null) return null
    const remaining = Math.max(0, Math.min(100, 100 - used))
    const resetAfter = toNumber(snapshot.reset_after_seconds)
    const resetAt = toNumber(snapshot.reset_at)
    const windowSeconds = toNumber(snapshot.limit_window_seconds)
    return {
        id,
        name,
        remaining,
        unit: "%",
        progress: remaining,
        window: windowSeconds ? describeWindow(windowSeconds) : undefined,
        reset: resetAfter !== null ? `resets in ${formatRelativeSeconds(resetAfter)}` : resetAt !== null ? `resets at ${new Date(resetAt * 1000).toLocaleTimeString()}` : undefined,
    }
}

function extractResetCreditEntry(payload: unknown): QuotaEntry | null {
    if (!isObject(payload)) return null
    const availableCount = toNumber(payload.available_count)
    if (availableCount === null || availableCount < 0) return null
    const now = Date.now()
    const expiries = Array.isArray(payload.credits)
        ? payload.credits
            .filter((credit): credit is Record<string, unknown> => isObject(credit) && credit.status === "available")
            .map((credit) => typeof credit.expires_at === "string" ? Date.parse(credit.expires_at) : Number.NaN)
            .filter((expiresAt) => Number.isFinite(expiresAt) && expiresAt > now)
            .sort((left, right) => left - right)
        : []
    const expirySummary = expiries.slice(0, 4).map((expiresAt) => formatRelativeSeconds(Math.ceil((expiresAt - now) / 1000)))
    if (expiries.length > 4) expirySummary.push(`+${expiries.length - 4}`)
    return {
        id: "reset-credits",
        name: "Limit Reset Credits",
        remaining: availableCount,
        unit: " available",
        reset: expirySummary.length > 0 ? `expires in ${expirySummary.join(" | ")}` : undefined,
    }
}

function isObject(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function toNumber(value: unknown) {
    if (typeof value === "number" && Number.isFinite(value)) return value
    if (typeof value === "string") {
        const parsed = Number.parseFloat(value)
        if (Number.isFinite(parsed)) return parsed
    }
    return null
}

function describeWindow(seconds: number) {
    const minutes = Math.round(seconds / 60)
    if (minutes >= 60 && minutes % 60 === 0) return `${minutes / 60}h window`
    return `${minutes}m window`
}

function formatRelativeSeconds(seconds: number) {
    if (seconds <= 0) return "now"
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)
    const remainingHours = hours % 24
    const remainingMinutes = minutes % 60
    if (days > 0) return `${days}d ${remainingHours}h ${remainingMinutes}m`
    if (hours > 0) return `${hours}h ${remainingMinutes}m`
    return `${minutes}m`
}
