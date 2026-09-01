export interface DocumentValidationResult {
  valid: boolean;
  message: string | null;
}

const PDF_MIME_TYPE = 'application/pdf';

export function isPdfDocument(file: Pick<File, 'name' | 'type'> | null | undefined): boolean {
  if (!file) return false;

  const hasPdfExtension = file.name.trim().toLowerCase().endsWith('.pdf');
  const mimeType = file.type.trim().toLowerCase();
  const hasValidMimeType = mimeType === '' || mimeType === PDF_MIME_TYPE;

  return hasPdfExtension && hasValidMimeType;
}

export function validatePdfDocument(file: Pick<File, 'name' | 'type'> | null | undefined): DocumentValidationResult {
  if (!file) {
    return { valid: true, message: null };
  }

  if (isPdfDocument(file)) {
    return { valid: true, message: null };
  }

  return {
    valid: false,
    message: 'Upload a PDF file only. Word documents, images, and other formats are not accepted.',
  };
}
