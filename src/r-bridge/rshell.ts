import { spawn, type ChildProcessWithoutNullStreams } from 'child_process'
import * as path from 'node:path'

/**
 * Configuration of an {@link RShellSession} instance.
 */
export interface RShellOptions {
  readonly pathToRExecutable: path.ParsedPath
  /** passed along to the {@link RShellOptions#pathToRExecutable pathToRExecutable} as command line options. */
  readonly commandLineOptions: readonly string[]
  readonly cwd: string
}

export const DEFAULT_R_SHELL_OPTIONS: RShellOptions = {
  pathToRExecutable: path.parse('R'),
  commandLineOptions: ['--vanilla', '--no-echo'],
  cwd: process.cwd()
} as const

/**
 * RShell represents an interactive session with the R interpreter.
 * You can configure it by {@link RShellOptions}.
 */
export class RShellSession {
  private readonly pathToRExecutable: string
  private readonly session: ChildProcessWithoutNullStreams

  /**
   *
   * @param pathToRExecutable
   */
  public constructor (pathToRExecutable = 'R') {
    this.pathToRExecutable = pathToRExecutable

    // initialize the given session
    this.session = spawn(this.pathToRExecutable, ['--vanilla', '--no-echo'], {
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
