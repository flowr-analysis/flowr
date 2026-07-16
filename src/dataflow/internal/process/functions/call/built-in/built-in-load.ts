import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { DataflowProcessorInformation } from '../../../../../processor';
import type { ControlDependency, DataflowInformation } from '../../../../../info';
import { processKnownFunctionCall } from '../known-call-handling';
import type { InGraphReferenceType } from '../../../../../environments/identifier';
import { ReferenceType } from '../../../../../environments/identifier';
import type { RObjectData } from '../../../../../../project/plugins/file-plugins/files/flowr-rda-file';
import { RDAParser, SexpType } from '../../../../../../project/plugins/file-plugins/files/flowr-rda-file';
import { RType } from '../../../../../../r-bridge/lang-4.x/ast/model/type';
import { removeRQuotes } from '../../../../../../r-bridge/retriever';
import { findSource } from './built-in-source';
import { FlowrTextFile } from '../../../../../../project/context/flowr-file';
import { VertexType } from '../../../../../graph/vertex';
import { RoleInParent } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/role';
import { expensiveTrace } from '../../../../../../util/log';
import { dataflowLogger } from '../../../../../logger';
import { handleUnknownSideEffect } from '../../../../../graph/unknown-side-effect';
import { EdgeType } from '../../../../../graph/edge';
import { unpackArg } from '../argument/unpack-argument';
import { valueSetGuard } from '../../../../../eval/values/general';
import { resolveIdToValue } from '../../../../../eval/resolve/alias-tracking';
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
import {
	EmptyArgument
} from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { bindArgs, resolveArgToEnvir } from './built-in-envir-utils';

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
	const { fileArg, envirArg } = getArguments(args);

	if(!fileArg) {
		const fn = processKnownFunctionCall({ name, args, rootId, data, origin: 'default' });
		handleUnknownSideEffect(fn.information.graph, fn.information.environment, rootId);
		return fn.information;
	}

	const fn = processKnownFunctionCall({ name, args, rootId, data, origin: BuiltInProcName.Load });

	if(data.ctx.config.ignoreLoadCalls) {
		expensiveTrace(dataflowLogger, () => `Skipping load call ${JSON.stringify(fileArg)} (disabled in config file)`);
		handleUnknownSideEffect(fn.information.graph, fn.information.environment, rootId);
		return fn.information;
	}

	const envirResolution = envirArg ? resolveArgToEnvir(envirArg, data) : undefined;
	if(envirResolution) {
		fn.information.graph.addEdge(rootId, envirResolution.envirNodeId, EdgeType.Reads);
	}


	let sourceFile: string[] | undefined;

	if(fileArg.type === RType.String) {
		sourceFile = [removeRQuotes(fileArg.lexeme)];
	} else {
		const resolved = valueSetGuard(resolveIdToValue(fileArg.info.id, { environment: envirResolution ? envirResolution.envirData.environment : data.environment, idMap: data.completeAst.idMap, resolve: data.ctx.config.solver.variables, ctx: data.ctx }));
		sourceFile = resolved?.elements.map(r => r.type === 'string' && isValue(r.value) ? r.value.str : undefined).filter(isNotUndefined);
	}

	if(sourceFile) {
		for(const candidate of sourceFile) {
			const path = removeRQuotes(candidate);
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
				variables = new RDAParser(new FlowrTextFile(filepath), true).parse();
			} catch(e) {
				expensiveTrace(dataflowLogger, () => `Failed to parse RDA file ${JSON.stringify(filepath)}: ${String(e)}`);
				continue;
			}
			if(variables === null || variables.length === 0) {
				return fn.information;
			}

			let envir = envirResolution ? envirResolution.envirData.environment : fn.information.environment;

			const loadLocation = name.location ?? name.fullRange ?? SourceRange.invalid();
			const loadCds = [...(data.cds ?? []), { id: rootId, when: true, file: filepath }];

			for(const variable of variables) {
				if(variable.name) {
					envir = defineLoadedVariable({ ...variable, name: variable.name }, rootId, fn, envir, loadLocation, loadCds, data);
				}
			}

			return { ...fn.information, environment: envir };
		}
	}

	handleUnknownSideEffect(fn.information.graph, fn.information.environment, rootId);
	return fn.information;
}

function defineLoadedVariable<OtherInfo>(
	variable: RObjectData & { name: string },
	rootId: NodeId,
	fn: { information: DataflowInformation },
	envir: REnvironmentInformation,
	loadLocation: SourceRange,
	loadCds: ControlDependency[],
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
): REnvironmentInformation {
	const syntheticId = `${rootId}:loaded:${variable.name}`;
	const isClosure = variable.type === SexpType.CloSxp;
	const rootInfo = data.completeAst.idMap.get(rootId)?.info;

	data.completeAst.idMap.set(syntheticId, {
		type:      RType.Symbol,
		content:   variable.name,
		lexeme:    variable.name,
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
	const newCurrent = envir.current.define(nodeToDefine);
	return { ...envir, current: newCurrent };
}

function defineLoadedClosure<OtherInfo>(
	syntheticId: string,
	variable: RObjectData & { name: string },
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
		lexeme:     variable.name,
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

function sexpTypeToReferenceType(type?: SexpType): ReferenceType{
	if(type === undefined){
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

function getArguments<OtherInfo>(args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[]) {
	const loadParams = ['file', 'envir', 'verbose'] as const;
	const bound = bindArgs(args, loadParams);

	const fileArgBound = bound.get('file');
	const envirArg = bound.get('envir');
	const verboseArgBound = bound.get('verbose');

	const fileArg = fileArgBound && fileArgBound !== EmptyArgument ? unpackArg(fileArgBound) : undefined;
	const verboseArg = verboseArgBound && verboseArgBound !== EmptyArgument ? unpackArg(verboseArgBound) : undefined;

	return { fileArg, envirArg, verboseArg };
}