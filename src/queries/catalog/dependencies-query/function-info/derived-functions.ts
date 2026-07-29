import type { FunctionInfo } from './function-info';
import type { BuiltInFnInfo, CallProps } from '../../../../dataflow/environments/built-in-props';
import { ArgProp } from '../../../../dataflow/environments/built-in-props';
import { DefaultBuiltinConfig } from '../../../../dataflow/environments/default-builtin-config';
import { builtInNames } from '../../../../dataflow/environments/query-fn-props';
import { Identifier } from '../../../../dataflow/environments/identifier';

/** what an entry links to, like `sink` for `cat`: the link reports it already, so it is not an entry of its own */
function linkTargets(f: FunctionInfo): string[] {
	return (f.linkTo ?? []).flatMap(l => typeof l.callName === 'string' ? [l.callName]
		: Array.isArray(l.callName) ? l.callName.map(n => Identifier.getName(n as Identifier)) : []);
}

/**
 * The built-ins that carry all of `props` and name the resource they act on, as entries of a dependency
 * category. This is what the {@link DefaultBuiltinConfig} already states, so only the functions it does not
 * know (most package functions) and the ones needing more than a resource argument (`ignoreIf`, `linkTo`,
 * a default, ...) have to be written down in the category itself. Names in `except` stay with whoever
 * wrote them down.
 */
export function functionInfosFromProps(props: CallProps, except: readonly FunctionInfo[]): FunctionInfo[] {
	const taken = new Set(except.flatMap(f => [f.name, ...linkTargets(f)]));
	const found: FunctionInfo[] = [];
	for(const d of DefaultBuiltinConfig) {
		const info = d.type !== 'constant' ? (d as { config?: BuiltInFnInfo }).config : undefined;
		if(info?.props === undefined || (info.props & props) !== props || info.sig === undefined) {
			continue;
		}
		const argIdx = info.sig.findIndex(([, p]) => (p & ArgProp.Resource) !== 0);
		if(argIdx < 0) {
			continue;
		}
		for(const id of builtInNames(d)) {
			const name = Identifier.getName(id);
			if(!taken.has(name)) {
				found.push({ package: Identifier.getNamespace(id), name, argIdx, argName: info.sig[argIdx][0], resolveValue: true });
			}
		}
	}
	return found;
}
