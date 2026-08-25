import { NextRequest, NextResponse } from 'next/server'
import { getZai } from '@/lib/zai'

/**
 * POST /api/asr — speech to text.
 * Multipart form-data with field `audio` (webm/wav/mp3 blob from the browser).
 * Header `x-learner-id` optional.
 *
 * Returns: { success: boolean, text: string }
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('audio')
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { success: false, text: '', error: 'Missing "audio" file in form data' },
        { status: 400 },
      )
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(new Uint8Array(arrayBuffer))
    const base64 = buffer.toString('base64')

    const zai = await getZai()
    const response: any = await zai.audio.asr.create({ file_base64: base64 })

    // The SDK returns the parsed JSON from /audio/asr. The text field may be
    // at response.text, response.result, or response.choices[0].message.content
    let text = ''
    if (typeof response === 'string') {
      text = response
    } else if (response?.text) {
      text = response.text
    } else if (response?.result) {
      text = response.result
    } else if (response?.choices?.[0]?.message?.content) {
      text = response.choices[0].message.content
    } else if (response?.data?.text) {
      text = response.data.text
    }

    return NextResponse.json({ success: true, text: text || '' })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'ASR failed'
    return NextResponse.json(
      { success: false, text: '', error: message },
      { status: 500 },
    )
  }
}
