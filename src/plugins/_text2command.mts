import * as tf from '@tensorflow/tfjs-node'
import { BeforeableCommand, PluginBeforeCmdParam } from '../lib/plugins.mjs'
import model, { tokenizer, classes } from '../lib/classification.mjs'
import { MessageUpsertType, WAProto, areJidsSameUser, generateWAMessage } from '@whiskeysockets/baileys'

const MIN_OWNER_PREDICTION = .70
const MIN_USER_PREDICTION = .8

let prefix: string = '/'

export default class NLPClassification implements BeforeableCommand {
    disabled = false

    async beforeCommand ({ m, conn, isOwner, matchesPrefix, chatUpdate }: PluginBeforeCmdParam) {
        if (m.fromMe || m.isBaileys) return
        if (!m.text) return
        // Temporary only avaible text message
        if (m.mediaMessage) return
        // Ignore if reply message with sid
        if (/_sid: (.*?)/.test(m.quoted?.text || '')) return
        // Only not prefix message
        const usedPrefix = (matchesPrefix?.[0] || [])[0]
        if (usedPrefix) {
            prefix ||= usedPrefix
            return
        }

        const predicted: number[] = tf.tidy(() => {
            const query = tf.tensor(tokenizer.tokenize([m.text]))
            const prediction =  model.predict(query)
            // @ts-ignore
            return prediction.arraySync()[0]
        })
        const higest = Math.max(...predicted)
        const higestIndex = predicted.findIndex((v) => v === higest)
        console.log({ higest, higestIndex, class: classes[higestIndex], predicted })

        // the owner has a lower minimum score prediction
        if ((isOwner && higest < MIN_OWNER_PREDICTION)
            || higest < MIN_USER_PREDICTION) return

        let text = classes[higestIndex]
        // if it's classified as youtube, decide it's youtube downloader or youtube search
        if (text === 'youtube')
            text = this._handleYoutube(m.text) + ' ' + m.text
        // concat with prefix
        const command = prefix + text

        let messages = await generateWAMessage(m.chat, { text: command, mentions: m.mentionedJid }, {
            userJid: conn.user!.id,
            quoted: m.quoted?.fakeObj ?? undefined,
            upload: conn.waUploadToServer
        })
        messages.key.fromMe = areJidsSameUser(m.sender, conn.user!.id)
        messages.key.id = m.key.id
        messages.pushName = m.pushName
        messages.key.participant = messages.participant = m.sender
        let msg = {
            ...chatUpdate,
            messages: [WAProto.WebMessageInfo.fromObject(messages)],
            type: 'append' as MessageUpsertType
        }
        conn.ev.emit('messages.upsert', msg)
        
    }

    _handleYoutube (text: string): string {
        const isSearch = /search|cari(kan)?/im.test(text)
        return isSearch ? 'yts' : 'ytdl'
    }

    _verified (text: string, score: number): boolean {
        throw new Error('Method not implements.')
    }
}