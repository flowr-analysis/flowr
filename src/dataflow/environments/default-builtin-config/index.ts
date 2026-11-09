import type { AnyBuiltInDefinition, BuiltInDefinitions, BuiltInFunctionDefinition, BuiltInReplacementDefinition } from '../built-in-config';
import { OperatorDefinitions } from './base-operators';
import { UnnamedFunctionCallPrefix } from '../built-in-kinds';
import { Identifier, PkgName, type BrandedIdentifier } from '../identifier';
import { BuiltInProcName } from '../built-in-proc-name';
import { ArgProps, CallProp, CallProps } from '../built-in-props';
import { ambientSummaryOf, declaresAmbient } from '../ambient-effect';
import { AttachedBasePackageSet } from '../../../util/r-base-packages';
import type { StatedSignature } from './shared-configs';
import { statedSignatureOf, markGenerics, markPrimitives } from './shared-configs';
import { BaseDefinitions } from './base-functions';
import { InteractiveDefinitions } from './session-interactive';
import { LanguageDefinitions } from './base-language';
import { TidyverseDefinitions } from './package-tidyverse';
import { DataTableDefinitions } from './package-data-table';
import { GraphicsDefinitions } from './graphics-devices';
import { ClassesDefinitions } from './object-systems';
import { IoDefinitions } from './file-io';
import { StatsDefinitions } from './statistics';
import { MediaDefinitions } from './media-formats';
import { UtilsDefinitions } from './package-utils';
import { ToolingDefinitions } from './dev-tooling';
import { SpatialDefinitions } from './package-spatial';
import { NetworkDefinitions } from './network-access';
import { DatabaseDefinitions } from './database-access';
import { WithrDefinitions } from './package-withr';
import { ParallelDefinitions } from './parallel-execution';
import { MiscDefinitions } from './misc-packages';
import { TestingDefinitions } from './unit-testing';
import { GuardDefinitions, markGuards } from './guards';
import { markFormals } from './r-formals';

export type { StatedSignature } from './shared-configs';
export { StackEnvKind, StackEnvBuiltins, PlotFunctionPackages, plotFunctionOwners, namespacePlotFunctions, GgPlotCreate, TinyPlotCrate, GraphicsPlotCreate, PlotCreate, PlotObjectCreate, TinyPlotAddons, GgPlotImplicitAddons, PlotFunctionsWithAddParam, GraphicsPlotAddons, GgPlotAddons, BasePrimitiveTopics, statedSignatureOf, LinkToLastGgPlot, InternalGenerics } from './shared-configs';

/** What flowR states about every function it carries a definition for, as `name -> signatures` (a name may be defined for several packages, so all of them are here; {@link statedSignatureOf} picks by package). */
export function statedSignatures(definitions: BuiltInDefinitions = DefaultBuiltinConfig): Map<BrandedIdentifier, StatedSignature[]> {
	const stated = new Map<BrandedIdentifier, StatedSignature[]>();
	for(const definition of definitions) {
		const info = definition.type === 'constant' ? undefined : definition.config;
		const ambient = ambientSummaryOf(info);
		for(const id of definition.names) {
			const name = String(Identifier.getName(id));
			const pkg = String(Identifier.getNamespace(id) ?? PkgName.Base);
			const declared = info?.sig ?? [];
			const entry = {
				pkg,
				params: declared.length > 0 ? declared.map(([param]) => param).join(', ') : undefined,
				props:  CallProps.labels(ambient.length > 0 || declaresAmbient(info) ? { ...info, props: (info?.props ?? 0) | CallProp.Ambient } : info),
				args:   declared.length > 0 ? declared.map(([param, props]) => [param, ArgProps.words(props)] as const) : undefined,
				...ambient.length > 0 ? { ambient } : {}
			};
			const known = stated.get(name) ?? [];
			/* the last definition for a package is the one that resolves, so it is the one stated */
			stated.set(name, [...known.filter(other => other.pkg !== pkg), entry]);
		}
	}
	return stated;
}


/** Contains the built-in definitions recognized by flowR, as they are written down: {@link DefaultBuiltinConfig} is what {@link markGenerics} makes of them, and a test checks that this is all it changes. */
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
	...TestingDefinitions,
	...GuardDefinitions
] as const satisfies AnyBuiltInDefinition[];

/** Contains the built-in definitions recognized by flowR */
export const DefaultBuiltinConfig = markFormals(markGuards(markPrimitives(markGenerics(WrittenBuiltinDefinitions))));

/** Expensive and naive lookup of the default processor for a built-in function name */
export function getDefaultProcessor(name: BrandedIdentifier): BuiltInProcName | undefined {
	if(name.startsWith(UnnamedFunctionCallPrefix)) {
		return BuiltInProcName.Unnamed;
	}
	/* a bare name is what R finds on the default search path, a package's function of that name only once attached */
	const named = (n: Identifier, base: boolean) => Identifier.getName(n) === name && (!base || AttachedBasePackageSet.has(Identifier.getNamespace(n) ?? PkgName.Base));
	const matches = (base: boolean) => (def: typeof DefaultBuiltinConfig[number]) =>
		((def.names as readonly Identifier[]).some(n => named(n, base)) && def.type !== 'constant')
		|| (def.type === 'replacement' && def.suffixes.flatMap(d => def.names.map((n): BrandedIdentifier => `${Identifier.getName(n)}${d}`)).includes(name));
	const fn = (DefaultBuiltinConfig.find(matches(true)) ?? DefaultBuiltinConfig.find(matches(false))) as BuiltInFunctionDefinition<BuiltInProcName.Default | BuiltInProcName.DefaultReadAllArgs> | BuiltInReplacementDefinition | undefined;
	if(fn?.type === 'replacement') {
		return BuiltInProcName.Replacement;
	}
	return fn?.processor === BuiltInProcName.DefaultReadAllArgs ? BuiltInProcName.Default : fn?.processor;
}
