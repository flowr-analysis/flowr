import { FlowrAnalyzerRoleFilePlugin } from './flowr-analyzer-file-plugin';
import { SemVer } from 'semver';
import { FileRole } from '../../context/flowr-file';

/** Lockfiles pinning a project's package environment (`renv.lock`, `rv.lock`, `uvr.lock`, `packrat.lock`). */
const VirtualEnvFilePattern = /^(renv|rv|uvr|packrat)\.lock$/i;

/**
 * Tags a project's virtual-environment lockfiles with the {@link FileRole.VirtualEnv} role, so the version
 * plugins that read them can look them up by role instead of scanning every project file.
 */
export class FlowrAnalyzerVirtualEnvFilePlugin extends FlowrAnalyzerRoleFilePlugin {
	public readonly name = 'flowr-analyzer-virtualenv-files-plugin';
	public readonly description = 'Marks virtual-environment lockfiles (renv.lock, rv.lock, uvr.lock).';
	public readonly version = new SemVer('0.1.0');
	protected readonly roles = [FileRole.VirtualEnv];

	/**
	 * Creates a new instance of the virtual-environment file plugin.
	 * @param pathPattern - The pattern to identify lockfiles, see {@link VirtualEnvFilePattern} for the default.
	 */
	constructor(pathPattern: RegExp = VirtualEnvFilePattern) {
		super(pathPattern);
	}
}
