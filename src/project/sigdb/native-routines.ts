/**
 * Linking R's foreign function calls (`.Call(C_foo, x)`, `.C("foo", ..., PACKAGE = "pkg")`) to the native routines
 * a signature database records for the package (see {@link SigNativeRoutineInfo}), and asking those routines'
 * tool-derived facts with "unknown" kept apart from "no".
 */
import type { SigNativeRoutineInfo } from './schema';
import type { DynLibDirective, NamespaceFormat } from '../plugins/file-plugins/files/flowr-namespace-file';
import type { FlowrAnalyzer } from '../flowr-analyzer';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { BrandedIdentifier } from '../../dataflow/environments/identifier';
import { Identifier } from '../../dataflow/environments/identifier';
import { VertexType } from '../../dataflow/graph/vertex';
import { FunctionArgument } from '../../dataflow/graph/graph';
import { CallProp, CallProps } from '../../dataflow/environments/built-in-props';
import { callFnProps } from '../../dataflow/environments/query-fn-props';
import { FunctionSemantics } from '../../dataflow/fn/function-semantics';
import { RString } from '../../r-bridge/lang-4.x/ast/model/nodes/r-string';
import { RSymbol } from '../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { FileRole } from '../context/flowr-file';

/** How a foreign function call names its routine. */
export interface NativeRoutineRef {
	/** the routine's name as written: the string's content, or the R variable's name */
	readonly name:     string;
	/** the call names an R variable (`.Call(C_foo)`), which `useDynLib` binds, rather than a string (`.Call("foo")`) */
	readonly symbolic: boolean;
	/** the R function called, `.Call`, `.C`, `.Fortran`, `.External`, ... */
	readonly iface?:   BrandedIdentifier;
	/** the string given as `PACKAGE`, if any */
	readonly package?: string;
}

/** One foreign function call of an analyzed program. */
export interface NativeCallSite extends NativeRoutineRef {
	/** the call node */
	readonly id: NodeId;
}

/** the formals of the foreign function interface, `PACKAGE` has to be named in full as it follows `...` */
const Formals = { '.NAME': 'name', '...': '...', 'PACKAGE': 'package' } as const;

/** the interface a call goes through, as {@link SigNativeRoutineInfo.iface} names it (`.External2` reaches `.External` routines) */
function ifaceOf(call: string | undefined): string | undefined {
	switch(call) {
		case '.External2': case '.External.graphics': return '.External';
		case '.Call.graphics': return '.Call';
		default: return call;
	}
}

/** a fact's category matches `fact` itself or, asked by its family (`parallel`), every fact of it (`parallel:openmp`) */
function matches(fact: string, asked: string): boolean {
	return fact === asked || fact.startsWith(asked + ':');
}

/**
 * Helpers for the native routines of a signature database.
 * @example
 * ```ts
 * const routines = db.nativeRoutines('data.table') ?? [];
 * const r = NativeRoutines.resolve(routines, { name: 'Cforder', symbolic: true, iface: '.Call' });
 * NativeRoutines.has(r, 'parallel');  // true: the routine (or what it calls) has an OpenMP directive
 * ```
 */
