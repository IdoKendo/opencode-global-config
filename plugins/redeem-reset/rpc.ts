import { Rpc } from "@opencode/plugin/rpc"

export const RedeemResetRpc = Rpc.define({
  id: "local-redeem-reset-v1",
  methods: {
    preview: {
      input: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      output: {
        type: "object",
        properties: {
          creditId: { type: "string" },
          expiresAt: { type: "string" },
        },
        required: ["creditId", "expiresAt"],
        additionalProperties: false,
      },
      errors: {
        failed: {
          type: "object",
          properties: { message: { type: "string" } },
          required: ["message"],
          additionalProperties: false,
        },
      },
    },
    redeem: {
      input: {
        type: "object",
        properties: {
          creditId: { type: "string" },
        },
        required: ["creditId"],
        additionalProperties: false,
      },
      output: {
        type: "object",
        properties: { success: { type: "boolean" } },
        required: ["success"],
        additionalProperties: false,
      },
      errors: {
        failed: {
          type: "object",
          properties: { message: { type: "string" } },
          required: ["message"],
          additionalProperties: false,
        },
      },
    },
  },
  events: {},
} as const)
