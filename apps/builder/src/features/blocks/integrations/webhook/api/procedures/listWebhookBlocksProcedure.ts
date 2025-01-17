import prisma from '@/lib/prisma'
import { canReadTypebots } from '@/utils/api/dbRules'
import { authenticatedProcedure } from '@/utils/server/trpc'
import { TRPCError } from '@trpc/server'
import { Group, Typebot, Webhook, WebhookBlock } from 'models'
import { byId, isWebhookBlock } from 'utils'
import { z } from 'zod'

export const listWebhookBlocksProcedure = authenticatedProcedure
  .meta({
    openapi: {
      method: 'GET',
      path: '/typebots/{typebotId}/webhookBlocks',
      protect: true,
      summary: 'List webhook blocks',
      description:
        'Returns a list of all the webhook blocks that you can subscribe to.',
      tags: ['Webhook'],
    },
  })
  .input(
    z.object({
      typebotId: z.string(),
    })
  )
  .output(
    z.object({
      webhookBlocks: z.array(
        z.object({
          id: z.string(),
          label: z.string(),
          url: z.string().optional(),
        })
      ),
    })
  )
  .query(async ({ input: { typebotId }, ctx: { user } }) => {
    const typebot = (await prisma.typebot.findFirst({
      where: canReadTypebots(typebotId, user),
      select: {
        groups: true,
        webhooks: true,
      },
    })) as (Pick<Typebot, 'groups'> & { webhooks: Webhook[] }) | null
    if (!typebot)
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Typebot not found' })

    const webhookBlocks = (typebot?.groups as Group[]).reduce<
      { id: string; label: string; url: string | undefined }[]
    >((webhookBlocks, group) => {
      const blocks = group.blocks.filter((block) =>
        isWebhookBlock(block)
      ) as WebhookBlock[]
      return [
        ...webhookBlocks,
        ...blocks.map((b) => ({
          id: b.id,
          label: `${group.title} > ${b.id}`,
          url: typebot?.webhooks.find(byId(b.webhookId))?.url ?? undefined,
        })),
      ]
    }, [])

    return { webhookBlocks }
  })
