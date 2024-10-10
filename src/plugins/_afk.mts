import { users } from '../database/index.mjs'
import { MessageablePlugin, PluginMsgParam } from '../lib/plugins.mjs'

export default class _afk implements MessageablePlugin {
    async onMessage ({
        m
    }: PluginMsgParam) {
        const promises = []
        const user = await users.get(m.sender)
        if (user.afk > -1) {
            promises.push(m.reply(`
You stop AFK${user.afkReason ? ' after ' + user.afkReason : ''}
for ${(+new Date - user.afk).toTimeString()}
`.trim()))
            await users.update(m.sender, { afk: -1, afkReason: '' })
        }

        const jids = [...new Set([...(m.mentionedJid || []), ...(m.quoted ? [m.quoted.sender] : [])])]
        promises.push(...jids.map(async (jid) => {
            const user = await users.get(jid)
            const afkTime = user.afk
            if (afkTime < 0) return
            const reason = user.afkReason
            await m.reply(`
lmao they are AFK lol ${reason ? 'with reason ' + reason : 'for no fucking reason'}_
_for ${(+new Date - afkTime).toTimeString()}_
`.trim())
        }))

        await Promise.all(promises)
    }

}

