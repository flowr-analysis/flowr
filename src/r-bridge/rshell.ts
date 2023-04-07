import { spawn, type ChildProcessWithoutNullStreams } from 'child_process'
import { deepMergeObject, type MergeableRecord } from '../util/objects'
import { type ILogObj, Logger } from 'tslog'

/**
 * Configuration of an {@link RShellSession} instance.
 * See {@link DEFAULT_R_SHELL_OPTIONS} for the default values used by {@link RShellSession}.
 */
export interface RShellOptions extends MergeableRecord {
  readonly sessionName: string
  // TODO: maybe sanitizer in the future?
  readonly pathToRExecutable: string
  readonly commandLineOptions: readonly string[]
  readonly cwd: string
}

export const DEFAULT_R_SHELL_OPTIONS: RShellOptions = {
  sessionName: 'default',
  pathToRExecutable: 'R',
  commandLineOptions: ['--vanilla', '--no-echo'],
  cwd: process.cwd()
} as const

/**
 * RShell represents an interactive session with the R interpreter.
 * You can configure it by {@link RShellOptions}.
 */
export class RShellSession {
  private readonly options: RShellOptions
  private readonly session: ChildProcessWithoutNullStreams
  private readonly log: Logger<ILogObj>

  public constructor (options?: Partial<RShellOptions>) {
    this.options = deepMergeObject(DEFAULT_R_SHELL_OPTIONS, options)
    // TODO: allow to configure loggers more globally, bt right now i want to get this working
    this.log = new Logger({ name: this.options.sessionName, type: 'pretty' })

    // initialize the given session
    this.session = spawn(this.options.pathToRExecutable, this.options.commandLineOptions, {
      cwd: process.cwd(),
      windowsHide: true
    })

    this.setupRSessionLoggers()
  }

  private setupRSessionLoggers (): void {
    this.session.stdout.on('data', (data: string) => {
      this.log.info(`< ${data}`)
    })
    this.session.stderr.on('data', (data: string) => {
      this.log.error(`< ${data}`)
    })
    this.session.on('close', (code: number) => {
      this.log.info(`"${this.options.sessionName}" session exited with code ${code}`)
    })
  }

  /**
   * register a new handler to deal with data received from stdout
   */
  public onData (callback: (data: any) => void): void {
    this.session.stdout.on('data', data => { callback(data.toString()) })
  }

  /**
   * sends the given command directly to the current R session
   */
  public sendCommand (command: string): void {
    this.log.info(`> ${command}`)
    this.session.stdin.write(`${command}\n`)
  }

  /**
   * execute multiple commands in order
   *
   * @see sendCommand
   */
  public sendCommands (...commands: string[]): void {
    for (const element of commands) {
      this.sendCommand(element)
    }
  }

  /**
   * clears the R environment using the `rm` command.
   */
  public clearEnvironment (): void {
    this.sendCommand('rm(list=ls())')
  }

  /**
   * close the current R session, makes the object invalid (can no longer be reopened etc.)
   * TODO: find nice structure for this
   *
   * @return true if the kll succeeds, false otherwise
   */
  public close (): boolean {
    return this.session.kill()
  }
}
