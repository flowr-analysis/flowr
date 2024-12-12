import type { RShellExecutionOptions } from './shell';
import { getDefaultRShellOptions } from './shell';
import { deepMergeObject } from '../util/objects';
import { spawnSync } from 'child_process';
import type { SemVer } from 'semver';
import semver from 'semver/preload';
import { expensiveTrace, log } from '../util/log';
import { initCommand } from './init';
import { ts2r } from './lang-4.x/convert-values';
import type { SyncParser } from './parser';
import { retrieveParseDataFromRCode, type RParseRequest } from './retriever';

const executorLog = log.getSubLogger({ name: 'RShellExecutor' });

export class RShellExecutor implements SyncParser<string> {
	public readonly name = 'r-shell';
	public readonly options:        Readonly<RShellExecutionOptions>;
	private readonly prerequisites: string[];

	public constructor(options?: Partial<RShellExecutionOptions>) {
		this.options = deepMergeObject(getDefaultRShellOptions(), options);
		this.prerequisites = [initCommand(this.options.eol)];
	}

	public addPrerequisites(commands: string | string[]): this {
		this.prerequisites.push(...(typeof commands == 'string' ? [commands] : commands));
		return this;
	}

	public rVersion(): Promise<string | 'unknown' | 'none'> {
		return Promise.resolve(this.usedRVersion()?.format() ?? 'unknown');
	}

	public usedRVersion(): SemVer | null{
		const version = this.run(`cat(paste0(R.version$major,".",R.version$minor), ${ts2r(this.options.eol)})`);
		expensiveTrace(executorLog, () => `raw version: ${JSON.stringify(version)}`);
		return semver.coerce(version);
	}

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

	public parse(request: RParseRequest): string {
		return retrieveParseDataFromRCode(request, this);
	}

	public close(): void { /* noop */ }
}
