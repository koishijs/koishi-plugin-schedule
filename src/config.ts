import { Dict, Schema, Time } from 'koishi'

export interface AuthConfig {
  authorityBasic: number
  authorityInterval: number
  authorityFull: number
}

export interface CustomConfig {
  customShotrtcut: Dict<string, string>
}

export interface Config extends AuthConfig, CustomConfig {
  minInterval?: number
}

export const Config: Schema<Config> = Schema.intersect([
  Schema.object({
    authorityBasic: Schema.number().default(0).description('允许使用定时任务的权限等级'),
    authorityInterval: Schema.number().default(0).description('允许使用重复定时任务的权限等级'),
    authorityFull: Schema.number().default(0).description('允许查看所有定时任务的权限等级'),
  }).description('权限配置'),
  Schema.object({
    customShotrtcut: Schema.dict(String).role('table').description('自定义快捷指令，每行对应一个，格式和平时调用一样'),
  }).description('自定义快捷指令'),
  Schema.object({
    minInterval: Schema.natural().role('ms').description('允许的最小时间间隔').default(Time.minute),
  }).description('时间配置'),
])
