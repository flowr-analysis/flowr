import type { FunctionInfo } from './function-info';
import { Constant, Unknown } from '../dependencies-query-format';

/**
 * The installers that fetch a package from somewhere other than a configured CRAN-like repository, with the
 * argument naming what they fetch: a `user/repo` slug for the forge installers, a url or path for the rest.
 * `remotes` implements them and `devtools` re-exports the whole API, so the entries state no package and match
 * either spelling as well as the bare name.
 */
export const RemoteFunctions: FunctionInfo[] = [
	{ name: 'install_github',    argIdx: 0, argName: 'repo', resolveValue: true },
	{ name: 'install_gitlab',    argIdx: 0, argName: 'repo', resolveValue: true },
	{ name: 'install_bitbucket', argIdx: 0, argName: 'repo', resolveValue: true },
	{ name: 'install_git',       argIdx: 0, argName: 'url',  resolveValue: true },
	{ name: 'install_svn',       argIdx: 0, argName: 'url',  resolveValue: true },
	{ name: 'install_url',       argIdx: 0, argName: 'url',  resolveValue: true },
	{ name: 'install_bioc',      argIdx: 0, argName: 'repo', resolveValue: true },
	{ package: 'pak', name: 'pkg_install',  argIdx: 0, argName: 'pkg', resolveValue: true },
	{ package: 'pak', name: 'pak',          argIdx: 0, argName: 'pkg', resolveValue: true },
	{ package: 'renv', name: 'install',     argIdx: 0, argName: 'packages', resolveValue: true }
] as const;

/** `github::`, `bioc::`, ... prefixes of a `pak` reference, and the `.git` a clone url ends in */
const RemotePrefix = /^[a-z]+::/;
const RemoteRevision = /[@#](?<revision>[^/]+)$/;

/**
 * What a remote reference installs, as the installers spell it: `user/repo` (the package is `repo`),
 * `user/repo/subdir` (the package sits in `subdir`), `user/repo@v1.2` or `user/repo#42` (pinned to a revision),
 * `github::user/repo` (a `pak` source prefix), and a clone url whose last segment names the package.
 * `undefined` for a value that never resolved, which names nothing.
 */
export function remoteTarget(value: string | undefined): { packageName: string, revision?: string } | undefined {
	if(value === undefined || value === Unknown || value === Constant || value.length === 0) {
		return undefined;
	}
	const revision = RemoteRevision.exec(value)?.groups?.revision;
	const path = value.replace(RemoteRevision, '').replace(RemotePrefix, '').replace(/\/+$/, '');
	/* a url carries a host we have to drop first, everything else is already the path of the reference */
	const segments = (path.includes('://') ? path.slice(path.indexOf('://') + 3).split('/').slice(1) : path.split('/'))
		.filter(s => s.length > 0);
	/* a clone url ends in `.git`, an archive in its extension and often a version (`pkg_1.0.tar.gz`) */
	const packageName = segments.at(-1)?.replace(/\.git$|\.(tar\.(gz|bz2|xz)|tgz|zip)$/, '').replace(/_[\d.-]+$/, '');
	return packageName ? { packageName, ...(revision ? { revision } : {}) } : undefined;
}
