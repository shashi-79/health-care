export function buildDocumentAttachment(fileRef: string, mimeType: string, name: string) {
  return {
    type: "file",
    file: {
      filename: name,
      file_data: fileRef,
      mime_type: mimeType
    }
  };
}
