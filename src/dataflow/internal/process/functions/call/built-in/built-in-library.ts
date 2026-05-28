import { type DataflowProcessorInformation } from '../../../../../processor';
import type { DataflowInformation } from '../../../../../info';
import { processKnownFunctionCall } from '../known-call-handling';
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { PotentiallyEmptyRArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { dataflowLogger } from '../../../../../logger';
import { unpackArg } from '../argument/unpack-argument';
import type { RString } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-string';
import { RType } from '../../../../../../r-bridge/lang-4.x/ast/model/type';
import { wrapArgumentsUnnamed } from '../argument/make-argument';
import { Identifier, ReferenceType } from '../../../../../environments/identifier';
import { BuiltInProcName } from '../../../../../environments/built-in-proc-name';
import { Environment } from '../../../../../environments/environment';
import { EdgeType } from '../../../../../graph/edge';
import { isUndefined } from '../../../../../../util/assert';
import { RArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { resolveIdToValue } from '../../../../../eval/resolve/alias-tracking';
import { valueSetGuard } from '../../../../../eval/values/general';
import type { Package } from '../../../../../../project/plugins/package-version-plugins/package';
import type { NamespaceInfo } from '../../../../../../project/plugins/file-plugins/files/flowr-namespace-file';
import { convertFnArguments } from '../common';
import { pMatch } from '../../../../linker';

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
	//const characterOnlyArg = args.map(v => v as RArgument).find(v => v.lexeme === 'character.only');
	//const characterOnly = characterOnlyArg?.value?.type === 'RLogical' && characterOnlyArg?.value?.content === true;
	if(args.length === 0){
		return processKnownFunctionCall({ name, args, rootId, data, hasUnknownSideEffect: true, origin: 'default' }).information;
	}
	const params = {
		'package':        'pkg',
		'character.only': 'char'
	};
	const resolveArgs = { environment: data.environment, idMap: data.completeAst.idMap, resolve: data.ctx.config.solver.variables, ctx: data.ctx };
	const argMaps = pMatch(convertFnArguments(args), params);
	const packageId = new Set(argMaps.get('pkg'));
	const charId = new Set(argMaps.get('char'));

	const nameToLoad = unpackArg(RArgument.getWithId(args, argMaps.get('pkg')?.[0]));//unpackNonameArg(args[0]);

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
	let isCharacterOnly;
	if(charId.size === 1){
		const values = valueSetGuard(resolveIdToValue(charId.keys().toArray()[0], resolveArgs));
		if(values?.type === 'set' && values.elements.length !== 0){
			if(values.elements[0].type === 'logical'){
				isCharacterOnly =  values.elements[0].value;
			}
		}
	}
	//case: character.only = TRUE
	if(isCharacterOnly){
		const values = valueSetGuard(resolveIdToValue(packageId.keys().toArray()[0], resolveArgs));
		if(values?.type === 'set' && values.elements.length !== 0){
			if(values.elements[0].type === 'string' && 'str' in values.elements[0].value){
				packetName =  values.elements[0].value.str;
			}
		}
		//else fälle?
	}
	/*if(characterOnly){
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
	}*/
	const dependency = data.ctx.deps.getDependency(packetName);
	if(dependency){
		linkLibrary(dependency, info, rootId, data);
	}
	return info;
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

function linkLibrary<OtherInfo>(dependency: Package, info: DataflowInformation, rootId: NodeId, data: DataflowProcessorInformation<OtherInfo & ParentInformation>) {
	const globalEnv = getGlobalEnv(info);
	if(isUndefined(globalEnv) || isUndefined(dependency.namespaceInfo)){
		return;
	}
	const pack = dependency.name;
	const functions = dependency.namespaceInfo.exportedSymbols;
	//add namespace environment
	let namespaceEnv = new Environment(globalEnv);
	namespaceEnv.n = pack;
	namespaceEnv.t = 'namespace';
	for(const func of functions){
		namespaceEnv = namespaceEnv.define({
			name:      Identifier.make(func, pack),
			type:      ReferenceType.Function,
			nodeId:    NodeId.toBuiltIn(func),
			definedAt: NodeId.toBuiltIn(pack),
		});
		info.graph.addEdge(NodeId.toBuiltIn(func), rootId, EdgeType.Reads | EdgeType.Calls);
	}
	info.environment = {
		level:   info.environment.level + 1,
		current: namespaceEnv
	};
	//add package environment
	const oldGlobParent = globalEnv.parent;
	let packageEnv = new Environment(oldGlobParent);
	packageEnv.n = pack;
	packageEnv.t = 'package';
	for(const func of functions){
		packageEnv = packageEnv.define({
			name:      Identifier.make(func, pack),
			type:      ReferenceType.Function,
			nodeId:    NodeId.toBuiltIn(func),
			definedAt: namespaceEnv.id,
		});
	}
	globalEnv.parent = packageEnv;
	info.environment = {
		level:   info.environment.level + 1,
		current: info.environment.current
	};
	//add imports environment
	let importsEnv: Environment |undefined = new Environment(globalEnv);
	importsEnv.n = pack;
	importsEnv.t = 'imports';
	importsEnv = recImports(importsEnv, dependency.namespaceInfo, data, new Set());
	if(importsEnv){
		info.environment = {
			level:   info.environment.level + 1,
			current: info.environment.current
		};
		namespaceEnv.parent = importsEnv;
	}
}

function recImports<OtherInfo>(importsEnv: Environment, namespaceInfo: NamespaceInfo, data: DataflowProcessorInformation<OtherInfo & ParentInformation>, alreadyImportedAll: Set<string>){
	for(const imp of namespaceInfo.importedPackages){
		const importedDependency = data.ctx.deps.getDependency(imp[0]);
		if(isUndefined(importedDependency)){
			continue;
		}
		const funcToImport: string[] | undefined = imp[1] === 'all' ? importedDependency?.namespaceInfo?.exportedSymbols : importedDependency?.namespaceInfo?.exportedSymbols.filter(v => (imp[1] as string[]).includes(v));
		if(isUndefined(funcToImport)){
			continue;
		}
		if(alreadyImportedAll.has(importedDependency.name)){
			continue;
		}
		for(const func of funcToImport){
			if(importsEnv.memory.has(importedDependency.name + ':' + func)){
				continue;
			}
			importsEnv = importsEnv.define({
				name:      Identifier.make(importedDependency.name + ':' + func, importsEnv.n),
				type:      ReferenceType.Function,
				nodeId:    NodeId.toBuiltIn(func),
				definedAt: NodeId.toBuiltIn(importedDependency.name)
			});
		}
		if(imp[1] === 'all'){
			alreadyImportedAll.add(importedDependency.name);
		}
		//info.graph.addEdge(rootId, NodeId.toBuiltIn((importedDependency as Package).name), EdgeType.Reads | EdgeType.Calls);
		if(importedDependency?.namespaceInfo){
			importsEnv = recImports(importsEnv, importedDependency.namespaceInfo, data, alreadyImportedAll);
		}
	}
	return importsEnv;
}