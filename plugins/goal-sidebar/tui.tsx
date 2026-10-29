/** @jsxImportSource @opentui/solid */
import { Plugin } from "@opencode/plugin/tui"
import { Rpc } from "@opencode/plugin/rpc"
import { createResource, onCleanup, Show } from "solid-js"

type Goal = {
    objective: string
    status: "active" | "paused" | "complete"
    reason?: string
}

const goalSchema = {
    anyOf: [
        { type: "null" },
        {
            type: "object",
            properties: {
                objective: { type: "string" },
                status: { type: "string", enum: ["active", "paused", "complete"] },
                reason: { type: "string" },
            },
            required: ["objective", "status"],
        },
    ],
}

// Built-in opencode.goal RPC contract (OpenCode 2.2.1).
const GoalRpc = Rpc.define({
    id: "opencode.goal",
    methods: {
        get: {
            input: {
                type: "object",
                properties: { sessionID: { type: "string" } },
                required: ["sessionID"],
                additionalProperties: false,
            },
            output: goalSchema,
        },
    },
    events: {
        changed: {
            schema: {
                type: "object",
                properties: { sessionID: { type: "string" }, goal: goalSchema },
                required: ["sessionID", "goal"],
            },
        },
    },
})

export default Plugin.define({
    id: "local.goal-sidebar",
    setup(api) {
        return api.ui.slot({
            after: "sidebar.content",
            render: (props) => <GoalPanel api={api} sessionID={props.sessionID} />,
        })
    },
})

function GoalPanel(props: { api: Plugin.Context; sessionID: string }) {
    const theme = props.api.theme
    const rpc = props.api.client.rpc(GoalRpc)
    const [goal, { refetch }] = createResource(() => props.sessionID, async (sessionID) => {
        const location = props.api.data.session.get(sessionID)?.location
            ?? props.api.location ?? props.api.data.location.default()
        return await rpc.get({ sessionID }, { location }) as Goal | null
    })
    const unsubscribe = rpc.events.on("changed", (event) => {
        if (event.data.sessionID === props.sessionID) void refetch()
    })
    onCleanup(unsubscribe)

    const colors = {
        active: theme.text.feedback.info.base,
        paused: theme.text.feedback.warning.base,
        complete: theme.text.feedback.success.base,
    }
    const labels = { active: "Active", paused: "Paused", complete: "Complete" }

    return (
        <box flexDirection="column">
            <text fg={theme.text.base}><b>Goal</b></text>
            <Show when={!goal.error} fallback={<text fg={theme.text.feedback.error.base}>Unable to load goal</text>}>
                <Show when={goal()} fallback={
                    <text fg={theme.text.muted}>{goal.loading ? "Loading goal…" : "No goal set · /goal <objective>"}</text>
                }>
                    {(current) => (
                        <box flexDirection="column">
                            <text fg={colors[current().status]}>{labels[current().status]}</text>
                            <text fg={theme.text.base} wrapMode="word">{current().objective}</text>
                            <Show when={current().reason}>
                                <text fg={theme.text.muted} wrapMode="word">{current().reason}</text>
                            </Show>
                        </box>
                    )}
                </Show>
            </Show>
        </box>
    )
}
