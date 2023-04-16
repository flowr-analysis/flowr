import { spawn, type ChildProcessWithoutNullStreams } from 'child_process'
import { deepMergeObject, type MergeableRecord } from '../util/objects'
import { type ILogObj, type Logger } from 'tslog'
import { EOL } from 'os'
import * as readline from 'node:readline'
import { ts2r } from './lang/values'
import { log } from '../util/log'

export type OutputStreamSelector = 'stdout' | 'stderr' | 'both'
export type ExclusiveOutputStream = Exclude<OutputStreamSelector, 'both'>

interface CollectorTimeout extends MergeableRecord {
  /**
   * number of milliseconds to wait for the collection to finish
   */
  ms: number
  /**
   * if true, the timeout will reset whenever we receive new data
   */
  resetOnNewData: boolean
  // errorOnTimeout: boolean // TODO: maybe needed in the future as a "greedy" variant?
}

interface CollectorUntil extends MergeableRecord {
  predicate: (data: string) => boolean
  includeInResult: boolean
}

/**
 * Configuration for the internal output collector used by the {@link RShell}
 * The defaults are configured with {@link DEFAULT_OUTPUT_COLLECTOR_CONFIGURATION}
 */
interface OutputCollectorConfiguration extends MergeableRecord {
  /** the streams to use to collect the output from */
  from: OutputStreamSelector
  /**
   * a string marker to signal that the command was executed successfully.
   * must not appear as a standalone line in the output. this is our hacky way of ensuring that we are done.
   */
  postamble: string
  /** internal timeout configuration to use (see {@link CollectorTimeout}) */
  timeout: CollectorTimeout
  /** should the postamble be included in the result? */
  keepPostamble: boolean
  /** automatically trim all lines in the output (useful to ignore trailing whitespace etc.) */
  automaticallyTrimOutput: boolean
}

export const DEFAULT_OUTPUT_COLLECTOR_CONFIGURATION: OutputCollectorConfiguration = {
  from: 'stdout',
  postamble: `🐧${'-'.repeat(27)}🐧`,
  timeout: {
    // TODO: allow to configure such things in a configuration file?
    ms: 10_000,
    resetOnNewData: true
  },
  keepPostamble: false,
  automaticallyTrimOutput: true
}
// TODO: doc
export interface RShellSessionOptions extends MergeableRecord {
  readonly pathToRExecutable: string
  readonly commandLineOptions: readonly string[]
  readonly cwd: string
  readonly eol: string
  readonly env: NodeJS.ProcessEnv
}

/**
 * Configuration of an {@link RShell} instance.
 * See {@link DEFAULT_R_SHELL_OPTIONS} for the default values used by {@link RShell}.
 */
export interface RShellOptions extends RShellSessionOptions {
  readonly sessionName: string
  // TODO: maybe sanitizer in the future?
}

export const DEFAULT_R_SHELL_OPTIONS: RShellOptions = {
  sessionName: 'default',
  pathToRExecutable: 'R',
  commandLineOptions: ['--vanilla', '--quiet', '--no-echo', '--no-save'],
  cwd: process.cwd(),
  env: process.env,
  eol: EOL
} as const

/**
 * RShell represents an interactive session with the R interpreter.
 * You can configure it by {@link RShellOptions}.
 *
 * At the moment we are using a live R session (and not networking etc.) to communicate with R easily,
 * which allows us to install packages etc. However, this might and probably will change in the future (leaving this
 * as a legacy mode :D)
 * TODO: in the future real language bindings like rpy2? but for ts?
 */
export class RShell {
  // TODO: deep readonly?
  public readonly options: Readonly<RShellOptions>
  public readonly session: RShellSession
  private readonly log: Logger<ILogObj>

  public constructor(options?: Partial<RShellOptions>) {
    this.options = deepMergeObject(DEFAULT_R_SHELL_OPTIONS, options)
    this.log = log.getSubLogger({ name: this.options.sessionName })

    this.session = new RShellSession(this.options, this.log)
  }

  private _sendCommand(command: string): void {
    this.session.writeLine(command)
  }

  /**
   * sends the given command directly to the current R session
   * will not do anything to alter input markers!
   */
  // TODO: rename to execute or so?
  public sendCommand(command: string): void {
    this.log.trace(`> ${command}`)
    this._sendCommand(command)
  }

