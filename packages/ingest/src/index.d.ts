export type InputKind = "text" | "audio" | "document" | "image";
export type IngestInput = {
    kind: InputKind;
    mimeType?: string;
    name?: string;
    text?: string;
    fileRef?: string;
};
export declare function detectInputKind(mimeType?: string): InputKind;
export * from "./audio";
export * from "./document";