export const NativeRoutines = {
	name: 'NativeRoutines',
	/**
	 * The routine a foreign function call names, the way R finds it: an R variable is the one `useDynLib` binds
	 * (the database's {@link SigNativeRoutineInfo.rNames}, else the package's `useDynLib` directives, if given);
	 * a string is first a registered name of the call's interface, then any registered name, then a linker symbol
	 * (`"foo"` also finds the Fortran symbol `foo_`). `undefined` when nothing matches.
	 */
	resolve(this: void, routines: readonly SigNativeRoutineInfo[], ref: NativeRoutineRef, dynLibs?: readonly DynLibDirective[]): SigNativeRoutineInfo | undefined {
		const iface = ifaceOf(ref.iface);
		const byName = (name: string) => routines.find(r => r.name === name && (iface === undefined || r.iface === undefined || r.iface === iface))
			?? routines.find(r => r.name === name);
		if(ref.symbolic) {
			const bound = routines.find(r => r.rNames?.includes(ref.name));
			if(bound !== undefined) {
				return bound;
			}
			for(const dyn of dynLibs ?? []) {
				const explicit = dyn.symbols.find(s => s.rName === ref.name);
				if(explicit !== undefined) {
					return byName(explicit.routine);
				}
				if(dyn.registration && ref.name.startsWith(dyn.prefix) && ref.name.endsWith(dyn.suffix) && ref.name.length >= dyn.prefix.length + dyn.suffix.length) {
					const hit = byName(ref.name.slice(dyn.prefix.length, ref.name.length - dyn.suffix.length));
					if(hit !== undefined) {
						return hit;
					}
				}
			}
			/* `useDynLib(pkg, foo)` binds `foo` to the routine of that name */
			return byName(ref.name);
		}
		const lower = ref.name.toLowerCase() + '_';
		return byName(ref.name)
			?? routines.find(r => r.symbol === ref.name || (r.symbol === undefined && r.name === ref.name))
			?? routines.find(r => r.lang === 'fortran' && r.symbol === lower);
	},
	/**
	 * Whether the routine has the fact (or, asked by family like `parallel`, any fact of it): `true` when a tool
	 * found it, `false` only when the routine is {@link SigNativeRoutineInfo.closed} and the fact is not an
	 * `error:`/`warning:` one, `undefined` when not known (including for an unknown routine).
	 */
	has(this: void, routine: SigNativeRoutineInfo | undefined, fact: string): boolean | undefined {
		if(routine === undefined) {
			return undefined;
		}
		if(routine.facts?.some(f => matches(f, fact))) {
			return true;
		}
		if(!routine.closed || fact.startsWith('error') || fact.startsWith('warning')) {
			return undefined;
		}
		return false;
	},
	/** the facts of the routine of the family `family` (`parallel` gives `parallel:openmp`, ...), empty if none is known */
	factsOf(this: void, routine: SigNativeRoutineInfo | undefined, family: string): string[] {
		return routine?.facts?.filter(f => matches(f, family)) ?? [];
	},
	/** the `useDynLib` directives of the analyzed package's NAMESPACE, empty when it has none */
	dynLibsOf(this: void, analyzer: FlowrAnalyzer): readonly DynLibDirective[] {
		const fmt = analyzer.inspectContext().files.getFilesByRole(FileRole.Namespace)[0]?.content() as NamespaceFormat | undefined;
		return fmt?.current.dynLibs ?? [];
	},
	/**
	 * The foreign function calls of the analyzed program (the calls flowR knows to be `.Call`, `.C`, ... by
	 * {@link CallProp.Ffi}, so a redefined `.Call` is not one), with the routine each names, when written as a
	 * string or a variable.
	 */
	async callSites(this: void, analyzer: FlowrAnalyzer): Promise<NativeCallSite[]> {
		const df = await analyzer.dataflow();
		const idMap = (await analyzer.normalize()).idMap;
		const out: NativeCallSite[] = [];
		for(const [id, vertex] of df.graph.verticesOfType(VertexType.FunctionCall)) {
			const props = callFnProps(id, df);
			if(!CallProps.hasAny(props, CallProp.Ffi) || !props?.sig?.some(([formal]) => formal === '.NAME')) {
				continue;
			}
			const bound = FunctionSemantics.call.match.toSpec(vertex.args, Formals);
			const values = new Map(vertex.args.filter(FunctionArgument.isNamed).map(a => [a.nodeId, a.valueId]));
			const valueOf = (formal: 'name' | 'package') => {
				const arg = bound.get(formal)?.[0];
				const vid = arg === undefined ? undefined : values.has(arg) ? values.get(arg) : arg;
				return vid === undefined ? undefined : idMap.get(vid);
			};
			const nameNode = valueOf('name');
			const pkgNode = valueOf('package');
			const iface = Identifier.getName(vertex.name);
			const pkg = pkgNode !== undefined && RString.is(pkgNode) ? pkgNode.content.str : undefined;
			if(nameNode !== undefined && RString.is(nameNode)) {
				out.push({ id, iface, name: nameNode.content.str, symbolic: false, ...pkg === undefined ? {} : { package: pkg } });
			} else if(nameNode !== undefined && RSymbol.is(nameNode)) {
				out.push({ id, iface, name: Identifier.getName(nameNode.content), symbolic: true, ...pkg === undefined ? {} : { package: pkg } });
			}
		}
		return out;
	}
} as const;
