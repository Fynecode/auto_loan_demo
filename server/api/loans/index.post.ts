import { prisma } from '~~/server/utils/prisma'
import { generateLoanReference } from '~~/server/utils/generateLoanReference'
import { requireAuth } from '~~/server/utils/requireAuth'
import cloudinary from '~~/server/utils/cloudinary'
import { detectDuplicateLoan } from '~~/server/utils/detectDuplicateLoan'
import { buildContractPayload, calculateLoanFinancials, DEFAULT_DEDUCTION_FEE } from '~~/server/utils/contractPayloadBuilder'
import { getActiveContractTemplateOrThrow, downloadContractTemplateBuffer } from '~~/server/utils/contractTemplate'
import { renderContractDocx, convertDocxToPdf } from '~~/server/utils/contractRenderer'
import { sendLoanContractEmail } from '~~/server/utils/resend'
import { DocumentType } from '@prisma/client'
import { createError, defineEventHandler, readMultipartFormData } from 'h3'
import { validateUpload, allowedPdfDocx, allowedIdCopy } from '~~/server/utils/uploadValidation'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const reference = await generateLoanReference()

  const form = await readMultipartFormData(event)
  if (!form) {
    throw createError({ statusCode: 400, message: 'No form data' })
  }

  const payloadPart = form.find(f => f.name === 'data')
  const sendEmailPart = form.find(f => f.name === 'sendEmail')
  if (!payloadPart?.data) {
    throw createError({ statusCode: 400, message: 'Missing payload' })
  }

  const { client, loan } = JSON.parse(payloadPart.data.toString())

  if (!client || !loan) {
    throw createError({ statusCode: 400, message: 'Missing client or loan data' })
  }

  const {
    fullName,
    empNumber,
    email,
    phone,
    idNumber
  } = client

  const {
    amount,
    interest,
    duration,
    quantity
  } = loan

  if (!fullName || !empNumber || !email || !amount || !interest || !duration) {
    throw createError({
      statusCode: 400,
      message: 'Missing required fields'
    })
  }

  const empString = String(empNumber)
  const quantityValue = Number(quantity ?? 1)

  const existingClient = await prisma.client.findFirst({
    where: {
      OR: [
        { email },
        ...(idNumber ? [{ idNumber }] : []),
        ...(empString ? [{ empNumber: empString }] : [])
      ]
    }
  })

  const clientForDuplicate = {
    email: existingClient?.email ?? email,
    idNumber: existingClient?.idNumber ?? idNumber,
    empNumber: existingClient?.empNumber ?? empString
  }

  const duplicate = await detectDuplicateLoan(prisma, {
    email: clientForDuplicate.email,
    idNumber: clientForDuplicate.idNumber,
    empNumber: clientForDuplicate.empNumber,
    amount,
    interest,
    duration,
    quantity: quantityValue
  })

  if (duplicate) {
    throw createError({
      statusCode: 409,
      message: `Duplicate loan detected (ref: ${duplicate.reference}). Update the existing loan instead.`
    })
  }

  const idCopy = form.find(f => f.name === 'idCopy')
  const bankStatement = form.find(f => f.name === 'bankStatement')
  const payslip = form.find(f => f.name === 'payslip')

  const uploads: Array<{ type: DocumentType; file: any }> = []
  if (idCopy?.data) uploads.push({ type: DocumentType.ID, file: idCopy })
  if (bankStatement?.data) uploads.push({ type: DocumentType.BANK_STATEMENT, file: bankStatement })
  if (payslip?.data) uploads.push({ type: DocumentType.PAYSLIP, file: payslip })

  const uploaded = await Promise.all(
    uploads.map(({ type, file }) => uploadToCloudinary(file, type))
  )

  const template = await getActiveContractTemplateOrThrow()
  const templateBuffer = await downloadContractTemplateBuffer(template)
  const clientForContract = existingClient
    ? {
        fullName: existingClient.firstName,
        email: existingClient.email,
        phone: existingClient.phone,
        idNumber: existingClient.idNumber,
        empNumber: existingClient.empNumber
      }
    : client
  const totalClients = await prisma.client.count()
  const clientNo = existingClient
    ? await prisma.client.count({ where: { createdAt: { lt: existingClient.createdAt } } }) + 1
    : totalClients + 1
  const contractData = await buildContractPayload(clientForContract, loan, {
    clientNo,
    agrNo: reference
  })
  const contractDocxBuffer = renderContractDocx(templateBuffer, contractData)
  const contractPdfBuffer = await convertDocxToPdf(contractDocxBuffer)
  const contractUpload = await uploadContractPdf(contractPdfBuffer)
  const financials = calculateLoanFinancials(
    amount,
    interest,
    duration,
    loan.deductionFee ?? DEFAULT_DEDUCTION_FEE
  )

  const loanResult = await prisma.$transaction(async (tx) => {
    const clientRecord = existingClient
      ? await tx.client.findUnique({ where: { id: existingClient.id } })
      : await tx.client.create({
          data: {
            firstName: fullName,
            empNumber: empString,
            email,
            phone,
            idNumber
          }
        })

    if (!clientRecord) {
      throw createError({ statusCode: 500, message: 'Failed to resolve client record' })
    }

      const createdLoan = await tx.loan.create({
        data: {
          reference,
          principal: amount,
          interestRate: interest,
          durationMonths: duration,
          totalAmountRepayable: financials.totalAmountRepayable,
          totalInterest: financials.totalInterest,
          totalMonthlyInstallment: financials.totalMonthlyInstallment,
          remainingAmount: financials.totalAmountRepayable,
          quantity: quantityValue,
          clientId: clientRecord.id,
          createdById: user.id
        }
      })

    await tx.loanActivity.create({
      data: {
        loanId: createdLoan.id,
        type: 'CREATED',
        performedBy: user.id
      }
    })

    for (const doc of uploaded) {
      await tx.document.create({
        data: {
          type: doc.type,
          fileUrl: doc.url,
          publicId: doc.publicId,
          resourceType: doc.resourceType,
          format: doc.format,
          clientId: clientRecord.id,
          loanId: createdLoan.id
        }
      })
    }

    const contractRecord = await tx.contract.create({
      data: {
        loanId: createdLoan.id,
        fileUrl: contractUpload.url,
        publicId: contractUpload.publicId,
        resourceType: contractUpload.resourceType,
        format: contractUpload.format
      }
    })

    await tx.loan.update({
      where: { id: createdLoan.id },
      data: { contractId: contractRecord.id }
    })

    return tx.loan.findUnique({
      where: { id: createdLoan.id },
      include: { client: true, Documents: true, contract: true }
    })
  }, {
    maxWait: 10000,
    timeout: 20000
  })

  if (sendEmailPart?.data?.toString() === 'true') {
    await sendLoanContractEmail({
      to: email,
      reference,
      attachmentBuffer: contractPdfBuffer
    })
  }

  return loanResult
})

async function uploadToCloudinary(
  file: { data?: Uint8Array; filename?: string; type?: string },
  type: DocumentType
): Promise<{ type: DocumentType; url: string; publicId: string; resourceType: string; format?: string }> {
  if (type === DocumentType.ID) {
    validateUpload(file, allowedIdCopy)
  } else {
    validateUpload(file, allowedPdfDocx)
  }

  const uploadResult = await new Promise<any>((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      {
        folder: 'loan-documents',
        resource_type: 'auto',
        use_filename: true,
        unique_filename: true
      },
      (error, result) => {
        if (error) reject(error)
        else resolve(result)
      }
    ).end(Buffer.from(file.data))
  })

  return {
    type,
    url: uploadResult.secure_url,
    publicId: uploadResult.public_id,
    resourceType: uploadResult.resource_type,
    format: uploadResult.format
  }
}

async function uploadContractPdf(
  pdfBuffer: Buffer
): Promise<{ url: string; publicId: string; resourceType: string; format?: string }> {
  const uploadResult = await new Promise<any>((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      {
        folder: 'loan-contracts',
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


