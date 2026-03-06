import Docxtemplater from 'docxtemplater'
import PizZip from 'pizzip'
import libre from 'libreoffice-convert'

export function renderContractDocx(templateBuffer: Buffer, data: Record<string, unknown>) {
  const zip = new PizZip(templateBuffer)
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true
  })

  doc.render(data)

  return doc.getZip().generate({
    type: 'nodebuffer',
    compression: 'DEFLATE'
  }) as Buffer
}

export async function convertDocxToPdf(docxBuffer: Buffer) {
  return new Promise<Buffer>((resolve, reject) => {
    libre.convert(docxBuffer, '.pdf', undefined, (err, done) => {
      if (err) reject(err)
      else resolve(done as Buffer)
    })
  })
}
