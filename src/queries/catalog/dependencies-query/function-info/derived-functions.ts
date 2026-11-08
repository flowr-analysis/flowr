import type { FunctionInfo } from './function-info';
import { FunctionSemantics } from '../../../../dataflow/fn/function-semantics';
import type { BuiltInFnInfo, PropSelector } from '../../../../dataflow/environments/built-in-props';
import { ArgProp, CallProp, FnSig, SemanticCallTag } from '../../../../dataflow/environments/built-in-props';
import { builtInNames } from '../../../../dataflow/environments/query-fn-props';
import type { BuiltInDefinitions } from '../../../../dataflow/environments/built-in-config';
import { Identifier } from '../../../../dataflow/environments/identifier';

/** what an entry links to, like `sink` for `cat`: the link reports it already, so it is not an entry of its own */
function linkTargets(f: FunctionInfo): string[] {
	return (f.linkTo ?? []).flatMap(l => typeof l.callName === 'string' ? [l.callName]
		: Array.isArray(l.callName) ? l.callName.map(n => Identifier.getName(n as Identifier)) : []);
}

/**
 * How an entry is looked up among the ones already written down: under the package that declares it where it
 * names one, so `readr::write_csv` and `rpolars::write_csv` stay two entries rather than one shadowing the other.
 */
function writtenAs(f: FunctionInfo): string {
	return f.package === undefined ? f.name : `${f.package}::${f.name}`;
}

/**
 * The built-ins that carry all of `props` and name the resource they act on, as entries of a dependency
 * category. This is what the built-in configuration already states, so only the functions it does not
 * know (most package functions) and the ones needing more than a resource argument (`ignoreIf`, `linkTo`,
 * a default, ...) have to be written down in the category itself. Names in `except` stay with whoever
 * wrote them down.
 */
export function functionInfosFromProps(props: PropSelector, except: readonly FunctionInfo[], definitions: BuiltInDefinitions): FunctionInfo[] {
	const taken = new Set(except.map(writtenAs));
	/* a bare name speaks for every package: an entry written down without one, and whatever a link points at */
	const takenEverywhere = new Set(except.flatMap(f => [...f.package === undefined ? [f.name] : [], ...linkTargets(f)]));
	const found: FunctionInfo[] = [];
	const written = Array.isArray(props) ? props.includes(SemanticCallTag.Writes) : props === SemanticCallTag.Writes;
	for(const d of definitions) {
		const info = d.type !== 'constant' ? (d as { config?: BuiltInFnInfo }).config : undefined;
		if(info?.sig === undefined || !FunctionSemantics.call.props.hasAny(info) || !FunctionSemantics.call.props.hasAll(info, props)) {
			continue;
		}
		const argIdx = FnSig.resources(info.sig, written).findIndex(([, p]) => (p & ArgProp.Resource) !== 0);
		if(argIdx < 0) {
			continue;
		}
		for(const id of builtInNames(d)) {
			const name = Identifier.getName(id);
			const pkg = Identifier.getNamespace(id);
			if(!takenEverywhere.has(name) && !taken.has(pkg === undefined ? name : `${pkg}::${name}`)) {
				found.push({ package: pkg, name, argIdx, argName: info.sig[argIdx][0], resolveValue: true,
					...FunctionSemantics.call.props.hasAny(info, [CallProp.Invisible]) ? { invisible: true } : {} });
			}
		}
	}
	return found;
}

/**
 * The entries of `entries` for built-ins telling the files they read from the ones they write ({@link FnSig.resources}),
 * like `unzip(zipfile, exdir)`, which are entries of both categories, each with its own argument.
 */
export function readingAndWritingApart(entries: readonly FunctionInfo[], definitions: BuiltInDefinitions): ReadonlySet<FunctionInfo> {
	const apart = new Set<string>();
	for(const d of definitions) {
		const sig = d.type !== 'constant' ? (d as { config?: BuiltInFnInfo }).config?.sig : undefined;
		if(sig !== undefined && FnSig.resources(sig, true) !== sig) {
			builtInNames(d).forEach(id => apart.add(Identifier.toString(id)));
		}
	}
	return new Set(entries.filter(f => apart.has(writtenAs(f))));
}
