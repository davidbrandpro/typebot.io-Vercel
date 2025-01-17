import { getTypebot } from '@/features/typebot/api/utils/getTypebot'
import { authenticatedProcedure } from '@/utils/server/trpc'
import { TRPCError } from '@trpc/server'
import { Typebot } from 'models'
import { z } from 'zod'
import { archiveResults } from '../archiveResults'

export const deleteResultsProcedure = authenticatedProcedure
  .meta({
    openapi: {
      method: 'DELETE',
      path: '/typebots/{typebotId}/results',
      protect: true,
      summary: 'Delete results',
      tags: ['Results'],
    },
  })
  .input(
    z.object({
      typebotId: z.string(),
      resultIds: z
        .string()
        .describe(
          'Comma separated list of ids. If not provided, all results will be deleted. ⚠️'
        )
        .optional(),
    })
  )
  .output(z.void())
  .mutation(async ({ input, ctx: { user } }) => {
    const idsArray = input.resultIds?.split(',')
    const { typebotId } = input
    const typebot = (await getTypebot({
      accessLevel: 'write',
      typebotId,
      user,
      select: {
        groups: true,
      },
    })) as Pick<Typebot, 'groups'> | null
    if (!typebot)
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Typebot not found' })
    const { success } = await archiveResults({
      typebot,
      resultsFilter: {
        id: (idsArray?.length ?? 0) > 0 ? { in: idsArray } : undefined,
        typebotId,
      },
    })

    if (!success)
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Typebot not found',
      })
  })
