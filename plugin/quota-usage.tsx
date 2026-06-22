/** @jsxImportSource @opentui/solid */
import { readFile } from "node:fs/promises"
import { homedir, platform } from "node:os"
import { join } from "node:path"
import type { TuiPlugin, TuiPluginModule } from "@opencode-ai/plugin/tui"
import { createTextAttributes } from "@opentui/core"
import { createSignal } from "solid-js"

const DEFAULT_BASE_URL = "https://chatgpt.com/backend-api"
const BOLD = createTextAttributes({ bold: true })

type UsageState =
    | { status: "loading"; updated?: number; data?: QuotaEntry[] }
    | { status: "ok"; updated: number; data: QuotaEntry[] }
    | { status: "error"; updated: number; data?: QuotaEntry[]; message: string }

type AuthInfo =
    | { type: "oauth"; access: string; enterpriseUrl?: string }
    | { type: "api"; key: string }
    | { type: "wellknown"; key: string; token: string }

type AuthFile = Record<string, AuthInfo>

type QuotaEntry = {
    id: string
    name: string
    remaining: number
    unit: string
    window?: string
    reset?: string
    info?: string
}

type RateLimitWindowSnapshot = {
    used_percent?: number | string
    limit_window_seconds?: number | string
    reset_after_seconds?: number | string
    reset_at?: number | string
}

const tui: TuiPlugin = async (api) => {
    if (!(await hasOpenAIConnection())) return

    const [state, setState] = createSignal<UsageState>({ status: "loading" })
    let refreshID = 0

    const refresh = async () => {
        const id = ++refreshID
        setState((current) => ({ status: "loading", updated: current.updated, data: current.data }))

        try {
            const data = await loadQuotaUsage()
            if (id === refreshID) setState({ status: "ok", data, updated: Date.now() })
        } catch (error) {
            if (id !== refreshID) return
            setState((current) => ({
                status: "error",
                data: current.data,
                updated: Date.now(),
                message: error instanceof Error ? error.message : "Unable to load quota usage",
            }))
        }
    }

    api.slots.register({
        order: 100,
        slots: {
            sidebar_content() {
                return <QuotaUsagePanel api={api} state={state} />
            },
        },
    })

    const unsubscribe = api.event.on("session.idle", (event) => {
        const sessionID = event.properties.sessionID
        if (sessionID && !api.state.session.get(sessionID)?.parentID) void refresh()
    })
    api.lifecycle.onDispose(unsubscribe)

    void refresh()
}

function QuotaUsagePanel(props: { api: Parameters<TuiPlugin>[0]; state: () => UsageState }) {
    const theme = props.api.theme.current
    const data = () => props.state().data ?? []
    const errorMessage = () => {
        const state = props.state()
        return state.status === "error" ? state.message : undefined
    }

    return (
        <box flexDirection="column">
            <box flexDirection="row">
                <text fg={theme.text} attributes={BOLD}>Quota Remaining</text>
                {props.state().status === "loading" ? <text fg={theme.info}> loading…</text> : null}
            </box>
            <text fg={theme.textMuted}>Updated {formatUpdatedAt(props.state().updated)}</text>
            {errorMessage() ? <text fg={theme.error}>{truncate(errorMessage() ?? "")}</text> : null}
            {data().length === 0 ? <text fg={theme.textMuted}>Waiting for usage data…</text> : null}
            {data().map((entry) => (
                <box flexDirection="column">
                    <text fg={theme.textMuted}>{formatQuotaEntry(entry)}</text>
                    {entry.reset ? <text fg={theme.textMuted}>  {entry.reset}</text> : null}
                </box>
            ))}
        </box>
    )
}

async function hasOpenAIConnection() {
    try {
        return Boolean(pickOauthAuth(await readAuthFile()))
    } catch {
        return false
    }
}

async function loadQuotaUsage(): Promise<QuotaEntry[]> {
    const auth = await readAuthFile()
    const oauth = pickOauthAuth(auth)
    if (!oauth) throw new Error("OpenAI OAuth credentials missing in opencode auth.json")

    const baseUrl = process.env.OPENCODE_CODEX_BASE_URL ?? oauth.enterpriseUrl ?? DEFAULT_BASE_URL
    const payload = await fetchQuotaPayload(oauth.access, baseUrl)
    const entries = extractQuotaEntries(payload)
    if (entries.length === 0) throw new Error("Quota payload did not include rate limits")
    return entries
}

