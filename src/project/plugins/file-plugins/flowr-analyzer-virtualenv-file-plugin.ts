import { FlowrAnalyzerFilePlugin } from './flowr-analyzer-file-plugin';
import { SemVer } from 'semver';
import type { PathLike } from 'fs';
import type { FlowrAnalyzerContext } from '../../context/flowr-analyzer-context';
import type { FlowrFileProvider } from '../../context/flowr-file';
import { FileRole } from '../../context/flowr-file';
import {
	platformBasename
} from '../../../dataflow/internal/process/functions/call/built-in/built-in-source';

/** Lockfiles pinning a project's package environment (`renv.lock`, `rv.lock`). */
const VirtualEnvFilePattern = /^(renv|rv)\.lock$/i;

/**
 * Tags a project's virtual-environment lockfiles (e.g. `renv.lock`, `rv.lock`) with the
 * {@link FileRole.VirtualEnv} role, so the version plugins that read them (renv/rv) can look them up
 * by role instead of scanning every project file.
 */
export class FlowrAnalyzerVirtualEnvFilePlugin extends FlowrAnalyzerFilePlugin {
	public readonly name = 'flowr-analyzer-virtualenv-files-plugin';
	public readonly description = 'This plugin marks virtual-environment lockfiles (renv.lock, rv.lock).';
	public readonly version = new SemVer('0.1.0');
	private readonly pathPattern: RegExp;

	/**
	 * Creates a new instance of the virtual-environment file plugin.
	 * @param pathPattern - The pattern to identify lockfiles, see {@link VirtualEnvFilePattern} for the default.
	 */
	constructor(pathPattern: RegExp = VirtualEnvFilePattern) {
		super();
		this.pathPattern = pathPattern;
	}

	public applies(file: PathLike): boolean {
		return this.pathPattern.test(platformBasename(file.toString()));
	}

	/**
	 * Processes the given file, assigning it the {@link FileRole.VirtualEnv} role. The file may still be
	 * relevant to other plugins, so this returns the `true` flag to keep the loader chain going.
	 */
	public process(_ctx: FlowrAnalyzerContext, file: FlowrFileProvider): [FlowrFileProvider, true] {
		file.assignRole(FileRole.VirtualEnv);
		return [file, true];
	}
}
