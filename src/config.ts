import { Schema, Time } from 'koishi'

export interface Config {
  minInterval?: number
}

export const Config: Schema<Config> = Schema.object({
  minInterval: Schema.natural().role('ms').description('允许的最小时间间隔。').default(Time.minute),
})
