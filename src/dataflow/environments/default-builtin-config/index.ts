import type { AnyBuiltInDefinition, BuiltInDefinitions, BuiltInFunctionDefinition, BuiltInReplacementDefinition } from '../built-in-config';
import { FunctionSemantics } from '../../fn/function-semantics';
import { OperatorDefinitions } from './operators';
import { UnnamedFunctionCallPrefix } from '../../internal/process/functions/call/unnamed-call-handling';
import { Identifier, PkgName } from '../identifier';
import { BuiltInProcName } from '../built-in-proc-name';
import type { FnSig, StatedProps } from '../built-in-props';
import { AttachedBasePackageSet } from '../../../util/r-base-packages';
import type { StatedSignature } from './shared';
import { statedSignatureOf, markGenerics, markPrimitives } from './shared';
import { BaseDefinitions } from './base';
import { InteractiveDefinitions } from './interactive';
import { LanguageDefinitions } from './language';
import { TidyverseDefinitions } from './tidyverse';
import { DataTableDefinitions } from './data-table';
import { GraphicsDefinitions } from './graphics';
import { ClassesDefinitions } from './classes';
import { IoDefinitions } from './io';
import { StatsDefinitions } from './stats';
import { MediaDefinitions } from './media';
import { UtilsDefinitions } from './utils';
import { ToolingDefinitions } from './tooling';
import { SpatialDefinitions } from './spatial';
import { NetworkDefinitions } from './network';
import { DatabaseDefinitions } from './database';
import { WithrDefinitions } from './withr';
import { ParallelDefinitions } from './parallel';
import { MiscDefinitions } from './misc';
import { TestingDefinitions } from './testing';

export type { StatedSignature } from './shared';
export { StackEnvKind, StackEnvBuiltins, PlotFunctionPackages, plotFunctionOwners, namespacePlotFunctions, GgPlotCreate, TinyPlotCrate, GraphicsPlotCreate, PlotCreate, PlotObjectCreate, TinyPlotAddons, GgPlotImplicitAddons, PlotFunctionsWithAddParam, GraphicsPlotAddons, GgPlotAddons, BasePrimitiveTopics, statedSignatureOf, LinkToLastGgPlot, InternalGenerics } from './shared';

/**
 * What flowR states about every function it carries a definition for, as `name -> signatures` (a name may be
 * defined for several packages, so all of them are here; {@link statedSignatureOf} picks by package).
 */
export function statedSignatures(definitions: BuiltInDefinitions = DefaultBuiltinConfig): Map<string, StatedSignature[]> {
	const stated = new Map<string, StatedSignature[]>();
	for(const definition of definitions) {
		const info = (definition as { config?: StatedProps & { sig?: FnSig } }).config;
		for(const id of definition.names) {
			const name = String(Identifier.getName(id));
			const pkg = String(Identifier.getNamespace(id) ?? PkgName.Base);
			const declared = info?.sig ?? [];
			const entry = {
				pkg,
				params: declared.length > 0 ? declared.map(([param]) => param).join(', ') : undefined,
				props:  FunctionSemantics.call.props.labels(info),
				args:   declared.length > 0 ? declared.map(([param, props]) => [param, FunctionSemantics.call.argument.words(props)] as const) : undefined
			};
			const known = stated.get(name) ?? [];
			/* the last definition for a package is the one that resolves, so it is the one stated */
			stated.set(name, [...known.filter(other => other.pkg !== pkg), entry]);
		}
	}
	return stated;
}


/**
 * Contains the built-in definitions recognized by flowR, as they are written down: {@link DefaultBuiltinConfig}
 * is what {@link markGenerics} makes of them, and a test checks that this is all it changes.
 */
export const WrittenBuiltinDefinitions = [
	...OperatorDefinitions,
	...LanguageDefinitions,
	...BaseDefinitions,
	...InteractiveDefinitions,
	...TidyverseDefinitions,
	...DataTableDefinitions,
	...GraphicsDefinitions,
	...ClassesDefinitions,
	...IoDefinitions,
	...StatsDefinitions,
	...MediaDefinitions,
	...UtilsDefinitions,
	...ToolingDefinitions,
	...SpatialDefinitions,
	...NetworkDefinitions,
	...DatabaseDefinitions,
	...WithrDefinitions,
	...ParallelDefinitions,
	...MiscDefinitions,
	...TestingDefinitions
] as const satisfies AnyBuiltInDefinition[];

/** Contains the built-in definitions recognized by flowR */
export const DefaultBuiltinConfig = markPrimitives(markGenerics(WrittenBuiltinDefinitions));

/** Expensive and naive lookup of the default processor for a built-in function name */
export function getDefaultProcessor(name: string): BuiltInProcName | undefined {
	if(name.startsWith(UnnamedFunctionCallPrefix)) {
		return BuiltInProcName.Unnamed;
	}
	/* a bare name is what R finds on the default search path, a package's function of that name only once attached */
	const named = (n: Identifier, base: boolean) => Identifier.getName(n) === name && (!base || AttachedBasePackageSet.has(Identifier.getNamespace(n) ?? PkgName.Base));
	const matches = (base: boolean) => (def: typeof DefaultBuiltinConfig[number]) =>
		((def.names as readonly Identifier[]).some(n => named(n, base)) && def.type !== 'constant')
		|| (def.type === 'replacement' && def.suffixes.flatMap(d => def.names.map(n => `${Identifier.getName(n)}${d}`)).includes(name));
	const fn = (DefaultBuiltinConfig.find(matches(true)) ?? DefaultBuiltinConfig.find(matches(false))) as BuiltInFunctionDefinition<BuiltInProcName.Default | BuiltInProcName.DefaultReadAllArgs> | BuiltInReplacementDefinition | undefined;
	if(fn?.type === 'replacement') {
		return BuiltInProcName.Replacement;
	}
	return fn?.processor === BuiltInProcName.DefaultReadAllArgs ? BuiltInProcName.Default : fn?.processor;
}
