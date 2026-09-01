import { describe, expect, it } from 'vitest';
import { isPdfDocument, validatePdfDocument } from './documentValidation';

describe('documentValidation', () => {
  it('accepts PDF documents by extension and MIME type', () => {
    expect(isPdfDocument({ name: 'resume.pdf', type: 'application/pdf' })).toBe(true);
    expect(isPdfDocument({ name: 'Transcript.PDF', type: 'application/pdf' })).toBe(true);
  });

  it('allows empty MIME type when the browser only provides the filename', () => {
    expect(isPdfDocument({ name: 'portfolio.pdf', type: '' })).toBe(true);
  });

  it('rejects Word documents, images, and spoofed PDF filenames', () => {
    expect(validatePdfDocument({ name: 'resume.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })).toEqual({
      valid: false,
      message: 'Upload a PDF file only. Word documents, images, and other formats are not accepted.',
    });
    expect(isPdfDocument({ name: 'resume.pdf', type: 'image/png' })).toBe(false);
    expect(isPdfDocument({ name: 'resume', type: 'application/pdf' })).toBe(false);
  });
});
