import { Context, Dict, Logger, Session, Time } from 'koishi'
import { Config } from './config'
import { checkAuth } from './utils'

declare module 'koishi' {
  interface Tables {
    schedule: Schedule
  }
}

export * from './config'
export interface Schedule {
  id: number
  assignee: string
  time: Date
  lastCall: Date
  interval: number
  command: string
  session: Session.Payload
}

const logger = new Logger('schedule')

export const name = 'schedule'
export const using = ['database'] as const

function toHourMinute(time: Date) {
  return `${Time.toDigits(time.getHours())}:${Time.toDigits(time.getMinutes())}`
}

export function apply(ctx: Context, config: Config) {
  ctx.i18n.define('zh', require('./locales/zh-CN'))

  function formatInterval(date: Date, interval: number, session: Session) {
    if (!interval) {
      return Time.template('yyyy-MM-dd hh:mm:ss', date)
    } else if (interval === Time.day) {
      return session.text('general.everyday', [toHourMinute(date)])
    } else if (interval === Time.week) {
      return session.text('general.everyweek', [
        session.text('general.days.' + date.getDay()),
        toHourMinute(date),
      ])
    } else {
      const now = Date.now()
      return session.text('general.interval', [
        interval,
        +date < now ? interval - (now - +date) % interval : +date - now,
      ])
    }
  }

  ctx.model.extend('schedule', {
    id: 'unsigned',
    assignee: 'string',
    time: 'timestamp',
    lastCall: 'timestamp',
    interval: 'integer',
    command: 'text',
    session: 'json',
  }, {
    autoInc: true,
  })

  async function hasSchedule(id: number) {
    const data = await ctx.database.get('schedule', [id])
    return data.length
  }

  async function prepareSchedule({ id, interval, command, time, lastCall }: Schedule, session: Session) {
    const now = Date.now()
    const date = time.valueOf()

    async function executeSchedule() {
      logger.debug('execute %d: %c', id, command)
      await session.execute(command)
      if (!lastCall || !interval) return
      lastCall = new Date()
      await ctx.database.set('schedule', id, { lastCall })
    }

    if (!interval) {
      if (date < now) {
        ctx.database.remove('schedule', [id])
        if (lastCall) executeSchedule()
        return
      }

      logger.debug('prepare %d: %c at %s', id, command, time)
      return ctx.setTimeout(async () => {
        if (!await hasSchedule(id)) return
        ctx.database.remove('schedule', [id])
        executeSchedule()
      }, date - now)
    }

    logger.debug('prepare %d: %c from %s every %s', id, command, time, Time.format(interval))
    const timeout = date < now ? interval - (now - date) % interval : date - now
    if (lastCall && timeout + now - interval > +lastCall) {
      executeSchedule()
    }

    ctx.setTimeout(async () => {
      if (!await hasSchedule(id)) return
      const dispose = ctx.setInterval(async () => {
        if (!await hasSchedule(id)) return dispose()
        executeSchedule()
      }, interval)
      executeSchedule()
    }, timeout)
  }

  ctx.on('ready', async () => {
    const data = await ctx.database.get('schedule', {})
    const schedules: Dict<Schedule[]> = {}

    data.forEach((schedule) => {
      const { session, assignee } = schedule
      const bot = ctx.bots[assignee]
      if (bot) {
        prepareSchedule(schedule, new Session(bot, session))
      } else {
        (schedules[assignee] ||= []).push(schedule)
      }
    })

    ctx.on('bot-status-updated', (bot) => {
      if (bot.status !== 'online') return
      const items = schedules[bot.sid]
      if (!items) return
      delete schedules[bot.sid]
      items.forEach((schedule) => {
        prepareSchedule(schedule, new Session(bot, schedule.session))
      })
    })

    Object.entries(config.customShotrtcut).forEach(([short, command]) => {
      cmd.shortcut(short, { args: [command] })
    })
  })

  const cmd = ctx.command('schedule [time]', { authority: config.authorityBasic, checkUnknown: true })
    .shortcut('lsschedule', { options: { list: true } })
    .shortcut('delschedule', { options: { delete: true } })
    .option('rest', '-- <command:text>')
    .option('interval', '/ <interval:string>', { authority: config.authorityInterval })
    .option('list', '-l')
    .option('ensure', '-e')
    .option('full', '-f', { authority: config.authorityFull })
    .option('delete', '-d <id>')
    .action(async ({ session, options }, ...dateSegments) => {
      if (options.delete) {
        await ctx.database.remove('schedule', [options.delete])
        return session.text('.delete-success', [options.delete])
      }

      if (options.list) {
        let schedules = await ctx.database.get('schedule', { assignee: [session.sid] })
        if (!options.full) {
          schedules = schedules.filter(s => session.channelId === s.session.channelId)
        }
        if (!schedules.length) return session.text('.list-empty')
        return schedules.map(({ id, time, interval, command, session: payload }) => {
          let output = `${id}. ${formatInterval(time, interval, session)}：${command}`
          if (options.full) {
            output += session.text('.context', [
              payload.isDirect
                ? session.text('.context.private', payload)
                : session.text('.context.guild', payload),
            ])
          }
          return output
        }).join('\n')
      }

      if (!options.rest) return session.text('.command-expected')

      const authCheckRes = await checkAuth(ctx, options.rest, session)
      if (authCheckRes) return authCheckRes

      const dateString = dateSegments.join('-')
      const time = Time.parseDate(dateString)
      const timestamp = +time
      if (Number.isNaN(timestamp) || timestamp > 2147483647000) {
        if (/^\d+$/.test(dateString)) {
          return session.text('.date-invalid-suggestion', [dateString])
        } else {
          return session.text('.date-invalid')
        }
      } else if (!options.interval) {
        if (!dateString) {
          return session.text('.date-expected')
        } else if (timestamp <= Date.now()) {
          return session.text('.date-past')
        }
      }

      const interval = Time.parseTime(options.interval)
      if (!interval && options.interval) {
        return session.text('.interval-invalid')
      } else if (interval && interval < config.minInterval) {
        return session.text('.interval-too-short')
      }

      const schedule = await ctx.database.create('schedule', {
        time,
        assignee: session.sid,
        interval,
        command: options.rest,
        session: session.toJSON(),
      })
      prepareSchedule(schedule, session)
      return session.text('.create-success', [schedule.id])
    })
}
