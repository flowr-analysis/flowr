import type { FunctionArgInfo, FunctionInfo } from './function-info';
import type { BuiltInDefinitions } from '../../../../dataflow/environments/built-in-config';
import { builtInNames } from '../../../../dataflow/environments/query-fn-props';
import { CallProp, CallProps, SemanticCallTag } from '../../../../dataflow/environments/built-in-props';
import { Ambient, AmbientVerb } from '../../../../dataflow/environments/ambient-effect';
import { KeyedState, PlainPackageName } from '../../../../dataflow/environments/ambient-state-name';
import { Identifier } from '../../../../dataflow/environments/identifier';
import { Constant, Unknown } from '../dependency-values';

/**
 * The installers that fetch a package over the network, with the argument naming what they fetch, as the built-ins state them:
 * a call is a remote install unless that argument is a plain package name, which comes from a configured CRAN-like repository.
 */
export function computeRemoteFunctions(definitions: BuiltInDefinitions): FunctionInfo[] {
	return definitions.flatMap(d => {
		const info = d.type === 'constant' ? undefined : d.config;
		const member = info !== undefined && CallProps.hasAny(info, SemanticCallTag.Network)
			? Ambient.list(info.ambient).find(e => e.family === KeyedState.InstalledPackages && (e.access === AmbientVerb.Writes || e.access === AmbientVerb.Adds))?.member : undefined;
		const arg: FunctionArgInfo | undefined = typeof member !== 'object' ? undefined
			: member.from === 'parameter' ? { argIdx: member.signature.indexOf(String(member.names[0])), argName: member.names[0] } : member.from === 'unnamed' ? { argIdx: 'unnamed' } : undefined;
		return arg === undefined ? [] : builtInNames(d).map(id => ({ package: Identifier.getNamespace(id), name: Identifier.getName(id), ...arg, resolveValue: true,
			...CallProps.hasAny(info, CallProp.Invisible) ? { invisible: true } : {} }));
	});
}

/** Whether a value an installer was given names a package only implicitly, or may do so as it never resolved. */
export function installsRemotely(value: string | undefined): boolean {
	return value !== Constant && (value === undefined || value === Unknown || !PlainPackageName.test(value));
}

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
