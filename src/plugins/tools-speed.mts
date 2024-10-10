import { CommandablePlugin, PluginCmdParam } from '../lib/plugins.mjs'
import { cpus as _cpus, totalmem, freemem } from 'os'
import { sizeFormatter } from 'human-readable'

const format = sizeFormatter({
    std: 'JEDEC', // 'SI' (default) | 'IEC' | 'JEDEC'
    decimalPlaces: 2,
    keepTrailingZeroes: false,
    render: (literal, symbol) => `${literal} ${symbol}B`,
})

export default class speed implements CommandablePlugin {
    command = ['ping', 'speed']
    help = ['ping', 'speed']
    tags = ['tools']
    
    async onCommand ({ m }: PluginCmdParam) {
        const used = process.memoryUsage()
        const cpus = _cpus().map((cpu) => {
            const total = Object.keys(cpu.times).reduce((last, type) => last + cpu.times[type as keyof typeof cpu['times']], 0)
            return { ...cpu, total }
        })
        const cpu = cpus.reduce((last, cpu, _, { length }) => {
            last.total += cpu.total
            last.speed += cpu.speed / length
            last.times.user += cpu.times.user
            last.times.nice += cpu.times.nice
            last.times.sys += cpu.times.sys
            last.times.idle += cpu.times.idle
            last.times.irq += cpu.times.irq
            return last
        }, {
            speed: 0,
            total: 0,
            times: {
                user: 0,
                nice: 0,
                sys: 0,
                idle: 0,
                irq: 0
            }
        })

        const start = process.hrtime()
        const [_, latency] = process.hrtime(start)
        await m.reply(`
Responded in ${latency / 1000000} ms

_PC INFO_ ----
RAM: ${format(totalmem() - freemem())} / 64 GB 
CPU: Intel Core i9-14900K
SSD: 1.2TB / 2TB
GPU: GIGABYTE RTX4060 8GB

_PHONE INFO_
- Samsung Galaxy A32 5G
- Storage: 126GB / 128GB
`.trim())
    }

}