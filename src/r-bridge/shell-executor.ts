import {DEFAULT_R_SHELL_OPTIONS, RShellExecutionOptions} from './shell'
import {deepMergeObject} from '../util/objects'
import {spawnSync} from 'child_process'
import {parseCSV, ts2r} from './lang-4.x'
import {SemVer} from 'semver'
import semver from 'semver/preload'
import type {ILogObj, Logger} from 'tslog'
import {log} from '../util/log'
import fs from 'fs'
import {removeTokenMapQuotationMarks, TokenMap} from './retriever'
import {DeepWritable} from 'ts-essentials'

export class RShellExecutor {

	public readonly options:        Readonly<RShellExecutionOptions>
	private readonly log:           Logger<ILogObj>
	private readonly prerequisites: string[] = []

	public constructor(options?: Partial<RShellExecutionOptions>) {
		this.options = deepMergeObject(DEFAULT_R_SHELL_OPTIONS, options)
		this.log = log.getSubLogger({ name: 'RShellExecutor' })
	}

	public continueOnError(): RShellExecutor {
		this.log.info('continue in case of Errors')
		this.prerequisites.push('options(error=function() {})')
		return this
	}

	public injectLibPaths(...paths: string[]): RShellExecutor {
		this.log.debug(`injecting lib paths ${JSON.stringify(paths)}`)
		this.prerequisites.push(`.libPaths(c(.libPaths(), ${paths.map(ts2r).join(',')}))`)
		return this
	}

	public tryToInjectHomeLibPath(): RShellExecutor {
		if(this.options.homeLibPath === undefined) {
			this.log.debug('ensuring home lib path exists (automatic inject)')
			this.prerequisites.push('if(!dir.exists(Sys.getenv("R_LIBS_USER"))) { dir.create(path=Sys.getenv("R_LIBS_USER"),showWarnings=FALSE,recursive=TRUE) }')
			this.prerequisites.push('.libPaths(c(.libPaths(), Sys.getenv("R_LIBS_USER")))')
		} else {
			this.injectLibPaths(this.options.homeLibPath)
		}
		return this
	}

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
		return this.run(`cat(system.file(package="${packageName}")!="","${this.options.eol}")`) === 'TRUE'
	}

	public ensurePackageInstalled(packageName: string, autoload = false, force = false): {
		packageName:           string
		packageExistedAlready: boolean
		/** the temporary directory used for the installation, undefined if none was used */
		libraryLocation?:      string
	} {
		const packageExistedAlready = this.isPackageInstalled(packageName)
		if(!force && packageExistedAlready) {
			this.log.info(`package "${packageName}" is already installed`)
			if(autoload)
				this.prerequisites.push(`library(${ts2r(packageName)})`)
			return {packageName, packageExistedAlready}
		}

		const tempDir = this.obtainTempDir()
		this.log.debug(`using temporary directory: "${tempDir}" to install package "${packageName}"`)

		this.run(`install.packages(${ts2r(packageName)},repos="https://cloud.r-project.org/",quiet=FALSE,lib=temp)`)
		if(autoload)
			this.prerequisites.push(`library(${ts2r(packageName)},lib.loc=temp)`)

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

	public getTokenMap(): TokenMap {
		this.ensurePackageInstalled('xmlparsedata', true)

		// we invert the token map to get a mapping back from the replacement
		const parsed = parseCSV(this.run('write.table(xmlparsedata::xml_parse_token_map,sep=",",col.names=FALSE)').split('\n'))

		if(parsed.some(s => s.length !== 2))
			throw new Error(`Expected two columns in token map, but got ${JSON.stringify(parsed)}`)

		// we swap key and value to get the other direction, furthermore we remove quotes from keys if they are quoted
		const ret: DeepWritable<TokenMap> = {}
		for(const [key, value] of parsed)
			ret[value] = removeTokenMapQuotationMarks(key)
		return ret as TokenMap
	}

	public run(commands: string | string[], returnErr = false): string {
		this.log.trace(`> ${JSON.stringify(commands)}`)

		const returns = spawnSync(this.options.pathToRExecutable, this.options.commandLineOptions, {
			env:      this.options.env,
			cwd:      this.options.cwd,
			encoding: 'utf8',
			input:    [...this.prerequisites, commands].join(this.options.eol)
		})
		return (returnErr ? returns.stderr : returns.stdout).trim()
	}

}