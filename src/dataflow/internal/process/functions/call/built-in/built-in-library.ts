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
import type { RArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { resolveIdToValue } from '../../../../../eval/resolve/alias-tracking';
import { valueSetGuard } from '../../../../../eval/values/general';
import type { Package } from '../../../../../../project/plugins/package-version-plugins/package';
import { isValue } from '../../../../../eval/values/r-value';

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
	const characterOnlyArg = args.map(v => v as RArgument).find(v => v.lexeme === 'character.only');
	const characterOnly = characterOnlyArg?.value?.type === 'RLogical' && characterOnlyArg?.value?.content === true;
	if(args.length > 2 || args.length === 2 && !characterOnly ){
		dataflowLogger.warn(`Currently only one-arg library-likes are allows (for ${Identifier.toString(name.content)}), skipping`);
		return processKnownFunctionCall({ name, args, rootId, data, hasUnknownSideEffect: true, origin: 'default' }).information;
	}
	const nameToLoad = unpackNonameArg(args[0]);

	if(nameToLoad === undefined || nameToLoad.type !== RType.Symbol && nameToLoad.type !== RType.String){
	//if(nameToLoad === undefined || nameToLoad.type !== RType.Symbol && !characterOnly || characterOnly && nameToLoad.type !== RType.Symbol && nameToLoad.type !== RType.String) {
		dataflowLogger.warn('No library name provided, skipping');
		return processKnownFunctionCall({ name, args, rootId, data, hasUnknownSideEffect: true, origin: 'default' }).information;
	}
	if(Identifier.getNamespace(nameToLoad.type === RType.String ? nameToLoad.content.str : nameToLoad.content) !== undefined) {
		dataflowLogger.warn('Namespaced library names are not supported, ignoring namespace');
	}
	// treat as a function call but convert the first argument to a string
	const newArg: RString<OtherInfo & ParentInformation> = nameToLoad.type === RType.String ? nameToLoad : {
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
	let packetName = nameToLoad?.lexeme;
	//case: character.only = TRUE
	if(characterOnly){
		const resolveArgs = { environment: data.environment, idMap: data.completeAst.idMap, resolve: data.ctx.config.solver.variables, ctx: data.ctx };
		const resolved = valueSetGuard(resolveIdToValue(nameToLoad.info.id, resolveArgs));
		let t = undefined;
		if(resolved?.elements.length === 1 && resolved.elements[0].type === 'string') {
			const r = resolved.elements[0];
			if(isValue(r.value)){
				t = r.value.str;
			}
		}
		if(t){
			packetName = t;
		} else {
			dataflowLogger.warn('Package argument must be character only, skipping');
			return processKnownFunctionCall({ name, args, rootId, data, hasUnknownSideEffect: true, origin: 'default' }).information;
		}
	}
	const dependency = data.ctx.deps.getDependency(packetName);
	linkDependency(dependency, info, rootId, data);
	return info;
}

function linkDependency<OtherInfo>(dependency: Package | undefined, info: DataflowInformation, rootId: NodeId, data: DataflowProcessorInformation<OtherInfo & ParentInformation>){
	if(dependency && dependency.namespaceInfo){
		for(const v of dependency.namespaceInfo.exportedSymbols){
			linkLibraryGlob(v, dependency.name, info, rootId);
		}
		for(const v of dependency.namespaceInfo.importedPackages){
			//problem! we shouldn't always import everything
			const importedDependency = data.ctx.deps.getDependency(v[0]);
			//check whether already loaded, problem also applies here
			//better?: define set loadedDep? in REnv and add to it whenever defining new env for pack
			//const env = info.environment.current;
			/*while(env !== null){
				if(env.n === importedDependency){
					continue;
				}
				env = env.parent;
			}*/
			linkDependency(importedDependency, info, rootId, data);
		}
	}
}

function linkLibraryGlob(func: string, pack: string, info: DataflowInformation, rootId: NodeId): void{
	const globalEnv = getGlobalEnv(info);
	if(isUndefined(globalEnv)){
		return;
	}
	const oldGlobParent = globalEnv.parent;
	let packetEnv = new Environment(oldGlobParent);
	packetEnv.n = pack;
	console.log('before define', packetEnv);
	packetEnv = packetEnv.define({
		name:      Identifier.make(func, pack),
		type:      ReferenceType.Function,
		nodeId:    NodeId.toBuiltIn(func),
		definedAt: NodeId.toBuiltIn(pack),
	});
	console.log('after define', packetEnv);
	globalEnv.parent = packetEnv;
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
	for(let i = 1; i < info.environment.level; i++){
		env = env.parent;
	}
	return env;
}