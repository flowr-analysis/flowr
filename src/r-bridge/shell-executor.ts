import type { RShellExecutionOptions} from './shell'
import {DEFAULT_R_SHELL_OPTIONS} from './shell'
import {deepMergeObject} from '../util/objects'
import {spawnSync} from 'child_process'
import {ts2r} from './lang-4.x'
import type {SemVer} from 'semver'
import semver from 'semver/preload'
import type {ILogObj, Logger} from 'tslog'
import {log} from '../util/log'

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
		this.addPrerequisites('options(error=function() {})')
		return this
	}

	public addPrerequisites(commands: string | string[]): RShellExecutor{
		this.prerequisites.push(...(typeof commands == 'string' ? [commands] : commands))
		return this
	}

	public usedRVersion(): SemVer | null{
		const version = this.run(`cat(paste0(R.version$major,".",R.version$minor), ${ts2r(this.options.eol)})`)
		this.log.trace(`raw version: ${JSON.stringify(version)}`)
		return semver.coerce(version)
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
