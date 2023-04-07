import { spawn, type ChildProcessWithoutNullStreams } from 'child_process'
import { deepMergeObject, type MergeableRecord } from '../util/objects'

/**
 * Configuration of an {@link RShellSession} instance.
 * See {@link DEFAULT_R_SHELL_OPTIONS} for the default values used by {@link RShellSession}.
 */
export interface RShellOptions extends MergeableRecord {
  // TODO: maybe sanitizer in the future?
  readonly pathToRExecutable: string
  readonly commandLineOptions: readonly string[]
  readonly cwd: string
}

export const DEFAULT_R_SHELL_OPTIONS: RShellOptions = {
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

  public constructor (options?: Partial<RShellOptions>) {
    this.options = deepMergeObject(DEFAULT_R_SHELL_OPTIONS, options)

    // initialize the given session
    this.session = spawn(this.options.pathToRExecutable, this.options.commandLineOptions, {
      cwd: process.cwd(),
      windowsHide: true
    })

    this.setupRSession()
  }

  private setupRSession (): void {
    this.session.stdout.on('data', (data: string) => {
      console.log(`[got] ${data}`)
    })
    this.session.stderr.on('data', (data: string) => {
      console.error(`[err]: ${data}`)
    })
    this.session.on('close', (code: number) => {
      console.log(`child process exited with code ${code}`)
    })
  }

  /**
   * sends the given command directly to the current R session
   */
  public sendCommand (command: string): void {
    this.session.stdin.write(`${command}\n`)
  }

  /**
   * clears the R environment using the `rm` command.
   */
  public clearEnvironment (): void {
    this.sendCommand('rm(list=ls())')
  }
}
