import { createError } from 'h3'
import { prisma } from './prisma'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { existsSync } from 'node:fs'

export async function getActiveContractTemplateOrThrow() {
  const template = await prisma.contractTemplate.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' }
  })

  if (!template) {
    throw createError({
      statusCode: 404,
      message: 'No active contract template found'
    })
  }

  if (!template.fileUrl) {
    throw createError({
      statusCode: 500,
      message: 'Active contract template has no file URL'
    })
  }

  return template
}

export async function downloadContractTemplateBuffer(template: { fileUrl: string }) {
  const res = await fetch(template.fileUrl)
  if (!res.ok) {
    throw createError({
      statusCode: 502,
      message: `Failed to download contract template (${res.status})`
    })
  }
  const text = await res.text()
  if (!isHtmlTemplate(text)) {
    throw createError({
      statusCode: 415,
      message: 'Active contract template is not HTML. Please upload an HTML template.'
    })
  }
  return text
}

export async function loadLocalContractTemplateHtml() {
  const runtimePath = join(process.cwd(), '.output', 'server', 'templates', 'contract.html')
  if (existsSync(runtimePath)) {
    return await readFile(runtimePath, 'utf-8')
  }

  const templatePath = join(process.cwd(), 'server', 'templates', 'contract.html')
  return await readFile(templatePath, 'utf-8')
}

function isHtmlTemplate(value: string) {
  const trimmed = value.trim().toLowerCase()
  return trimmed.startsWith('<!doctype') || trimmed.startsWith('<html')
}
