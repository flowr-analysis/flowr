import { type DataflowProcessorInformation } from '../../../../../processor';
import type { DataflowInformation } from '../../../../../info';
import { processKnownFunctionCall } from '../known-call-handling';
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { PotentiallyEmptyRArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { dataflowLogger } from '../../../../../logger';
import { unpackNonameArg } from '../argument/unpack-argument';
import type { RString } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-string';
import { RType } from '../../../../../../r-bridge/lang-4.x/ast/model/type';
import { wrapArgumentsUnnamed } from '../argument/make-argument';
import { Identifier, ReferenceType } from '../../../../../environments/identifier';
import { BuiltInProcName } from '../../../../../environments/built-in-proc-name';
import { Environment } from '../../../../../environments/environment';
import { EdgeType } from '../../../../../graph/edge';
import { isUndefined } from '../../../../../../util/assert';

/**
 * Process a library call like `library` or `require`
 */
export function processLibrary<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>
): DataflowInformation {
	/* we do not really know what loading the library does and what side effects it causes, hence we mark it as an unknown side effect */
	if(args.length !== 1) {
		dataflowLogger.warn(`Currently only one-arg library-likes are allows (for ${Identifier.toString(name.content)}), skipping`);
		return processKnownFunctionCall({ name, args, rootId, data, hasUnknownSideEffect: true, origin: 'default' }).information;
	}
	const nameToLoad = unpackNonameArg(args[0]);

	if(nameToLoad === undefined || nameToLoad.type !== RType.Symbol) {
		dataflowLogger.warn('No library name provided, skipping');
		return processKnownFunctionCall({ name, args, rootId, data, hasUnknownSideEffect: true, origin: 'default' }).information;
	}
	if(Identifier.getNamespace(nameToLoad.content) !== undefined) {
		dataflowLogger.warn('Namespaced library names are not supported, ignoring namespace');
	}

	// treat as a function call but convert the first argument to a string
	const newArg: RString<OtherInfo & ParentInformation> = {
		type:     RType.String,
		info:     nameToLoad.info,
		lexeme:   nameToLoad.lexeme,
		location: nameToLoad.location,
		content:  {
			quotes: 'none',
			str:    Identifier.getName(nameToLoad.content)
		}
	};
	const info = processKnownFunctionCall({
		name, args:                 wrapArgumentsUnnamed([newArg], data.completeAst.idMap), rootId, data,
		hasUnknownSideEffect: true,
		origin:               BuiltInProcName.Library
	}).information;

	const dependency = data.ctx.deps.getDependency(nameToLoad.lexeme);
	/*if(dependency && dependency.name === 'ggplot2'){
		if(dependency.namespaceInfo?.exportedSymbols.find(v => v === 'ggplot')){
			linkLibraryGlob('ggplot', dependency.name, info, rootId);
		}
	}*/
	if(dependency){
		dependency.namespaceInfo?.exportedSymbols.forEach(v => linkLibraryGlob(v, dependency.name, info, rootId));
	}
	return info;
}

function linkLibraryGlob(func: string, pack: string, info: DataflowInformation, rootId: NodeId): void{
	const globalEnv = getGlobalEnv(info);
	if(isUndefined(globalEnv)){
		return;
	}
	const oldGlobParent = globalEnv.parent;
	let ggplotEnv = new Environment(oldGlobParent);
	ggplotEnv.n = pack;
	ggplotEnv = ggplotEnv.define({
		name:      Identifier.make(func, pack),
		type:      ReferenceType.Function,
		nodeId:    NodeId.toBuiltIn(func),
		definedAt: NodeId.toBuiltIn(pack),
	});
	globalEnv.parent = ggplotEnv;
	info.environment = {
		level:   info.environment.level + 1,
		current: info.environment.current
	};
	info.graph.addEdge(NodeId.toBuiltIn(func), rootId, EdgeType.Reads | EdgeType.Calls);
}

function getGlobalEnv(info: DataflowInformation){
	if(info.environment.level < 0){
		return undefined;
	}
	let env = info.environment.current;
	for(let i = 0; i < info.environment.level; i++){
		env = env.parent;
	}
	return env;
}
/*function linkLibrary(func: string, pack: string, info: DataflowInformation, rootId: NodeId): void{
	// console.log(nameToLoad?.lexeme);g
	// console.log(data.ctx.deps.getDependency(nameToLoad?.lexeme ?? ''))
	const oldParent = info.environment.current.parent;
	let ggplotEnv = new Environment(oldParent);
	ggplotEnv.n = pack;
	ggplotEnv = ggplotEnv.define({
		name:      Identifier.make(func, pack),
		type:      ReferenceType.Function,
		nodeId:    NodeId.toBuiltIn(func),
		definedAt: NodeId.toBuiltIn(pack),
	});
	info.environment.current.parent = ggplotEnv;
	info.environment = {
		level:   info.environment.level + 1,
		current: info.environment.current
	};
	info.graph.addEdge(NodeId.toBuiltIn(func), rootId, EdgeType.Reads);
}*/
