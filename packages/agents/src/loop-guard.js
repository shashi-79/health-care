export function shouldStopLoop(state) {
    if (state.iteration >= 50)
        return true;
    if (state.repeatedCallCount >= 2)
        return true;
    if (state.noProgressCount >= 2)
        return true;
    return false;
}
