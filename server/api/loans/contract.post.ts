import {
  readMultipartFormData,
  createError,
  defineEventHandler,
  setHeader
} from 'h3'

import { buildContractPayload } from '~~/server/utils/contractPayloadBuilder'
import { prisma } from '~~/server/utils/prisma'
import { generateLoanReference } from '~~/server/utils/generateLoanReference'
import { getActiveContractTemplateOrThrow, downloadContractTemplateBuffer, loadLocalContractTemplateHtml } from '~~/server/utils/contractTemplate'
import { renderContractHtml, convertHtmlToPdf } from '~~/server/utils/contractRenderer'
import { getContractLogoUrl } from '~~/server/utils/settings'
import cloudinary from '~~/server/utils/cloudinary'

export default defineEventHandler(async (event) => {
  const form = await readMultipartFormData(event)
  if (!form) throw createError({ statusCode: 400, message: 'No form data' })

  const payloadPart = form.find(f => f.name === 'data')

  if (!payloadPart?.data) {
    throw createError({
      statusCode: 400,
      message: 'Missing payload'
    })
  }

  const { client, loan } = JSON.parse(payloadPart.data.toString())

  const empString = String(client.empNumber ?? '')
  const existingClient = await prisma.client.findFirst({
    where: {
      OR: [
        ...(client.email ? [{ email: client.email }] : []),
        ...(client.idNumber ? [{ idNumber: client.idNumber }] : []),
        ...(empString ? [{ empNumber: empString }] : [])
      ]
    }
  })

  const totalClients = await prisma.client.count()
  const clientNo = existingClient
    ? await prisma.client.count({ where: { createdAt: { lt: existingClient.createdAt } } }) + 1
    : totalClients + 1

  const agrNo = await generateLoanReference()

  const contractData = await buildContractPayload(client, loan, { clientNo, agrNo })
  const logoUrl = await getContractLogoUrl()

  try {
    const template = await getActiveContractTemplateOrThrow().catch(() => null)
    let templateHtml: string
    if (template) {
      try {
        templateHtml = await downloadContractTemplateBuffer(template)
      } catch (error) {
        console.warn('Contract template fallback to local HTML:', (error as Error).message)
        templateHtml = await loadLocalContractTemplateHtml()
      }
    } else {
      templateHtml = await loadLocalContractTemplateHtml()
    }
    const html = renderContractHtml(templateHtml, { ...contractData, logoUrl })
    const pdfBuffer = await convertHtmlToPdf(html)
    const upload = await uploadPreviewPdf(pdfBuffer)

    setHeader(event, 'Content-Type', 'application/json; charset=utf-8')
    return upload

  } catch (err: any) {
    console.error(err)
    throw createError({
      statusCode: 500,
      message: err.message || 'Contract generation failed'
    })
  }
})

async function uploadPreviewPdf(
  pdfBuffer: Buffer
): Promise<{ url: string; publicId: string; resourceType: string; format?: string }> {
  const uploadResult = await new Promise<any>((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      {
        folder: 'loan-contract-previews',
        resource_type: 'auto',
        use_filename: true,
        unique_filename: true
      },
      (error, result) => {
        if (error) reject(error)
        else resolve(result)
      }
    ).end(pdfBuffer)
  })

  return {
    url: uploadResult.secure_url,
    publicId: uploadResult.public_id,
    resourceType: uploadResult.resource_type,
    format: uploadResult.format
  }
}
