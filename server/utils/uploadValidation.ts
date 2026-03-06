import { createError } from 'h3'

type UploadFile = {
  data?: Uint8Array
  filename?: string
  type?: string
}

type AllowedSpec = {
  label: string
  mime: string[]
  extensions: string[]
}

const MAX_BYTES = 10 * 1024 * 1024

export const allowedPdfDocx: AllowedSpec = {
  label: 'PDF or DOCX',
  mime: [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ],
  extensions: ['pdf', 'docx']
}

export const allowedPdfOnly: AllowedSpec = {
  label: 'PDF',
  mime: ['application/pdf'],
  extensions: ['pdf']
}

export const allowedIdCopy: AllowedSpec = {
  label: 'ID copy (PDF/JPG/PNG)',
  mime: ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'],
  extensions: ['pdf', 'jpg', 'jpeg', 'png']
}

export const allowedDocxOnly: AllowedSpec = {
  label: 'DOCX',
  mime: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  extensions: ['docx']
}

export function validateUpload(file: UploadFile, allowed: AllowedSpec, maxBytes = MAX_BYTES) {
  if (!file?.data) {
    throw createError({ statusCode: 400, message: 'Missing file data' })
  }

  if (file.data.length > maxBytes) {
    throw createError({
      statusCode: 400,
      message: `File exceeds ${Math.round(maxBytes / (1024 * 1024))}MB limit`
    })
  }

  const filename = file.filename || ''
  const ext = filename.includes('.') ? filename.split('.').pop()!.toLowerCase() : ''
  const mime = (file.type || '').toLowerCase()

  const extOk = ext ? allowed.extensions.includes(ext) : false
  const mimeOk = mime ? allowed.mime.includes(mime) : false

  if (!extOk && !mimeOk) {
    throw createError({
      statusCode: 400,
      message: `Invalid file type. Allowed: ${allowed.label}`
    })
  }
}