async function readAuthFile(): Promise<AuthFile> {
    const authPath = join(getDataDirectory(), "auth.json")
    const raw = await readFile(authPath, "utf8")
    return JSON.parse(raw) as AuthFile
}

function getDataDirectory() {
    if (platform() === "win32") return process.env.APPDATA ? join(process.env.APPDATA, "opencode") : join(homedir(), "AppData", "Roaming", "opencode")
    return process.env.XDG_DATA_HOME ? join(process.env.XDG_DATA_HOME, "opencode") : join(homedir(), ".local", "share", "opencode")
}

function pickOauthAuth(auth: AuthFile) {
    for (const providerID of ["opencode", "codex", "openai"]) {
        const info = auth[providerID]
        if (info?.type === "oauth") return info
    }

    return Object.values(auth).find((info) => info.type === "oauth")
}

async function fetchQuotaPayload(accessToken: string, baseUrl: string): Promise<unknown> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15_000)

    try {
        const response = await fetch(buildUsageUrl(baseUrl), {
            headers: { Authorization: `Bearer ${accessToken}` },
            signal: controller.signal,
        })
        const bodyText = await response.text()
        const payload = bodyText ? (JSON.parse(bodyText) as unknown) : null

        if (!response.ok) throw new Error(`Quota request failed (${response.status})`)
        return payload
    } finally {
        clearTimeout(timeout)
    }
}

function buildUsageUrl(baseUrl: string) {
    const trimmed = baseUrl.replace(/\/+$/, "")
    return trimmed.includes("/backend-api") ? `${trimmed}/wham/usage` : `${trimmed}/api/codex/usage`
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
        const creditEntry = parseCredits(credits)
        if (creditEntry) entries.push(creditEntry)
    }

    return entries
}

function parseRateLimitWindow(id: string, label: string, snapshot: RateLimitWindowSnapshot): QuotaEntry | null {
    const used = toNumber(snapshot.used_percent)
    if (used === null) return null

    const resetAfter = toNumber(snapshot.reset_after_seconds)
    const resetAt = toNumber(snapshot.reset_at)
    const windowSeconds = toNumber(snapshot.limit_window_seconds)

    return {
        id,
        name: label,
        remaining: Math.max(0, Math.min(100, 100 - used)),
        unit: "%",
        window: windowSeconds ? describeWindow(windowSeconds) : undefined,
        reset: resetAfter !== null ? `resets in ${formatRelativeSeconds(resetAfter)}` : resetAt !== null ? `resets at ${new Date(resetAt * 1000).toLocaleTimeString()}` : undefined,
    }
}

function parseCredits(credits: Record<string, unknown>): QuotaEntry | null {
    if (credits.unlimited === true) return { id: "credits", name: "Credits", remaining: 0, unit: "credits", info: "unlimited" }

    const balance = toNumber(credits.balance)
    if (balance === null) return null
    return { id: "credits", name: "Credits", remaining: balance, unit: "credits", info: "remaining" }
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

function formatQuotaEntry(entry: QuotaEntry) {
    const window = entry.window ? ` (${entry.window})` : ""
    const info = entry.info ? ` ${entry.info}` : ""
    return truncate(`${entry.name}: ${entry.remaining}${entry.unit}${window}${info}`, 72)
}

function formatRelativeSeconds(seconds: number) {
    if (seconds <= 0) return "now"
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    if (hours > 0) return `${hours}h ${remainingMinutes}m`
    return `${minutes}m`
}

function formatUpdatedAt(timestamp?: number) {
    if (!timestamp) return "never"
    return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

function truncate(value: string, maxLength = 80) {
    if (value.length <= maxLength) return value
    return `${value.slice(0, maxLength - 1)}…`
}

const plugin: TuiPluginModule & { id: string } = {
    id: "local.quota-usage",
    tui,
}

export default plugin
