import { type ChildProcessWithoutNullStreams, spawn } from "child_process"
import { deepMergeObject, type MergeableRecord } from "../util/objects"
import { type ILogObj, type Logger } from "tslog"
import { EOL } from "os"
import * as readline from "node:readline"
import { ts2r } from './lang-4.x'
import { log, LogLevel } from '../util/log'
import { SemVer } from 'semver'
import semver from 'semver/preload'
import { getPlatform } from '../util/os'

export type OutputStreamSelector = "stdout" | "stderr" | "both";

export interface CollectorTimeout extends MergeableRecord {
	/**
   * number of milliseconds to wait for the collection to finish
   */
	ms:             number
	/**
   * if true, the timeout will reset whenever we receive new data
   */
	resetOnNewData: boolean
}

interface CollectorUntil extends MergeableRecord {
	predicate:       (data: string) => boolean
	includeInResult: boolean
}

/**
 * Configuration for the internal output collector used by the {@link RShell}
 * The defaults are configured with {@link DEFAULT_OUTPUT_COLLECTOR_CONFIGURATION}
 */
export interface OutputCollectorConfiguration extends MergeableRecord {
	/** the streams to use to collect the output from */
	from:                    OutputStreamSelector
	/**
   * a string marker to signal that the command was executed successfully.
   * must not appear as a standalone line in the output. this is our hacky way of ensuring that we are done.
   */
	postamble:               string
	/** internal timeout configuration to use (see {@link CollectorTimeout}) */
	timeout:                 CollectorTimeout
	/** should the postamble be included in the result? */
	keepPostamble:           boolean
	/** automatically trim all lines in the output (useful to ignore trailing whitespace etc.) */
	automaticallyTrimOutput: boolean
}

export const DEFAULT_OUTPUT_COLLECTOR_CONFIGURATION: OutputCollectorConfiguration = {
	from:      'stdout',
	postamble: `🐧${'-'.repeat(5)}🐧`,
	timeout:   {
		ms:             750_000,
		resetOnNewData: true
	},
	keepPostamble:           false,
	automaticallyTrimOutput: true,
	errorStopsWaiting:       true
}

export interface RShellSessionOptions extends MergeableRecord {
	readonly pathToRExecutable:  string
	readonly commandLineOptions: readonly string[]
	readonly cwd:                string
	readonly eol:                string
	readonly env:                NodeJS.ProcessEnv
	/** If set, the R session will be restarted if it exits due to an error */
	readonly revive:             'never' | 'on-error' | 'always'
	/** Called when the R session is restarted, this makes only sense if `revive` is not set to `'never'` */
	readonly onRevive:           (code: number, signal: string | null) => void
	/** The path to the library directory */
	readonly homeLibPath:        string
}

/**
 * Configuration of an {@link RShell} instance.
 * See {@link DEFAULT_R_SHELL_OPTIONS} for the default values used by {@link RShell}.
 */
export interface RShellOptions extends RShellSessionOptions {
	readonly sessionName: string
}

export const DEFAULT_R_SHELL_OPTIONS: RShellOptions = {
	sessionName:        'default',
	pathToRExecutable:  getPlatform() === 'windows' ? 'R.exe' : 'R',
	commandLineOptions: ['--vanilla', '--quiet', '--no-echo', '--no-save'],
	cwd:                process.cwd(),
	env:                process.env,
	eol:                EOL,
	homeLibPath:        getPlatform() === 'windows' ? 'C:/R/library' : '~/.r-libs',
	revive:             'never',
	onRevive:           () => { /* do nothing */ }
} as const

/**
 * RShell represents an interactive session with the R interpreter.
 * You can configure it by {@link RShellOptions}.
 *
 * At the moment we are using a live R session (and not networking etc.) to communicate with R easily,
 * which allows us to install packages etc. However, this might and probably will change in the future (leaving this
 * as a legacy mode :D)
 */
export class RShell {
	public readonly options: Readonly<RShellOptions>
	private session:         RShellSession
	private readonly log:    Logger<ILogObj>
	private version:         SemVer | null = null

	public constructor(options?: Partial<RShellOptions>) {
		this.options = deepMergeObject(DEFAULT_R_SHELL_OPTIONS, options)
		this.log = log.getSubLogger({ name: this.options.sessionName })
		if(this.log.settings.minLevel >= LogLevel.Debug) {
			this.log.debug(`Running with options: ${JSON.stringify(this.options)}`)
		}

		this.session = new RShellSession(this.options, this.log)
		this.revive()
	}

