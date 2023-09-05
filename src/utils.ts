import { Argv, Context, Session } from 'koishi'

export function resolveCommand(argv: Argv, session: Session) {
  if (!session.inferCommand(argv)) return
  if (argv.tokens?.every(token => !token.inters.length)) {
    const { options, args, error } = argv.command.parse(argv)
    argv.options = { ...argv.options, ...options }
    argv.args = [...argv.args || [], ...args]
    argv.error = error
  }
  return argv.command
}

export async function checkAuth(ctx: Context, cmdWithOpt: string, session: Session): Promise<string> {
  const cmdStr = cmdWithOpt.split(' ')[0]
  const cmd = ctx.$commander.get(cmdStr)

  if (!cmd) {
    return session.text('.command-invalid')
  }
  if (cmd.config.authority > session.user.authority) {
    return session.text('internal.low-authority')
  }
  const argv = Argv.parse(cmdWithOpt)
  resolveCommand(argv, session)

  for (const opt of Object.keys(argv.options)) {
    if (cmd._options[opt]?.authority > session.user.authority) {
      return session.text('internal.low-authority')
    }
  }
  return ''
}
