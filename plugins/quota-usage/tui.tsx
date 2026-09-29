/** @jsxImportSource @opentui/solid */
import { Plugin } from "@opencode/plugin/tui"
import { createTextAttributes } from "@opentui/core"
import { createSignal, Show } from "solid-js"
import { QuotaUsageRpc, type QuotaEntry, type QuotaResult } from "./rpc.js"

const BOLD = createTextAttributes({ bold: true })

type UsageState =
    | { status: "loading"; updated?: number; data?: QuotaEntry[] }
    | { status: "ok"; updated: number; data: QuotaEntry[] }
    | { status: "error"; updated: number; data?: QuotaEntry[]; message: string }

export default Plugin.define({
    id: "local.quota-usage",
    setup(api) {
        const quota = api.client.rpc(QuotaUsageRpc)
        const [state, setState] = createSignal<UsageState>({ status: "loading" })
        const [visible, setVisible] = createSignal(true)
        let request: AbortController | undefined

        const refresh = async () => {
            request?.abort()
            const controller = new AbortController()
            request = controller
            setState((current) => ({ status: "loading", updated: current.updated, data: current.data }))
            try {
                const result = await quota.read({}, {
                    location: api.location ?? api.data.location.default(),
                    signal: controller.signal,
                }) as QuotaResult
                if (controller.signal.aborted) return
                setVisible(result.connected)
                setState({ status: "ok", data: result.entries, updated: Date.now() })
            } catch {
                if (controller.signal.aborted) return
                setVisible(true)
                setState((current) => ({
                    status: "error",
                    data: current.data,
                    updated: Date.now(),
                    message: "Unable to load quota usage; check the quota server plugin and OpenAI connection",
                }))
            }
        }

        const removeSlot = api.ui.slot({
            append: "sidebar.content",
            render: () => <Show when={visible()}><QuotaUsagePanel api={api} state={state} /></Show>,
        })
        const unsubscribe = api.data.listen(({ details: event }) => {
            if (event.type !== "session.execution.succeeded" &&
                event.type !== "session.execution.failed" &&
                event.type !== "session.execution.interrupted") return
            if (event.type === "session.execution.interrupted" && event.data.reason === "shutdown") return
            const sessionID = event.data.sessionID
            if (!api.data.session.get(sessionID)?.parentID) void refresh()
        })
        const unsubscribeCredentials = api.data.on("credential.switched", () => void refresh())
        void refresh()
        return () => {
            request?.abort()
            unsubscribe()
            unsubscribeCredentials()
            removeSlot()
        }
    },
})

function QuotaUsagePanel(props: { api: Plugin.Context; state: () => UsageState }) {
    const theme = props.api.theme
    const data = () => props.state().data ?? []
    const errorMessage = () => {
        const state = props.state()
        return state.status === "error" ? state.message : undefined
    }
    return (
        <box flexDirection="column">
            <box flexDirection="row">
                <text fg={theme.text.base} attributes={BOLD}>Quota Remaining</text>
                {props.state().status === "loading" ? <text fg={theme.text.feedback.info.base}> loading…</text> : null}
            </box>
            <text fg={theme.text.muted}>Updated {formatUpdatedAt(props.state().updated)}</text>
            {errorMessage() ? <text fg={theme.text.feedback.error.base}>{truncate(errorMessage() ?? "")}</text> : null}
            {data().length === 0 ? <text fg={theme.text.muted}>Waiting for usage data…</text> : null}
            {data().map((entry) => (
                <box flexDirection="column">
                    <text fg={theme.text.muted}>{formatQuotaEntry(entry)}</text>
                    {entry.progress !== undefined ? (
                        <box height={1} width="100%" backgroundColor={theme.background.raised.base}>
                            {entry.progress > 0 ? <box height={1} width={`${entry.progress}%`} backgroundColor={theme.text.feedback.info.base} /> : null}
                        </box>
                    ) : null}
                    {entry.reset ? <text fg={theme.text.muted}>  {entry.reset}</text> : null}
                </box>
            ))}
        </box>
    )
}

function formatQuotaEntry(entry: QuotaEntry) {
    const window = entry.window ? ` (${entry.window})` : ""
    const info = entry.info ? ` ${entry.info}` : ""
    return truncate(`${entry.name}: ${entry.remaining}${entry.unit}${window}${info}`, 72)
}

function formatUpdatedAt(timestamp?: number) {
    if (!timestamp) return "never"
    return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" })
}

function truncate(value: string, maxLength = 80) {
    if (value.length <= maxLength) return value
    return `${value.slice(0, maxLength - 1)}…`
}