  // TODO: general varRead which uses r to serialize
  /**
   * Send a command and collect the output
   *
   * @param command     the R command to execute (similar to {@link sendCommand})
   * @param addonConfig further configuration on how and what to collect: see {@link OutputCollectorConfiguration},
   *                    defaults are set in {@link DEFAULT_OUTPUT_COLLECTOR_CONFIGURATION}
   */
  public async sendCommandWithOutput(command: string, addonConfig?: Partial<OutputCollectorConfiguration>): Promise<string[]> {
    const config = deepMergeObject(DEFAULT_OUTPUT_COLLECTOR_CONFIGURATION, addonConfig)
    this.log.trace(`> ${command}`)
    const output = await this.session.collectLinesUntil(config.from, {
      predicate: data => data === config.postamble,
      includeInResult: config.keepPostamble // we do not want the postamble
    }, config.timeout, () => {
      this._sendCommand(command)
      // TODO: in the future use sync redirect? or pipes with automatic wrapping?
      if (config.from === 'stderr') {
        this._sendCommand(`cat("${config.postamble}${this.options.eol}", file=stderr())`)
      } else {
        this._sendCommand(`cat("${config.postamble}${this.options.eol}")`)
      }
    })
    if (config.automaticallyTrimOutput) {
      return output.map(line => line.trim())
    } else {
      return output
    }
  }

  /**
   * execute multiple commands in order
   *
   * @see sendCommand
   */
  public sendCommands(...commands: string[]): void {
    for (const element of commands) {
      this.sendCommand(element)
    }
  }

  /**
   * clears the R environment using the `rm` command.
   */
  public clearEnvironment(): void {
    this.log.debug('clearing environment')
    this._sendCommand('rm(list=ls())')
  }

  /**
   * usually R will stop execution on errors, with this the R session will try to
   * continue working!
   */
  public continueOnError(): void {
    this.log.info('continue in case of Errors')
    this._sendCommand('options(error=function() {})')
  }

  public injectLibPaths(...paths: string[]): void {
    this.log.debug(`injecting lib paths ${JSON.stringify(paths)}`)
    this._sendCommand(`.libPaths(c(.libPaths(), ${paths.map(ts2r).join(',')}))`)
  }

  // TODO: this is really hacky
  public tryToInjectHomeLibPath(): void {
    this.injectLibPaths('~/.r-libs')
  }

  /**
   * checks if a given package is already installed on the system!
   */
  public async isPackageInstalled(packageName: string): Promise<boolean> {
    this.log.debug(`checking if package "${packageName}" is installed`)
    const result = await this.sendCommandWithOutput(
      `cat(paste0(is.element("${packageName}", installed.packages()[,1])),"${this.options.eol}")`)
    return result.length === 1 && result[0] === ts2r(true)
  }

  public async allInstalledPackages(): Promise<string[]> {
    this.log.debug('getting all installed packages')
    const [packages] = await this.sendCommandWithOutput(`cat(paste0(installed.packages()[,1], collapse=","),"${this.options.eol}")`)
    return packages.split(',')
  }

  // TODO: allow to configure repos etc.
  // TODO: parser for errors
  // TODO: bioconductor support?
  /**
   * installs the package using a temporary location
   *
   * @param packageName the package to install
   * @param autoload    if true, the package will be loaded after installation
   * @param force       if true, the package will be installed no if it is already on the system and ready to be loaded
   */
  public async ensurePackageInstalled(packageName: string, autoload = false, force = false): Promise<{
    packageName: string
    packageExistedAlready: boolean
    /** the temporary directory used for the installation, undefined if none was used */
    libraryLocation?: string
  }> {
    const packageExistedAlready = await this.isPackageInstalled(packageName)
    if (!force && packageExistedAlready) {
      this.log.info(`package "${packageName}" is already installed`)
      if (autoload) {
        this.sendCommand(`library(${ts2r(packageName)})`)
      }
      return { packageName, packageExistedAlready: true }
    }

    // obtain a temporary directory
    this.sendCommand('temp <- tempdir()')
    const [tempdir] = await this.sendCommandWithOutput(`cat(temp, ${ts2r(this.options.eol)})`)

    this.log.debug(`using temporary directory: "${tempdir}" to install package "${packageName}"`)

    const successfulDone = new RegExp(`.*DONE *\\(${packageName}\\)`)

    await this.session.collectLinesUntil('both', {
      predicate: data => successfulDone.test(data),
      includeInResult: false
    }, {
      ms: 10_000,
      resetOnNewData: true
    }, () => {
      // the else branch is a cheesy way to work even if the package is already installed!
      this.sendCommand(`install.packages(${ts2r(packageName)},repos="http://cran.us.r-project.org", quiet=FALSE, lib=temp)`)
    })
    if (autoload) {
      this.sendCommand(`library(${ts2r(packageName)}, lib.loc=${ts2r(tempdir)})`)
    }
    return { packageName, libraryLocation: tempdir, packageExistedAlready }
  }