	private revive() {
		if(this.options.revive === 'never') {
			return
		}

		this.session.onExit((code, signal) => {
			if(this.options.revive === 'always' || (this.options.revive === 'on-error' && code !== 0)) {
				this.log.warn(`R session exited with code ${code}, reviving!`)
				this.options.onRevive(code, signal)
				this.session = new RShellSession(this.options, this.log)
				this.revive()
			}
		})
	}

	/**
   * sends the given command directly to the current R session
   * will not do anything to alter input markers!
   */
	public sendCommand(command: string): void {
		if(this.log.settings.minLevel >= LogLevel.Trace) {
			this.log.trace(`> ${JSON.stringify(command)}`)
		}
		this._sendCommand(command)
	}

	public async usedRVersion(): Promise<SemVer | null> {
		if(this.version !== null) {
			return this.version
		}
		// retrieve raw version:
		const result = await this.sendCommandWithOutput(`cat(paste0(R.version$major,".",R.version$minor), ${ts2r(this.options.eol)})`)
		this.log.trace(`raw version: ${JSON.stringify(result)}`)
		this.version = semver.coerce(result[0])
		return result.length === 1 ? this.version : null
	}

	/**
   * Send a command and collect the output
   *
   * @param command     - the R command to execute (similar to {@link sendCommand})
   * @param addonConfig - further configuration on how and what to collect: see {@link OutputCollectorConfiguration},
   *                      defaults are set in {@link DEFAULT_OUTPUT_COLLECTOR_CONFIGURATION}
   */
	public async sendCommandWithOutput(command: string, addonConfig?: Partial<OutputCollectorConfiguration>): Promise<string[]> {
		const config = deepMergeObject(DEFAULT_OUTPUT_COLLECTOR_CONFIGURATION, addonConfig)
		if(this.log.settings.minLevel >= LogLevel.Trace) {
			this.log.trace(`> ${JSON.stringify(command)}`)
		}

		const output = await this.session.collectLinesUntil(config.from, {
			predicate:       data => data === config.postamble,
			includeInResult: config.keepPostamble // we do not want the postamble
		}, config.timeout, () => {
			this._sendCommand(command)
			if(config.from === 'stderr') {
				this._sendCommand(`cat("${config.postamble}${this.options.eol}", file=stderr())`)
			} else {
				this._sendCommand(`cat("${config.postamble}${this.options.eol}")`)
			}
		})
		if(config.automaticallyTrimOutput) {
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
		for(const element of commands) {
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

	public tryToInjectHomeLibPath(): void {
		this.injectLibPaths(this.options.homeLibPath)
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

	/**
   * Installs the package using a temporary location
   *
   * @param packageName - The package to install
   * @param autoload    - If true, the package will be loaded after installation
   * @param force       - If true, the package will be installed no if it is already on the system and ready to be loaded
   */
	public async ensurePackageInstalled(packageName: string, autoload = false, force = false): Promise<{
		packageName:           string
		packageExistedAlready: boolean
		/** the temporary directory used for the installation, undefined if none was used */
		libraryLocation?:      string
	}> {
		const packageExistedAlready = await this.isPackageInstalled(packageName)
		if(!force && packageExistedAlready) {
			this.log.info(`package "${packageName}" is already installed`)
			if(autoload) {
				this.sendCommand(`library(${ts2r(packageName)})`)
			}
			return {
				packageName,
				packageExistedAlready: true
			}
		}

		// obtain a temporary directory
		this.sendCommand('temp <- tempdir()')
		const [tempdir] = await this.sendCommandWithOutput(`cat(temp, ${ts2r(this.options.eol)})`)

		this.log.debug(`using temporary directory: "${tempdir}" to install package "${packageName}"`)

		const successfulDone = new RegExp(`.*DONE *\\(${packageName}\\)`)

		await this.session.collectLinesUntil('both', {
			predicate:       data => successfulDone.test(data),
			includeInResult: false
		}, {
			ms:             750_000,
			resetOnNewData: true
		}, () => {
			// the else branch is a cheesy way to work even if the package is already installed!
			this.sendCommand(`install.packages(${ts2r(packageName)},repos="https://cloud.r-project.org/", quiet=FALSE, lib=temp)`)
		})
		if(autoload) {
			this.sendCommand(`library(${ts2r(packageName)}, lib.loc=${ts2r(tempdir)})`)
		}
		return {
			packageName,
			libraryLocation: tempdir,
			packageExistedAlready
		}
	}

	/**
   * Close the current R session, makes the object effectively invalid (can no longer be reopened etc.)
   *
   * @returns true if the operation succeeds, false otherwise
   */
	public close(): boolean {
		return this.session.end()
	}

	private _sendCommand(command: string): void {
		this.session.writeLine(command)
	}
}

/**
 * Used to deal with the underlying input-output streams of the R process
 */
class RShellSession {
	private readonly bareSession:   ChildProcessWithoutNullStreams
	private readonly sessionStdOut: readline.Interface
	private readonly sessionStdErr: readline.Interface
	private readonly options:       RShellSessionOptions
	private readonly log:           Logger<ILogObj>
	private collectionTimeout:      NodeJS.Timeout | undefined

	public constructor(options: RShellSessionOptions, log: Logger<ILogObj>) {
		this.bareSession = spawn(options.pathToRExecutable, options.commandLineOptions, {
			env:         options.env,
			cwd:         options.cwd,
			windowsHide: true
		})
		this.sessionStdOut = readline.createInterface({
			input:    this.bareSession.stdout,
			terminal: false
		})
		this.sessionStdErr = readline.createInterface({
			input:    this.bareSession.stderr,
			terminal: false
		})
		this.onExit(() => { this.end() })
		this.options = options
		this.log = log
		this.setupRSessionLoggers()
	}

	public write(data: string): void {
		this.bareSession.stdin.write(data)
	}

	public writeLine(data: string): void {
		this.write(`${data}${this.options.eol}`)
	}

	/**
   * Collect lines from the selected streams until the given condition is met or the timeout is reached
   *
   * This method does allow other listeners to consume the same input
   *
   * @param from        - The stream(s) to collect the information from
   * @param until       - If the predicate returns true, this will stop the collection and resolve the promise
   * @param timeout     - Configuration for how and when to timeout
   * @param action      - Event to be performed after all listeners are installed, this might be the action that triggers the output you want to collect
   */
	public async collectLinesUntil(from: OutputStreamSelector, until: CollectorUntil, timeout: CollectorTimeout, action?: () => void): Promise<string[]> {
		const result: string[] = []
		let handler: (data: string) => void
		let error: (code: number) => void

		return await new Promise<string[]>((resolve, reject) => {
			const makeTimer = (): NodeJS.Timeout => setTimeout(() => {
				reject(new Error(`timeout of ${timeout.ms}ms reached (${JSON.stringify(result)})`))
			}, timeout.ms)
			this.collectionTimeout = makeTimer()

			handler = (data: string): void => {
				const end = until.predicate(data)
				if(!end || until.includeInResult) {
					result.push(data)
				}
				if(end) {
					clearTimeout(this.collectionTimeout)
					resolve(result)
				} else if(timeout.resetOnNewData) {
					clearTimeout(this.collectionTimeout)
					this.collectionTimeout = makeTimer()
				}
			}

			error = () => { resolve(result) }
			this.onExit(error)
			this.on(from, 'line', handler)
			action?.()
		}).finally(() => {
			this.removeListener(from, 'line', handler)
			this.bareSession.removeListener('exit', error)
		})
	}

	/**
   * close the current R session, makes the object effectively invalid (can no longer be reopened etc.)
   *
   * @returns true if the kill succeeds, false otherwise
   * @see RShell#close
   */
	end(): boolean {
		const killResult = this.bareSession.kill()
		if(this.collectionTimeout !== undefined) {
			clearTimeout(this.collectionTimeout)
		}
		this.sessionStdOut.close()
		this.sessionStdErr.close()
		log.info(`killed R session with pid ${this.bareSession.pid ?? '<unknown>'} and result ${killResult ? 'successful' : 'failed'} (including streams)`)
		return killResult
	}

	private setupRSessionLoggers(): void {
		if(this.log.settings.minLevel >= LogLevel.Trace) {
			this.bareSession.stdout.on('data', (data: Buffer) => {
				this.log.trace(`< ${data.toString()}`)
			})
			this.bareSession.on('close', (code: number) => {
				this.log.trace(`session exited with code ${code}`)
			})
		}
		this.bareSession.stderr.on('data', (data: string) => {
			this.log.warn(`< ${data}`)
		})
	}

	public onExit(callback: (code: number, signal: string | null) => void): void {
		this.bareSession.on('exit', callback)
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private on(from: OutputStreamSelector, event: string, listener: (...data: any[]) => void): void {
		const both = from === 'both'
		if(both || from === 'stdout') {
			this.sessionStdOut.on(event, listener)
		}
		if(both || from === 'stderr') {
			this.sessionStdErr.on(event, listener)
		}
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private removeListener(from: OutputStreamSelector, event: string, listener: (...data: any[]) => void): void {
		const both = from === 'both'
		if(both || from === 'stdout') {
			this.sessionStdOut.removeListener(event, listener)
		}
		if(both || from === 'stderr') {
			this.sessionStdErr.removeListener(event, listener)
		}
	}
}
