/** @jsxImportSource @opentui/solid */
import type { TuiPlugin, TuiPluginModule } from "@opencode-ai/plugin/tui"
import { createSignal } from "solid-js"

type Skill = {
    name: string
    description: string
}

type SkillState =
    | { status: "ok"; skills: Skill[] }
    | { status: "error"; message: string }

const tui: TuiPlugin = async (api) => {
    const state = await loadSkills(api)

    api.slots.register({
        order: 300,
        slots: {
            sidebar_content() {
                return <SkillsPanel api={api} state={state} />
            },
        },
    })
}

function SkillsPanel(props: { api: Parameters<TuiPlugin>[0]; state: SkillState }) {
    const theme = props.api.theme.current
    const [open, setOpen] = createSignal(true)

    if (props.state.status === "error") {
        return (
            <box flexDirection="column" gap={1}>
                <text fg={theme.text}>Skills</text>
                <text fg={theme.error}>{props.state.message}</text>
            </box>
        )
    }

    const skills = props.state.skills

    return (
        <box flexDirection="column">
            <box flexDirection="row" onMouseUp={() => setOpen((value) => !value)}>
                <text fg={theme.text}>{open() ? "▼" : "▶"} Skills ({skills.length})</text>
            </box>
            {open() ? (
                <box flexDirection="column">
                    {skills.length === 0 ? <text fg={theme.textMuted}>No skills found</text> : null}
                    {skills.map((skill) => (
                        <box flexDirection="row" onMouseUp={() => showDescription(props.api, skill)}>
                            <text fg={theme.textMuted}>• </text>
                            <text fg={theme.text}>{skill.name}</text>
                        </box>
                    ))}
                </box>
            ) : null}
        </box>
    )
}

async function loadSkills(api: Parameters<TuiPlugin>[0]): Promise<SkillState> {
    try {
        const result = await api.client.app.skills({
            directory: api.state.path.directory,
        })

        const skills = (result.data ?? [])
            .map(({ name, description }) => ({ name, description }))
            .sort((a, b) => a.name.localeCompare(b.name))

        return { status: "ok", skills }
    } catch (error) {
        return { status: "error", message: error instanceof Error ? error.message : "Unable to load skills" }
    }
}

function showDescription(api: Parameters<TuiPlugin>[0], skill: Skill) {
    const DialogAlert = api.ui.DialogAlert

    api.ui.dialog.replace(() => (
        <DialogAlert
            title={skill.name}
            message={skill.description.replace(/\s+/g, " ").trim() || "No description available"}
            onConfirm={() => api.ui.dialog.clear()}
        />
    ))
}

const plugin: TuiPluginModule & { id: string } = {
    id: "local.skills-sidebar",
    tui,
}

export default plugin
