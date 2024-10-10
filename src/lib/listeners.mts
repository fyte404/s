import { areJidsSameUser, BaileysEventMap, jidNormalizedUser } from '@whiskeysockets/baileys'
import { users } from '../database/index.mjs'
import { conn as _connection, config, plugin, PREFIX } from '../index.mjs'
import CommandManager from './command.mjs'
import Connection from './connection.mjs'
import Helper from './helper.mjs'
import PermissionManager, { PermissionsFlags } from './permissions.mjs'
import { PluginBeforeCmdParam, PluginCmdParam, PluginMsgParam } from './plugins.mjs'
import Print from './print.mjs'

export default class Listeners {
    constructor(public connection: Required<Connection>) { }

    async onMessage (chatUpdate: BaileysEventMap['messages.upsert']) {
        // if (chatUpdate.messages.length > 1) {
        //     console.log('Type', chatUpdate.type)
        //     for (const message of chatUpdate.messages) {
        //         console.log(message)
        //     }
        // }
        // last message
        const m = Helper.message(chatUpdate.messages[chatUpdate.messages.length - 1], {
            conn: this.connection.sock,
            logger: this.connection.logger
        })

        try {
            if (typeof m.text !== 'string') return

            const groupMetadata = m.isGroup ?
                await this.connection.store.fetchGroupMetadata(m.chat, this.connection.sock.groupMetadata)
                : undefined
            const participants = m.isGroup ?
                groupMetadata!.participants
                : []
            const isAdmin = !!(m.isGroup &&
                participants.find(({ id }) => areJidsSameUser(id, m.sender))?.admin?.includes('admin'))
            const isBotAdmin = !!(m.isGroup &&
                participants.find(({ id }) => areJidsSameUser(id, this.connection.sock.user?.id))?.admin?.includes('admin'))
            const isOwner = ([...config.owners.map(({ number }) => number), _connection.sock?.user?.id]
                .filter(Boolean) as string[])
                .map((owner) => jidNormalizedUser(!owner.includes('@s.whatsapp.net') ? owner.concat('@s.whatsapp.net') : owner))
                .includes(m.sender)

            const { permission, banned, registered } = await users.get(m.sender)
            const permissionManager = new PermissionManager({
                permission,
                isAdmin,
                isBotAdmin,
                isOwner,
                banned,
                registered
            })

            for (const [pluginName, pluginModule] of plugin.plugins.entries()) {
                if (pluginModule.disabled) continue

                // Messageable Plugin
                if ('onMessage' in pluginModule && typeof pluginModule.onMessage === 'function') {
                    await pluginModule.onMessage({
                        chatUpdate,
                        connection: this.connection,
                        conn: this.connection.sock,
                        m,

                        permissionManager,
                        groupMetadata,
                        participants,
                        isOwner,
                        isAdmin,
                        isBotAdmin
                    } satisfies PluginMsgParam)
                }

                const commandManager = new CommandManager(PREFIX)
                const matchesPrefix = commandManager.matchesPrefix(m.text)

                if ('beforeCommand' in pluginModule && typeof pluginModule.beforeCommand === 'function') {
                    await pluginModule.beforeCommand({
                        chatUpdate,
                        connection: this.connection,
                        conn: this.connection.sock,
                        m,

                        commandManager,
                        matchesPrefix,

                        permissionManager,
                        groupMetadata,
                        participants,
                        isOwner,
                        isAdmin,
                        isBotAdmin
                    } satisfies PluginBeforeCmdParam)
                }

                // Non Commandable Plugin will be skip
                if (!('onCommand' in pluginModule) || typeof pluginModule.onCommand !== 'function') continue

                commandManager.setPrefix(pluginModule.customPrefix ? pluginModule.customPrefix : PREFIX)
                commandManager.setCommand(pluginModule.command)
                const isAccept = commandManager.isCommand(m.text)
                if (isAccept === false || m.isBaileys)
                    continue
                const {
                    command,
                    text,
                    args,
                    usedPrefix,
                    noPrefix
                } = isAccept

                // Check permissions
                if (pluginModule.permissions) {
                    const isAccessGranted = permissionManager.check(pluginModule.permissions)
                    if (isAccessGranted !== true) {
                        await Promise.all([
                            m.reply(`Access not granted because invalid permissions *${isAccessGranted.map((permission) => PermissionsFlags[permission]).join(', ')}*`),
                            isAccessGranted.includes(PermissionsFlags.Register) ? m.reply(`To register type *${usedPrefix}register*`) : Promise.resolve()
                        ])
                        continue
                    }
                }

                // Some injections :v
                m.isCommand = true
                m.plugin = pluginName

                const param = {
                    connection: this.connection,
                    conn: this.connection.sock,
                    m,

                    commandManager,
                    command,
                    text,
                    args,
                    usedPrefix,
                    noPrefix,

                    permissionManager,
                    groupMetadata,
                    participants,
                    isOwner,
                    isAdmin,
                    isBotAdmin
                } satisfies PluginCmdParam

                await pluginModule.onCommand(param)
            }

        } catch (e) {
            this.connection.logger.error({
                stack: (e as Error).stack,
                // @ts-ignore
                code: e.code,
                m,
                quoted: m.quoted
            }, typeof e === 'string' ? e : (e as Error).message)
            if ((e as Error).name) {
                // await m.reply(util.format(e))
                await m.reply(`Error occurred!`)
            }
            if (e) m.error = e as Error
        } finally {
            try {
                await new Print(this.connection.sock, this.connection.store).print(m)
            } catch (e) {
                this.connection.logger.error({
                    stack: (e as Error).stack,
                    // @ts-ignore
                    code: e.code,
                    m,
                    quoted: m.quoted
                }, (e as Error).message)
            }
        }
    }

    async onCall (calls: BaileysEventMap['call']) {
        await Promise.all(calls.map((call) => {
            if (call.status !== 'ringing') return
            return this.connection.sock.rejectCall(call.id, call.from)
        }))
    }
}