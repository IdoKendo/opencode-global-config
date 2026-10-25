import { Plugin } from "@opencode/plugin/tui"
import { RedeemResetRpc } from "./rpc"

export default Plugin.define({
  id: "local.redeem-reset.tui",
  setup(context) {
    context.keymap.layer(() => ({
      mode: "global",
      commands: [
        {
          id: "local.redeem-reset.confirm",
          title: "Redeem expiring usage reset",
          group: "OpenAI",
          palette: true,
          slash: { name: "redeem-reset" },
          enabled: () => true,
          run: async () => {
            let preview: { creditId: string; expiresAt: string }
            try {
              preview = await context.client.rpc(RedeemResetRpc).preview({}) as { creditId: string; expiresAt: string }
            } catch (error) {
              context.ui.toast.show({
                message: errorMessage(error, "Could not load available reset credits."),
                variant: "error",
              })
              return
            }

            const expiresIn = formatDuration(Math.floor((Date.parse(preview.expiresAt) - Date.now()) / 1000))
            const choice = await context.ui.dialog.select({
              title: "Review banked reset",
              options: [
                { title: "Cancel", value: "cancel", description: "Do not redeem a reset." },
                { title: "Redeem this reset", value: "continue", description: `Expires in ${expiresIn}.` },
              ],
            })
            const confirmed = choice === "continue"

            if (!confirmed) {
              context.ui.toast.show({ message: "Reset redemption cancelled.", variant: "warning" })
              return
            }

            try {
              await context.client.rpc(RedeemResetRpc).redeem({ creditId: preview.creditId })
              context.ui.toast.show({ message: "Banked reset redeemed successfully.", variant: "success" })
            } catch (error) {
              context.ui.toast.show({
                message: errorMessage(error, "Reset redemption failed. Check your usage before retrying."),
                variant: "error",
              })
            }
          },
        },
      ],
    }))
  },
})

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message
  if (typeof error === "string" && error.length > 0) return error
  if (typeof error === "object" && error !== null) {
    const candidate = error as {
      message?: unknown
      data?: { message?: unknown }
      error?: { message?: unknown; data?: { message?: unknown } }
    }
    if (typeof candidate.message === "string") return candidate.message
    if (typeof candidate.data?.message === "string") return candidate.data.message
    if (typeof candidate.error?.message === "string") return candidate.error.message
    if (typeof candidate.error?.data?.message === "string") return candidate.error.data.message
  }
  return fallback
}

function formatDuration(seconds: number) {
  if (seconds <= 0) return "0m"
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  const remainingHours = hours % 24
  const remainingMinutes = minutes % 60
  if (days > 0) return `${days}d ${remainingHours}h ${remainingMinutes}m`
  if (hours > 0) return `${hours}h ${remainingMinutes}m`
  return `${minutes}m`
}
