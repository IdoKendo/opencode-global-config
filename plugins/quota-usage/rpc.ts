import { Rpc } from "@opencode/plugin/rpc"

export type QuotaEntry = {
    id: string
    name: string
    remaining: number
    unit: string
    progress?: number
    window?: string
    /** Time until the quota resets, in seconds. */
    reset?: number
    /** Time until each credit expires, in seconds. */
    expiries?: number[]
    info?: string
}

export type QuotaResult = { connected: boolean; entries: QuotaEntry[] }

export const QuotaUsageRpc = Rpc.define({
    id: "local.quota-usage",
    methods: {
        read: {
            input: { type: "object", additionalProperties: false },
            output: {
                type: "object",
                properties: {
                    connected: { type: "boolean" },
                    entries: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                id: { type: "string" },
                                name: { type: "string" },
                                remaining: { type: "number" },
                                unit: { type: "string" },
                                progress: { type: "number" },
                                window: { type: "string" },
                                reset: { type: "number" },
                                expiries: { type: "array", items: { type: "number" } },
                                info: { type: "string" },
                            },
                            required: ["id", "name", "remaining", "unit"],
                            additionalProperties: false,
                        },
                    },
                },
                required: ["connected", "entries"],
                additionalProperties: false,
            },
            errors: {
                unavailable: {
                    type: "object",
                    additionalProperties: false,
                },
            },
        },
    },
    events: {},
})
