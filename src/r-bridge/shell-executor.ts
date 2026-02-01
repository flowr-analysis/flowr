import { type RShellExecutionOptions, getDefaultRShellOptions } from './shell';
import { deepMergeObject } from '../util/objects';
import { spawnSync } from 'child_process';
import type { SemVer } from 'semver';
import semver from 'semver/preload';
import { expensiveTrace, log } from '../util/log';
import { initCommand } from './init';
import { ts2r } from './lang-4.x/convert-values';
import type { BaseRShellInformation, SyncParser } from './parser';
import { retrieveParseDataFromRCode, type RParseRequest } from './retriever';

const executorLog = log.getSubLogger({ name: 'RShellExecutor' });

/**
 * This is a synchronous alternative to the {@link RShell}.
 * Please be aware that using this is expensive.
 * Every request effectively causes a new initialization of the R interpreter.
 *
 * With this class you can {@link RShellExecutor#run|run(command)} commands,
 * that are potentially decorated with {@link RShellExecutor#addPrerequisites|prerequisites}.
 * For compatibility,
 * we provide {@link RShellExecutor#parse|parse(request)} and {@link RShellExecutor#rVersion|rVersion()}.
 */
export class RShellExecutor implements SyncParser<string> {
	public readonly name = 'r-shell';
	public readonly options:        Readonly<RShellExecutionOptions>;
	private readonly prerequisites: string[];

	public constructor(options?: Partial<RShellExecutionOptions>) {
		this.options = deepMergeObject(getDefaultRShellOptions(), options);
		this.prerequisites = [initCommand(this.options.eol)];
	}

	/**
	 * Adds commands that should be executed for every {@link RShellExecutor#run|run}.
	 */
	public addPrerequisites(commands: string | string[]): this {
		this.prerequisites.push(...(typeof commands == 'string' ? [commands] : commands));
		return this;
	}

	/**
	 * @returns the version of the R interpreter available to this executor.
	 * @see {@link RShellExecutor#usedRVersion}
	 * @see {@link RShell#rVersion}
	 * @see {@link RShell#usedRVersion}
	 */
	public rVersion(): Promise<string | 'unknown' | 'none'> {
		return Promise.resolve(this.usedRVersion()?.format() ?? 'unknown');
	}

	public information(): BaseRShellInformation {
		return {
			name:     'r-shell',
			rVersion: () => Promise.resolve(this.rVersion())
		};
	}

	/**
	 * Instead of returning a promise, this method returns the version of the R interpreter available to this executor,
	 * in the SemVer format.
	 */
	public usedRVersion(): SemVer | null {
		const version = this.run(`cat(paste0(R.version$major,".",R.version$minor), ${ts2r(this.options.eol)})`);
		expensiveTrace(executorLog, () => `raw version: ${JSON.stringify(version)}`);
		return semver.coerce(version);
	}

	/**
	 * Runs the given command in the R interpreter.
	 */
	public run(command: string, returnErr = false): string {
		command += ';base::quit()';
		expensiveTrace(executorLog, () => `> ${JSON.stringify(command)}`);

		const returns = spawnSync(this.options.pathToRExecutable, this.options.commandLineOptions, {
			env:         this.options.env,
			cwd:         this.options.cwd,
			windowsHide: true,
			encoding:    'utf8',
			input:       [...this.prerequisites, command].join(this.options.eol)
		});
		return (returnErr ? returns.stderr : returns.stdout).trim();
	}

	/**
	 * Parses the given request and returns the result.
	 */
	public parse(request: RParseRequest): string {
		return retrieveParseDataFromRCode(request, this);
	}

	public close(): void { /* noop */ }
}
