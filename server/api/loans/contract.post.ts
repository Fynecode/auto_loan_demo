import {
  readMultipartFormData,
  createError,
  defineEventHandler,
  setHeader
} from 'h3'

import { buildContractPayload } from '~~/server/utils/contractPayloadBuilder'
import PizZip from 'pizzip'
import Docxtemplater from 'docxtemplater'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import crypto from 'crypto'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

export default defineEventHandler(async (event) => {
  const form = await readMultipartFormData(event)
  if (!form) throw createError({ statusCode: 400, message: 'No form data' })

  const template = form.find(f => f.name === 'template')
  const payloadPart = form.find(f => f.name === 'data')

  if (!template || !payloadPart) {
    throw createError({
      statusCode: 400,
      message: 'Missing template or payload'
    })
  }

  const { client, loan } = JSON.parse(payloadPart.data.toString())

  const contractData = await buildContractPayload(client, loan)

  try {
    const zip = new PizZip(template.data)
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true
    })

    doc.render(contractData)

    const docxBuffer = doc.getZip().generate({ type: 'nodebuffer' })

    const tmpDir = path.join(os.tmpdir(), 'loan-contracts')
    await fs.mkdir(tmpDir, { recursive: true })

    const id = crypto.randomUUID()
    const docxPath = path.join(tmpDir, `${id}.docx`)
    const pdfPath = path.join(tmpDir, `${id}.pdf`)

    await fs.writeFile(docxPath, docxBuffer)

    await convertWithLibreOffice(docxPath, tmpDir)

    const pdfBuffer = await fs.readFile(pdfPath)

    fs.unlink(docxPath).catch(() => {})
    fs.unlink(pdfPath).catch(() => {})

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

async function convertWithLibreOffice(
  inputPath: string,
  outputDir: string
): Promise<void> {
  try {
    await execFileAsync('soffice', [
      '--headless',
      '--nologo',
      '--nofirststartwizard',
      '--convert-to',
      'pdf',
      '--outdir',
      outputDir,
      inputPath
    ])
  } catch (err: any) {
    const details = err?.stderr || err?.stdout || err?.message || 'Unknown error'
    throw new Error(`LibreOffice conversion failed: ${details}`)
  }
}
