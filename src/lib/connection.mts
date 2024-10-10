import _makeWASocket, { DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import path from 'path'
import pino from 'pino'
import pretty from 'pino-pretty'
import Store from '../store/store.mjs'
import Helper, { HelperConn } from './helper.mjs'
import Listeners from './listeners.mjs'
import { LOGGER } from './logger.mjs'
// @ts-ignore
const makeWASocket = _makeWASocket.default as typeof _makeWASocket

export const SESSIONS_FOLDER = './sessions'


export default class Connection {
    sock?: HelperConn | undefined
    store: Store
    listeners: Listeners | undefined
    logger: pino.Logger<pretty.PrettyStream>
    constructor() {
        this.logger = LOGGER.child({ class: 'baileys' })
        this.store = new Store('./store', this.logger)
        this.listeners = new Listeners(this as Required<Connection>)
    }
    async start () {
        const sessionFolder = path.join(SESSIONS_FOLDER)
        const { state, saveCreds } = await useMultiFileAuthState(sessionFolder)
        this.sock = Helper.connection(
            makeWASocket({
                auth: state,
                logger: this.logger,
                printQRInTerminal: true
            }),
            this.store
        )
        this.store.bind(this.sock.ev)
        this.sock.ev.process(async (events) => {
            if (events['connection.update']) {
                const { connection, lastDisconnect } = events['connection.update']

                if (connection === 'close') {
                    // reconnect if not logged out
                    if ((lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut) {
                        await this.start()
                    } else {
                        this.logger.info('Connection closed. You are logged out.')
                    }

                } else if (connection === 'open') {
                    this.logger.info('Opened connection...')
                }
            }

            if (events['creds.update']) await saveCreds()

            if (events['messages.upsert']) {
                this.listeners!.onMessage(events['messages.upsert'])
            }
            if (events['call']) {
                this.listeners!.onCall(events['call'])
            }
        })
    }
}