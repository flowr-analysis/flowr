import {DEFAULT_R_SHELL_OPTIONS, RShellOptions} from './shell'
import {deepMergeObject} from '../util/objects'
import {spawnSync} from 'child_process'
import {ts2r} from './lang-4.x'
import {SemVer} from 'semver'
import semver from 'semver/preload'
import type {ILogObj, Logger} from 'tslog'
import {log} from '../util/log'
import fs from 'fs'

export class RShellExecutor {
	// TODO use a custom options class that doesn't have all the session stuff?
	public readonly options: Readonly<RShellOptions>
	private readonly log:    Logger<ILogObj>

	public constructor(options?: Partial<RShellOptions>) {
		this.options = deepMergeObject(DEFAULT_R_SHELL_OPTIONS, options)
		this.log = log.getSubLogger({ name: this.options.sessionName })
	}

	// TODO copy over more of the util methods from shell

	public usedRVersion(): SemVer | null{
		const version = this.run(`cat(paste0(R.version$major,".",R.version$minor), ${ts2r(this.options.eol)})`)
		this.log.trace(`raw version: ${JSON.stringify(version)}`)
		return semver.coerce(version)
	}

	public allInstalledPackages(): string[] {
		this.log.debug('getting all installed packages')
		const packages = this.run(`cat(paste0(installed.packages()[,1], collapse=","),"${this.options.eol}")`)
		return packages.split(',')
	}

	public isPackageInstalled(packageName: string): boolean {
		this.log.debug(`checking if package "${packageName}" is installed`)
		const result = this.run(`cat(system.file(package="${packageName}")!="","${this.options.eol}")`)
		return result === 'TRUE'
	}

	public ensurePackageInstalled(packageName: string, force = false): {
		packageName:           string
		packageExistedAlready: boolean
		/** the temporary directory used for the installation, undefined if none was used */
		libraryLocation?:      string
	} {
		const packageExistedAlready = this.isPackageInstalled(packageName)
		if(!force && packageExistedAlready) {
			this.log.info(`package "${packageName}" is already installed`)
			return {packageName, packageExistedAlready}
		}

		const tempDir = this.obtainTempDir()
		this.log.debug(`using temporary directory: "${tempDir}" to install package "${packageName}"`)

		this.run(`install.packages(${ts2r(packageName)},repos="https://cloud.r-project.org/",quiet=FALSE,lib=temp)`)

		return {packageName, packageExistedAlready, libraryLocation: tempDir}
	}

	public obtainTempDir(): string {
		const tempDir = this.run([
			'temp <- tempdir()',
			`cat(temp, ${ts2r(this.options.eol)})`
		])
		log.info(`obtained temp dir ${tempDir}`)

		const deleteOnExit = function() {
			if(fs.existsSync(tempDir)) {
				log.info(`deleting temp dir ${tempDir}`)
				fs.rmSync(tempDir, {recursive: true, force: true})
			}
		}
		process.on('SIGINT', deleteOnExit)
		process.on('SIGTERM', deleteOnExit)

		return tempDir
	}

	public run(command: string | string[], returnErr = false): string {
		this.log.trace(`> ${JSON.stringify(command)}`)

		const returns = spawnSync(this.options.pathToRExecutable, this.options.commandLineOptions, {
			env:      this.options.env,
			cwd:      this.options.cwd,
			encoding: 'utf8',
			input:    typeof command == 'string' ? command : command.join(this.options.eol)
		})
		return (returnErr ? returns.stderr : returns.stdout).trim()
	}

}