import { createError, defineEventHandler, setHeader } from 'h3'
import { requireAuth } from '~~/server/utils/requireAuth'
import { getActiveContractTemplateOrThrow, downloadContractTemplateBuffer } from '~~/server/utils/contractTemplate'
import { convertDocxToPdf } from '~~/server/utils/contractRenderer'

export default defineEventHandler(async (event) => {
  requireAuth(event)

  const template = await getActiveContractTemplateOrThrow()
  const docxBuffer = await downloadContractTemplateBuffer(template)
  const pdfBuffer = await convertDocxToPdf(docxBuffer)

  setHeader(event, 'Content-Type', 'application/pdf')
  setHeader(event, 'Content-Disposition', 'inline; filename=contract-template.pdf')

  return pdfBuffer
})
