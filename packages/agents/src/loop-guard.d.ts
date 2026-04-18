export type LoopState = {
    iteration: number;
    repeatedCallCount: number;
    noProgressCount: number;
};
export declare function shouldStopLoop(state: LoopState): boolean;
