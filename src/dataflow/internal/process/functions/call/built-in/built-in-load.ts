import { RArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { Resolve } from '../../../../../environments/resolve-helper';
import { AmbientStateName } from '../../../../../environments/ambient-state-name';
import { happensInEveryBranch } from '../../../../../info';
import { RFunctionCall, EmptyArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { FunctionSemantics } from '../../../../../fn/function-semantics';
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { DataflowProcessorInformation } from '../../../../../processor';
import type { ControlDependency, DataflowInformation } from '../../../../../info';
import { processKnownFunctionCall } from '../known-call-handling';
import type { NamedInGraphIdentifierDefinition, BrandedIdentifier, InGraphReferenceType } from '../../../../../environments/identifier';
import { Identifier, PkgName, ReferenceType } from '../../../../../environments/identifier';
import type { RObjectData } from '../../../../../../project/plugins/file-plugins/files/flowr-rda-file';
import { FlowrRDAFile, SexpType } from '../../../../../../project/plugins/file-plugins/files/flowr-rda-file';
import { RType } from '../../../../../../r-bridge/lang-4.x/ast/model/type';
import { findSource } from './built-in-source';
import { VertexType } from '../../../../../graph/vertex';
import { RoleInParent } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/role';
import { dataflowLogger } from '../../../../../logger';
import { handleUnknownSideEffect } from '../../../../../graph/unknown-side-effect';
import { EdgeType } from '../../../../../graph/edge';
import { NodeValue } from '../../../../../eval/resolve/node-value';
import { isValue } from '../../../../../eval/values/r-value';
import { isNotUndefined } from '../../../../../../util/assert';
import type { REnvironmentInformation } from '../../../../../environments/environment';
import { SourceRange } from '../../../../../../util/range';
import type { RExpressionList } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-expression-list';
import type { DataflowFunctionFlowInformation } from '../../../../../graph/graph';
import { BuiltInProcName } from '../../../../../environments/built-in-proc-name';
import type {
	PotentiallyEmptyRArgument
} from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { envirOf, resolveArgToEnvirOrAmbiguous, routeWrittenToEnvir, signatureParamNames, type EnvirResolution } from './built-in-envir-utils';
import { RString } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-string';

/**
 * Processes a built-in 'load' function call by retrieving the names of the variables loaded by the given file.
 * Example: `load(test.rda)` with two variables 'x' and 'y'. processLoadCall adds 'x' and 'y' to the dataflow graph and
 * adds control dependencies between the variables and the loaded file.
 */
export function processLoadCall<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
): DataflowInformation {
	const { fileArg, envirArg } = loadArgsOf(args, data);

	if(!fileArg) {
		const fn = processKnownFunctionCall({ name, args, rootId, data, origin: 'default' });
		handleUnknownSideEffect(fn.information.graph, fn.information.environment, rootId);
		return fn.information;
	}

	const fn = processKnownFunctionCall({ name, args, rootId, data, origin: BuiltInProcName.Load });

	if(data.ctx.config.ignoreLoadCalls) {
		dataflowLogger.warn(`Skipping load call ${JSON.stringify(fileArg)} (disabled in config file)`);
		handleUnknownSideEffect(fn.information.graph, fn.information.environment, rootId);
		return fn.information;
	}

	const envirResolution = envirArg ? envirOf(resolveArgToEnvirOrAmbiguous(envirArg, data)) : undefined;
	if(envirResolution) {
		fn.information.graph.addEdge(rootId, envirResolution.envirNodeId, EdgeType.Reads);
	}

	let sourceFile: string[] | undefined;

	if(RString.is(fileArg)) {
		sourceFile = [RString.unquote(fileArg.lexeme)];
	} else {
		const resolved = NodeValue.setOf(fileArg.info.id, data, { environment: envirResolution?.envirData.environment ?? data.environment });
		sourceFile = resolved?.elements.map(r => r.type === 'string' && isValue(r.value) ? r.value.str : undefined).filter(isNotUndefined);
	}

	if(sourceFile) {
		for(const candidate of sourceFile) {
			const path = RString.unquote(candidate);
			let filepath = path ? findSource(data.ctx.config.solver.resolveSource, path, data) : path;

			if(Array.isArray(filepath)) {
				if(filepath.length > 1) {
					dataflowLogger.warn(`Found multiple candidate files for load(${JSON.stringify(path)}): ${JSON.stringify(filepath)}, using first match`);
				}
				filepath = filepath.find(isNotUndefined);
			}

			if(filepath === undefined) {
				continue;
			}

			let variables: RObjectData[] | null;
			try {
				const file = data.ctx.files.resolveFile(filepath);
				variables = file instanceof FlowrRDAFile ? file.content() : null;
			} catch(e) {
				dataflowLogger.warn(`Failed to parse RDA file ${JSON.stringify(filepath)}: ${String(e)}`);
				continue;
			}
			if(variables === null) {
				dataflowLogger.warn(`Could not read ${JSON.stringify(filepath)} as an RDA file, treating the load as unknown`);
				continue;
			}
			if(variables.length === 0) {
				return fn.information;
			}

			const named = variables.filter((v): v is RObjectData & { name: BrandedIdentifier } => v.name !== undefined);
			return withLoaded(named, rootId, fn, [...(data.cds ?? []), { id: rootId, when: true, file: filepath }], data, envirResolution);
		}
		/* a file the program saves itself holds the variables it saved */
		const saved = savedInto(sourceFile, data);
		if(saved !== undefined) {
			const loaded = withLoaded(saved.names.map(n => ({ name: n })), rootId, fn, [...(data.cds ?? []), { id: rootId, when: true }], data, envirResolution);
			if(!saved.complete) {
				handleUnknownSideEffect(loaded.graph, loaded.environment, rootId);
			}
			return loaded;
		}
	}

	handleUnknownSideEffect(fn.information.graph, fn.information.environment, rootId);
	return fn.information;
}

/**
 * The variables the `save()` calls that wrote the files at `paths` stored, and whether that is all the files may hold
 * (every writer surely ran, so no older content remains); `undefined` if another call may have written them or a
 * name is unknown.
 */
function savedInto<OtherInfo>(paths: readonly string[], data: DataflowProcessorInformation<OtherInfo & ParentInformation>): { names: BrandedIdentifier[], complete: boolean } | undefined {
	const names = new Set<BrandedIdentifier>();
	let complete = true;
	for(const path of paths) {
		const stem = RString.unquote(path).split(/[/\\]/).at(-1)?.split('.')[0];
		const writers = stem ? Resolve.byName(AmbientStateName.file(stem), data.environment) : undefined;
		if(writers === undefined || writers.length === 0) {
			return undefined;
		}
		for(const writer of writers) {
			const call = data.completeAst.idMap.get(writer.nodeId);
			const stored = RFunctionCall.isNamed(call, 'save') ? namesSavedBy(call.arguments, data) : undefined;
			if(stored === undefined) {
				return undefined;
			}
			stored.forEach(n => names.add(n));
			complete &&= happensInEveryBranch(writer.cds);
		}
	}
	return { names: [...names], complete };
}

/** The variables `save(...)` names: its unnamed symbols and strings, and the strings `list` holds; `undefined` if one is unknown. */
function namesSavedBy<OtherInfo>(args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[], data: DataflowProcessorInformation<OtherInfo & ParentInformation>): BrandedIdentifier[] | undefined {
	const names: BrandedIdentifier[] = [];
	for(const arg of args) {
		if(arg === EmptyArgument || arg.value === undefined) {
			continue;
		}
		const named = arg.name === undefined ? undefined : Identifier.getName(arg.name.content);
		if(named === 'list') {
			const listed = NodeValue.stringsOf(arg.value.info.id, data);
			if(listed === undefined) {
				return undefined;
			}
			names.push(...listed);
		} else if(named === undefined) {
			if(RSymbol.is(arg.value)) {
				names.push(Identifier.getName(arg.value.content));
			} else if(RString.is(arg.value)) {
				names.push(arg.value.content.str);
			} else {
				return undefined;
			}
		}
	}
	return names;
}

/**
 * The load call `rootId` with the `variables` it restores defined, in the caller's frame or, given `envir`, in the
 * environment it names (routed there like any other write into it, so the caller keeps its own bindings).
 */
function withLoaded<OtherInfo>(
	variables: readonly (RObjectData & { name: BrandedIdentifier })[],
	rootId: NodeId,
	fn: { information: DataflowInformation },
	loadCds: ControlDependency[],
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	envir: EnvirResolution<OtherInfo> | undefined
): DataflowInformation {
	const location = data.completeAst.idMap.get(rootId)?.location ?? SourceRange.invalid();
	let environment = fn.information.environment;
	const out = [...fn.information.out];
	for(const variable of variables) {
		const [next, defined] = defineLoadedVariable(variable, rootId, fn, environment, location, loadCds, data);
		environment = next;
		out.push(defined);
	}
	const result = { ...fn.information, environment, out };
	return envir === undefined ? result : routeWrittenToEnvir(result, envir, rootId, data.environment, rootId);
}

function defineLoadedVariable<OtherInfo>(
	variable: RObjectData & { name: BrandedIdentifier },
	rootId: NodeId,
	fn: { information: DataflowInformation },
	envir: REnvironmentInformation,
	loadLocation: SourceRange,
	loadCds: ControlDependency[],
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
): [REnvironmentInformation, NamedInGraphIdentifierDefinition<BrandedIdentifier>] {
	const syntheticId = `${rootId}:loaded:${variable.name}`;
	const isClosure = variable.type === SexpType.CloSxp;
	const rootInfo = data.completeAst.idMap.get(rootId)?.info;

	data.completeAst.idMap.set(syntheticId, {
		type:      RType.Symbol,
		content:   variable.name,
		lexeme:    String(variable.name),
		location:  loadLocation,
		namespace: undefined,
		info:      {
			...rootInfo,
			id:     syntheticId,
			parent: rootId,
			role:   RoleInParent.ExpressionListChild,
		} as OtherInfo & ParentInformation
	});

	if(isClosure) {
		defineLoadedClosure(syntheticId, variable, fn, envir, loadLocation, loadCds, data, rootInfo);
	} else {
		fn.information.graph.addVertex({
			tag: VertexType.VariableDefinition,
			id:  syntheticId,
			cds: loadCds,
		}, envir);
	}

	const nodeToDefine = {
		nodeId:    syntheticId,
		name:      variable.name,
		type:      sexpTypeToReferenceType(variable.type) as InGraphReferenceType,
		definedAt: rootId,
		cds:       loadCds,
	};
	return [{ ...envir, current: envir.current.define(nodeToDefine) }, nodeToDefine];
}

function defineLoadedClosure<OtherInfo>(
	syntheticId: NodeId,
	variable: RObjectData & { name: BrandedIdentifier },
	fn: { information: DataflowInformation },
	envir: REnvironmentInformation,
	loadLocation: SourceRange,
	loadCds: ControlDependency[],
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	rootInfo: (OtherInfo & ParentInformation) | undefined,
): void {
	const fdefId = `${syntheticId}:fdef`;
	const cleanEnv = data.ctx.env.makeCleanEnv();
	const bodyId = `${fdefId}:body`;

	const body: RExpressionList<OtherInfo & ParentInformation> = {
		type:     RType.ExpressionList,
		lexeme:   undefined,
		grouping: undefined,
		children: [],
		location: loadLocation,
		info:     {
			...rootInfo,
			id:     bodyId,
			parent: fdefId,
			role:   RoleInParent.FunctionDefinitionBody,
		} as OtherInfo & ParentInformation
	};

	data.completeAst.idMap.set(bodyId, body);

	data.completeAst.idMap.set(fdefId, {
		type:       RType.FunctionDefinition,
		parameters: [],
		lexeme:     String(variable.name),
		location:   loadLocation,
		body,
		info:       {
			...rootInfo,
			id:     fdefId,
			parent: syntheticId,
			role:   RoleInParent.ExpressionListChild,
		} as OtherInfo & ParentInformation
	});

	const flow: DataflowFunctionFlowInformation = {
		entryPoint:        fdefId,
		graph:             new Set(),
		out:               [],
		in:                [],
		unknownReferences: [],
		hooks:             [],
		environment:       cleanEnv
	};

	fn.information.graph.addVertex({
		tag:         VertexType.FunctionDefinition,
		id:          fdefId,
		cds:         loadCds,
		environment: cleanEnv,
		subflow:     flow,
		exitPoints:  [],
		params:      {},
	}, cleanEnv);

	fn.information.graph.addVertex({
		tag: VertexType.VariableDefinition,
		id:  syntheticId,
		cds: loadCds,
	}, envir);

	fn.information.graph.addEdge(syntheticId, fdefId, EdgeType.DefinedBy);
}

/** The kind of reference a serialized R object stands for, from the {@link SexpType} it was stored as. */
export function sexpTypeToReferenceType(type?: SexpType): ReferenceType {
	if(type === undefined) {
		return ReferenceType.Unknown;
	}
	switch(type) {
		case SexpType.NilSxp:
			return ReferenceType.Unknown;
		case SexpType.SymSxp:
		case SexpType.CharSxp:
		case SexpType.LglSxp:
		case SexpType.IntSxp:
		case SexpType.RealSxp:
		case SexpType.CplxSxp:
		case SexpType.StrSxp:
		case SexpType.RawSxp:
		case SexpType.ListSxp:
		case SexpType.EnvSxp:
		case SexpType.PromSxp:
		case SexpType.LangSxp:
		case SexpType.DotSxp:
		case SexpType.VecSxp:
		case SexpType.ExprSxp:
		case SexpType.ObjSxp:
			return ReferenceType.Variable;
		case SexpType.CloSxp:
			return ReferenceType.Function;
		case SexpType.SpecialSxp:
		case SexpType.BuiltInSxp:
			return ReferenceType.BuiltInFunction;
		default:
			return ReferenceType.Unknown;
	}
}

function loadArgsOf<OtherInfo>(args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[], data: DataflowProcessorInformation<OtherInfo & ParentInformation>) {
	// prefer R's real `base::load` signature from the database, falling back to the known formals when it is absent
	const loadParams = signatureParamNames(data, Identifier.make('load', PkgName.Base), ['file', 'envir', 'verbose']);
	const bound = FunctionSemantics.call.match.toNames(args, loadParams);

	const fileArgBound = bound.get('file');
	const envirArg = bound.get('envir');
	const verboseArgBound = bound.get('verbose');

	const fileArg = fileArgBound ? RArgument.valueOf(fileArgBound) : undefined;
	const verboseArg = verboseArgBound ? RArgument.valueOf(verboseArgBound) : undefined;

	return { fileArg, envirArg, verboseArg };
}