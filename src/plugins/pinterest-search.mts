import * as scraper from '@bochilteam/scraper'
import { HelperMsg } from '../lib/helper.mjs'
import { CommandablePlugin, MessageablePlugin, PluginCmdParam, PluginMsgParam } from '../lib/plugins.mjs'

export default class pinterest implements CommandablePlugin, MessageablePlugin {
    readonly ITERATION = 5
    readonly SID = Buffer.from('pins').toString('base64url')
    readonly MSG = {
        QUERY: `Please provide query for search image, reply to this message and type a query to search on Pinterest${readMore}\n\n_sid: ${this.SID}_`
    } as const
    readonly REPLY_REGEX = new RegExp(`_sid: ${this.SID}_`)

    command = /^pin(s|terest(search)?)$/
    help = 'pinterest <query>'
    tags = ['tools', 'downloader']

    async onMessage ({ m }: PluginMsgParam) {
        if (!m.quoted || !m.quoted.fromMe || !this.REPLY_REGEX.test(m.quoted.text)) return
        await this.search({ m, query: m.text })

    }

    async onCommand ({ m, text, usedPrefix, command }: PluginCmdParam) {
        if (!text)
            return await m.reply(`
_Use format ${usedPrefix}${command} <query>_
_Example ${usedPrefix}${command} P diddy pfp
_Or reply to this message and type a query to search on Pinterest_
`.trim())
        await this.search({ m, query: text })
    }

    async search ({ m, query }: { m: HelperMsg, query: string }) {
        if (!query)
            return await m.reply(this.MSG.QUERY)

        let i = 0
        const results = await scraper.pinterest(query)
        for (const url of results.reverse()) {
            await m.reply({ image: { url } })
            i++
            if (i >= this.ITERATION) break
        }
    }
}

const more = String.fromCharCode(8206)
const readMore = more.repeat(4001)