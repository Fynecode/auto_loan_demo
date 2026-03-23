export type ContractPreviewMeta = {
  reference: string
  url: string
  publicId: string
  resourceType: string
  format?: string
}

const INDEX_KEY = 'contract-preview-index'

function safeParse<T>(value: string | null): T | null {
  if (!value) return null
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

function readIndex(): string[] {
  if (!process.client) return []
  const data = safeParse<string[]>(localStorage.getItem(INDEX_KEY))
  if (!Array.isArray(data)) return []
  return data.filter((entry) => typeof entry === 'string' && entry.length > 0)
}

function writeIndex(index: string[]) {
  if (!process.client) return
  localStorage.setItem(INDEX_KEY, JSON.stringify(index))
}

export function listPreviewMetas(): ContractPreviewMeta[] {
  if (!process.client) return []
  const index = readIndex()
  const metas: ContractPreviewMeta[] = []
  const validKeys: string[] = []

  for (const key of index) {
    const meta = safeParse<ContractPreviewMeta>(localStorage.getItem(key))
    if (meta && meta.reference && meta.publicId && meta.resourceType && meta.url) {
      metas.push(meta)
      validKeys.push(key)
    } else {
      localStorage.removeItem(key)
    }
  }

  if (validKeys.length !== index.length) {
    writeIndex(validKeys)
  }

  return metas
}

export function storePreviewMeta(meta: ContractPreviewMeta) {
  if (!process.client) return
  const index = readIndex()
  if (!index.includes(meta.reference)) {
    index.push(meta.reference)
    writeIndex(index)
  }
  localStorage.setItem(meta.reference, JSON.stringify(meta))
}

export function removePreviewMeta(reference: string) {
  if (!process.client) return
  localStorage.removeItem(reference)
  const index = readIndex().filter((item) => item !== reference)
  writeIndex(index)
}

export function clearAllPreviewMetas() {
  if (!process.client) return
  const index = readIndex()
  for (const key of index) {
    localStorage.removeItem(key)
  }
  localStorage.removeItem(INDEX_KEY)
}
