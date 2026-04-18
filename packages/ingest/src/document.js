export function buildDocumentAttachment(fileRef, mimeType, name) {
    return {
        type: "file",
        file: {
            filename: name,
            file_data: fileRef,
            mime_type: mimeType
        }
    };
}
