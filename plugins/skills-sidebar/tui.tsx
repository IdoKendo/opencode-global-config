/** @jsxImportSource @opentui/solid */
import { Plugin } from "@opencode/plugin/tui"
import { createMemo, createResource, createSignal, For, Show } from "solid-js"

type Skill = {
    name: string
    description: string
}

export default Plugin.define({
    id: "local.skills-sidebar",
    setup(api) {
        return api.ui.slot({
            // Context, quota and the optional Goal panel append inside this slot.
            after: "sidebar.content",
            render: ({ sessionID }) => (
                <box flexDirection="column" gap={1}>
                    <McpPanel api={api} sessionID={sessionID} />
                    <SkillsPanel api={api} sessionID={sessionID} />
                </box>
            ),
        })
    },
})

function McpPanel(props: { api: Plugin.Context; sessionID: string }) {
    const theme = props.api.theme
    const [view, updateView] = props.api.storage.store("mcp", { initial: { open: true } })
    const servers = createMemo(() => {
        const location = props.api.data.session.get(props.sessionID)?.location
        return props.api.data.location.mcp.server.list(location) ?? []
    })
    const connected = () => servers().filter((server) => server.status.status === "connected").length
    const errors = () => servers().filter((server) => ["failed", "needs_auth"].includes(server.status.status)).length
    const labels = { connected: "Connected", pending: "Connecting", failed: "Error", disabled: "Disabled", needs_auth: "Sign in" }
    const color = (status: keyof typeof labels) => ({
        connected: theme.text.feedback.success.base,
        pending: theme.text.muted,
        failed: theme.text.feedback.error.base,
        disabled: theme.text.muted,
        needs_auth: theme.text.feedback.warning.base,
    })[status]

    return (
        <Show when={servers().length > 0}>
            <box flexDirection="column">
                <box flexDirection="row" gap={1} onMouseDown={() => {
                    if (servers().length <= 2) return
                    void updateView((draft) => { draft.open = !draft.open })
                        .catch((error) => console.error("Failed to persist MCP sidebar state", error))
                }}>
                    <Show when={servers().length > 2}>
                        <text fg={theme.text.base}>{view.open ? "▼" : "▶"}</text>
                    </Show>
                    <text fg={theme.text.base}><b>MCP</b></text>
                    <Show when={!view.open && servers().length > 2}>
                        <text fg={theme.text.muted}>({connected()} active{errors() > 0 ? `, ${errors()} errors` : ""})</text>
                    </Show>
                </box>
                <Show when={servers().length <= 2 || view.open}>
                    {/* ponytail: use the public MCP manager until per-server dialogs are exposed by the CLI API. */}
                    <For each={servers()}>{(server) => (
                        <box flexDirection="row" gap={1} minWidth={0} onMouseUp={() => props.api.keymap.dispatch("mcp.list")}>
                            <text flexShrink={0} fg={color(server.status.status)}>•</text>
                            <text fg={theme.text.base} wrapMode="none" truncate flexGrow={1} flexShrink={1} minWidth={0}><b>{server.name}</b></text>
                            <text fg={server.status.status === "failed" ? theme.text.feedback.error.base : theme.text.muted} wrapMode="none" flexShrink={0}>
                                {labels[server.status.status]}
                            </text>
                        </box>
                    )}</For>
                </Show>
            </box>
        </Show>
    )
}

function SkillsPanel(props: { api: Plugin.Context; sessionID: string }) {
    const theme = props.api.theme
    const [open, setOpen] = createSignal(false)
    const location = createMemo(() => props.api.data.session.get(props.sessionID)?.location
        ?? props.api.location ?? props.api.data.location.default())
    const [sync] = createResource(location, (location) => props.api.data.location.skill.sync(location))
    const skills = createMemo(() => (props.api.data.location.skill.list(location()) ?? [])
        .map(({ name, description }) => ({ name, description: description ?? "" }))
        .sort((a, b) => a.name.localeCompare(b.name)))

    return (
        <box flexDirection="column">
            <box flexDirection="row" onMouseUp={() => setOpen((value) => !value)}>
                <text fg={theme.text.base}>{open() ? "▼" : "▶"} Skills ({skills().length})</text>
            </box>
            {open() ? (
                <box flexDirection="column">
                    <Show when={sync.error}>
                        <text fg={theme.text.feedback.error.base}>{sync.error instanceof Error ? sync.error.message : "Unable to load skills"}</text>
                    </Show>
                    {skills().length === 0 && !sync.error ? <text fg={theme.text.muted}>{sync.loading ? "Loading skills…" : "No skills found"}</text> : null}
                    {skills().map((skill) => (
                        <box flexDirection="row" onMouseUp={() => showDescription(props.api, skill)}>
                            <text fg={theme.text.muted}>• </text>
                            <text fg={theme.text.base}>{skill.name}</text>
                        </box>
                    ))}
                </box>
            ) : null}
        </box>
    )
}

function showDescription(api: Plugin.Context, skill: Skill) {
    void api.ui.dialog.alert({
        title: skill.name,
        message: skill.description.replace(/\s+/g, " ").trim() || "No description available",
    })
}
