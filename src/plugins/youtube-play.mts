import { CommandablePlugin, PluginCmdParam } from '../lib/plugins.mjs'
import { youtubeSearch } from '@bochilteam/scraper'
import got from 'got'

export default class play implements CommandablePlugin {
    readonly SID = Buffer.from('play').toString('base64url')
    readonly REPLY_REGEX = new RegExp(`_sid: ${this.SID}_`)

    command = 'play'
    help = 'play <query>'
    tags = ['youtube']

    async onCommand ({
        text,
        usedPrefix,
        command,
        m
    }: PluginCmdParam) {
        if (!text)
            return await m.reply(`
_Use format ${usedPrefix}${command} <query>_
_Example ${usedPrefix}${command} P Diddy_
_Or reply to this message and type a query to search on Youtube_
`.trim())

        let video: Awaited<ReturnType<typeof youtubeSearch>>['video'][number]
        for (let i = 0; i < 5; i++) {
            try {
                video = (await youtubeSearch(text)).video[0]
            } catch (e) {
                console.error(e)
            }
        }
        if (!video!)
            return await m.reply(`
_Video/audio not found! Please try again..._
`.trim())
        const { title, description, thumbnail, videoId, durationH, viewH, publishedTime } = video
        const url = 'https://www.youtube.com/watch?v=' + videoId
        await m.reply({
            caption: `
_📌 *Title:* ${title}_
_🔗 *Url:* ${url}_
_🖹 *Description:* ${description}_
_⏲️ *Published:* ${publishedTime}_
_⌚ *Duration:* ${durationH}_
_👁️ *Views:* ${viewH}_
`.trim(),
            image: { stream: got.stream(thumbnail, { responseType: 'buffer' }), }
        })
    }
}

const more = String.fromCharCode(8206)
const readMore = more.repeat(4001)