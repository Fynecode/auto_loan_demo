import { createError, defineEventHandler, setHeader } from 'h3'
import { requireAuth } from '~~/server/utils/requireAuth'
import { getActiveContractTemplateOrThrow, downloadContractTemplateBuffer, loadLocalContractTemplateHtml } from '~~/server/utils/contractTemplate'
import { renderContractHtml } from '~~/server/utils/contractRenderer'
import { getContractLogoUrl } from '~~/server/utils/settings'

export default defineEventHandler(async (event) => {
  requireAuth(event)

  try {
    const template = await getActiveContractTemplateOrThrow().catch(() => null)
    const templateHtml = template
      ? await downloadContractTemplateBuffer(template)
      : await loadLocalContractTemplateHtml()
    const logoUrl = await getContractLogoUrl()
    const previewHtml = renderContractHtml(templateHtml, {
      logoUrl,
      clientNumber: '0001',
      agreementNumber: 'GL-0001',
      idNumber: '00000000000',
      employmentNumber: 'EMP-0000',
      clientName: 'Client Name',
      loanAmount: 'N$ 0.00',
      loanPeriod: '0 months',
      interestRate: '0%',
      totalRepayable: 'N$ 0.00',
      monthlyInstallment: 'N$ 0.00',
      bankName: 'Bank',
      accountNumber: '0000000000',
      branchCode: '000000'
    })
    setHeader(event, 'Content-Type', 'text/html; charset=utf-8')
    setHeader(event, 'Content-Disposition', 'inline; filename=contract-template.html')

    return previewHtml
  } catch (error: any) {
    setHeader(event, 'Content-Type', 'text/html; charset=utf-8')
    setHeader(event, 'Content-Disposition', 'inline; filename=contract-template.html')
    return `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #b91c1c; }
          </style>
        </head>
        <body>
          <h3>Failed to load contract preview</h3>
          <p>${String(error?.message ?? 'Unknown error')}</p>
        </body>
      </html>
    `
  }
})
