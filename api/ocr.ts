import { createClient } from '@supabase/supabase-js'

type OcrRequest = { documentId?: unknown }
type OcrApiRequest = { method?: string; headers: Record<string, string | string[] | undefined>; body?: unknown }
type OcrApiResponse = {
  setHeader(name: string, value: string): void
  status(code: number): OcrApiResponse
  json(body: unknown): void
}

type NodeRuntime = typeof globalThis & {
  process: { env: Record<string, string | undefined> }
  Buffer: { from(value: ArrayBuffer): { toString(encoding: 'base64'): string } }
}
export default async function handler(request: OcrApiRequest, response: OcrApiResponse) {
  response.setHeader('Cache-Control', 'no-store')
  response.setHeader('Vary', 'Origin')

  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    return response.status(405).json({ error: 'Method not allowed.' })
  }

  const rawOrigin = request.headers.origin
  const origin = Array.isArray(rawOrigin) ? rawOrigin[0] : rawOrigin
  const rawHost = request.headers['x-forwarded-host'] ?? request.headers.host
  const host = Array.isArray(rawHost) ? rawHost[0] : rawHost
  if (origin && host && new URL(origin).host !== host) {
    return response.status(403).json({ error: 'Cross-origin requests are not allowed.' })
  }

  const authorization = request.headers.authorization
  const token = typeof authorization === 'string' ? authorization.match(/^Bearer\s+(.+)$/i)?.[1] : undefined
  const runtime = globalThis as NodeRuntime
  const supabaseUrl = runtime.process.env.SUPABASE_URL
  const supabaseAnonKey = runtime.process.env.SUPABASE_ANON_KEY
  const visionApiKey = runtime.process.env.GOOGLE_CLOUD_VISION_API_KEY
  if (!token) return response.status(401).json({ error: 'Sign in to process this document.' })
  if (!supabaseUrl || !supabaseAnonKey) return response.status(503).json({ error: 'Document processing is not configured.' })

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  })

  let documentId: string | null = null
  try {
    const { data: { user }, error: userError } = await client.auth.getUser(token)
    if (userError || !user) return response.status(401).json({ error: 'Your session is not valid.' })

    const body = request.body as OcrRequest
    if (typeof body?.documentId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.documentId)) {
      return response.status(400).json({ error: 'A valid document ID is required.' })
    }

    const { data: document, error: documentError } = await client
      .from('documents')
      .select('id, storage_path, mime_type, byte_size')
      .eq('id', body.documentId)
      .single()

    if (documentError || !document) return response.status(404).json({ error: 'Document not found or access denied.' })
    documentId = document.id
    if (!document.mime_type.startsWith('image/')) {
      await client.from('documents').update({ ocr_status: 'not_supported', ocr_error: 'OCR currently supports scanned image files.' }).eq('id', document.id)
      return response.status(422).json({ error: 'OCR supports scanned JPEG, PNG, and WebP images. This file remains securely stored.' })
    }
    if (document.byte_size > 12 * 1024 * 1024) return response.status(413).json({ error: 'The document exceeds the 12 MB OCR limit.' })
    if (!visionApiKey) return response.status(503).json({ error: 'OCR provider is not configured. The document was uploaded securely.' })

    const { data: file, error: fileError } = await client.storage.from('church-documents').download(document.storage_path)
    if (fileError || !file) return response.status(404).json({ error: 'The private document could not be read.' })
    const content = runtime.Buffer.from(await file.arrayBuffer()).toString('base64')
    const visionResponse = await fetch('https://vision.googleapis.com/v1/images:annotate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': visionApiKey },
      signal: AbortSignal.timeout(25000),
      body: JSON.stringify({
        requests: [{
          image: { content },
          features: [{ type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 }],
        }],
      }),
    })

    if (!visionResponse.ok) throw new Error('The OCR provider could not process this scan.')
    const visionResult = await visionResponse.json() as {
      responses?: Array<{ fullTextAnnotation?: { text?: string }; error?: { message?: string } }>
    }
    const result = visionResult.responses?.[0]
    if (result?.error) throw new Error('The OCR provider could not process this scan.')
    const text = (result?.fullTextAnnotation?.text ?? '').slice(0, 100000)

    const { error: updateError } = await client.from('documents').update({
      ocr_status: 'completed',
      ocr_text: text,
      ocr_error: null,
      ocr_completed_at: new Date().toISOString(),
    }).eq('id', document.id)
    if (updateError) throw new Error('Extracted text could not be saved to the document record.')
    return response.status(200).json({ text })
  } catch {
    if (documentId) {
      await client.from('documents').update({
        ocr_status: 'failed',
        ocr_error: 'Text extraction did not complete. You can retry this document.',
      }).eq('id', documentId)
    }
    return response.status(500).json({ error: 'Document processing failed. Please retry or contact your administrator.' })
  }
}