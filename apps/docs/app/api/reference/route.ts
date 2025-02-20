import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { getFunctionsList } from '~/features/docs/Reference.generated.singleton'

const SUPPORTED_LIBRARIES = ['javascript', 'dart', 'kotlin', 'python'] as const

const requestBodySchema = z
  .object({
    library: z.enum(SUPPORTED_LIBRARIES),
    fields: z
      .string()
      .optional()
      .transform((val) => (val ? val.split(',').map((item) => item.trim()) : undefined)),
    method: z.string().optional(),
  })
  .strict()

export const GET = handleError(_handleReferenceRequest)

export async function _handleReferenceRequest(request: NextRequest) {
  let params = Object.fromEntries(request.nextUrl.searchParams.entries())

  let result: z.infer<typeof requestBodySchema>
  try {
    result = requestBodySchema.parse(params)
  } catch (error) {
    console.error(error)
    return new Response(
      `Malformed search params. Should have a "library" key specifying one of the supported libraries: ${SUPPORTED_LIBRARIES.join(', ')}.`,
      { status: 400 }
    )
  }

  let functionsList = await getFunctionsList(result.library, 'v2')

  if (result.method) {
    const method = functionsList.find(
      (func) =>
        // @ts-expect-error
        func.title === result.method ||
        // @ts-expect-error
        (func.title.endsWith('()') &&
          // @ts-expect-error
          func.title.substring(0, func.title.length - 2) === result.method)
    )
    return Response.json(method, { status: 200 })
  } else if (result.fields) {
    functionsList = functionsList.map((func) => {
      let new_ = { id: func.id } as any
      for (const field of result.fields) {
        new_[field] = func[field]
      }
      return new_
    })
  }

  return Response.json(functionsList, {
    status: 200,
  })
}

function handleError(handleRequest: (request: NextRequest) => Promise<Response>) {
  return async function (request: NextRequest) {
    try {
      const response = await handleRequest(request)
      return response
    } catch (error) {
      console.error(error)
      return new Response('Internal server error', { status: 500 })
    }
  }
}
