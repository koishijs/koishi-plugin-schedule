import { Schema, Time } from 'koishi'

export interface Config {
  authorityBasic: number
  authorityInterval: number
  authorityFull: number
  minInterval?: number
}

export const Config: Schema<Config> = Schema.object({
  authorityBasic: Schema.number().default(0).description('允许使用定时任务的权限等级。'),
  authorityInterval: Schema.number().default(0).description('允许使用重复定时任务的权限等级。'),
  authorityFull: Schema.number().default(0).description('允许查看所有定时任务的权限等级。'),
  minInterval: Schema.natural().role('ms').description('允许的最小时间间隔。').default(Time.minute),
})
