export function assertChatModel(model: string) {
  if (!model) throw new Error("Chat model is not configured.");
}

export function assertBgModel(model: string) {
  if (!model) throw new Error("BG model is not configured.");
}

export function assertCallModel(model: string) {
  if (!model) throw new Error("Call model is not configured.");
}

export function assertToolsAllowedOnlyForBg(isBgContext: boolean) {
  if (!isBgContext) {
    throw new Error("Tools are restricted to BG agent context.");
  }
}
