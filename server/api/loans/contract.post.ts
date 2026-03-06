import {
  readMultipartFormData,
  createError,
  defineEventHandler,
  setHeader
} from 'h3'

import { buildContractPayload } from '~~/server/utils/contractPayloadBuilder'
import { prisma } from '~~/server/utils/prisma'
import { generateLoanReference } from '~~/server/utils/generateLoanReference'
import { getActiveContractTemplateOrThrow, downloadContractTemplateBuffer } from '~~/server/utils/contractTemplate'
import { renderContractDocx, convertDocxToPdf } from '~~/server/utils/contractRenderer'

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

  try {
    const template = await getActiveContractTemplateOrThrow()
    const templateBuffer = await downloadContractTemplateBuffer(template)
    const docxBuffer = renderContractDocx(templateBuffer, contractData)
    const pdfBuffer = await convertDocxToPdf(docxBuffer)

    setHeader(event, 'Content-Type', 'application/pdf')
    setHeader(event, 'Content-Disposition', 'inline; filename=contract.pdf')

    return pdfBuffer

  } catch (err: any) {
    console.error(err)
    throw createError({
      statusCode: 500,
      message: err.message || 'Contract generation failed'
    })
  }
})
