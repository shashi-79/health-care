export function assertChatModel(model) {
    if (!model)
        throw new Error("Chat model is not configured.");
}
export function assertBgModel(model) {
    if (!model)
        throw new Error("BG model is not configured.");
}
export function assertCallModel(model) {
    if (!model)
        throw new Error("Call model is not configured.");
}
export function assertToolsAllowedOnlyForBg(isBgContext) {
    if (!isBgContext) {
        throw new Error("Tools are restricted to BG agent context.");
    }
}