  /**
   * close the current R session, makes the object effectively invalid (can no longer be reopened etc.)
   *
   * @return true if the operation succeeds, false otherwise
   */
  public close(): boolean {
    return this.session.end()
  }
}

/**
 * used to deal with the underlying input-output streams of the R process
 */
class RShellSession {
  private readonly bareSession: ChildProcessWithoutNullStreams
  private readonly sessionStdOut: readline.Interface
  private readonly sessionStdErr: readline.Interface
  private readonly options: RShellSessionOptions
  private readonly log: Logger<ILogObj>

  public constructor(options: RShellSessionOptions, log: Logger<ILogObj>) {
    this.bareSession = spawn(options.pathToRExecutable, options.commandLineOptions, {
      env: options.env,
      cwd: options.cwd,
      windowsHide: true
    })
    this.sessionStdOut = readline.createInterface({ input: this.bareSession.stdout, terminal: false })
    this.sessionStdErr = readline.createInterface({ input: this.bareSession.stderr, terminal: false })
    this.options = options
    this.log = log
    this.setupRSessionLoggers()
  }

  private setupRSessionLoggers(): void {
    this.bareSession.stdout.on('data', (data: Buffer) => {
      this.log.trace(`< ${data.toString()}`)
    })
    this.bareSession.stderr.on('data', (data: string) => {
      this.log.warn(`< ${data}`)
    })
    this.bareSession.on('close', (code: number) => {
      this.log.trace(`session exited with code ${code}`)
    })
  }

  public write(data: string): void {
    this.bareSession.stdin.write(data)
  }

  public writeLine(data: string): void {
    this.write(`${data}${this.options.eol}`)
  }

  private on(from: OutputStreamSelector, event: string, listener: (...data: any[]) => void): void {
    const both = from === 'both'
    if (both || from === 'stdout') {
      this.sessionStdOut.on(event, listener)
    }
    if (both || from === 'stderr') {
      this.sessionStdErr.on(event, listener)
    }
  }

  private removeListener(from: OutputStreamSelector, event: string, listener: (...data: any[]) => void): void {
    const both = from === 'both'
    if (both || from === 'stdout') {
      this.sessionStdOut.removeListener(event, listener)
    }
    if (both || from === 'stderr') {
      this.sessionStdErr.removeListener(event, listener)
    }
  }

  /**
   * collect lines from the selected streams until the given condition is met or the timeout is reached
   *
   * this method does allow other listeners to consume the same input
   *
   * @from the stream(s) to collect the information from
   * @until if the predicate returns true, this will stop the collection and resolve the promise
   * @timeout configuration for how and when to timeout
   * @action event to be performed after all listeners are installed, this might be the action that triggers the output you want to collect
   */
  public async collectLinesUntil(from: OutputStreamSelector, until: CollectorUntil, timeout: CollectorTimeout, action?: () => void): Promise<string[]> {
    const result: string[] = []
    let handler: (data: string) => void

    return await new Promise<string[]>((resolve, reject) => {
      const makeTimer = (): NodeJS.Timeout => setTimeout(() => { reject(new Error(`timeout of ${timeout.ms}ms reached (${JSON.stringify(result)})`)) }, timeout.ms)
      let timer = makeTimer()

      handler = (data: string): void => {
        const end = until.predicate(data)
        if (!end || until.includeInResult) {
          result.push(data)
        }
        if (end) {
          clearTimeout(timer)
          resolve(result)
        } else if (timeout.resetOnNewData) {
          clearTimeout(timer)
          timer = makeTimer()
        }
      }
      this.on(from, 'line', handler)
      action?.()
    }).finally(() => {
      this.removeListener(from, 'line', handler)
    })
  }

  /**
   * close the current R session, makes the object effectively invalid (can no longer be reopened etc.)
   * TODO: find nice structure for this
   *
   * @return true if the kill succeeds, false otherwise
   * @see RShell#close
   */
  end(): boolean {
    return this.bareSession.kill()
  }
}
