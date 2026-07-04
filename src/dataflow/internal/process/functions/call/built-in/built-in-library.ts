import { type DataflowProcessorInformation } from '../../../../../processor';
import type { DataflowInformation } from '../../../../../info';
import { processKnownFunctionCall } from '../known-call-handling';
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { PotentiallyEmptyRArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { dataflowLogger } from '../../../../../logger';
import type { RString } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-string';
import { RType } from '../../../../../../r-bridge/lang-4.x/ast/model/type';
import { wrapArgumentsUnnamed } from '../argument/make-argument';
import { Identifier, ReferenceType } from '../../../../../environments/identifier';
import { BuiltInProcName } from '../../../../../environments/built-in-proc-name';
import { Environment, EnvType } from '../../../../../environments/environment';
import { EdgeType } from '../../../../../graph/edge';
import { isNotUndefined, isUndefined } from '../../../../../../util/assert';
import { RArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { resolveIdToValue } from '../../../../../eval/resolve/alias-tracking';
import { valueSetGuard } from '../../../../../eval/values/general';
import { Package } from '../../../../../../project/plugins/package-version-plugins/package';
import type { NamespaceInfo } from '../../../../../../project/plugins/file-plugins/files/flowr-namespace-file';
import { convertFnArguments } from '../common';
import { pMatch } from '../../../../linker';
import type { Lift, TernaryLogical } from '../../../../../eval/values/r-value';
import { VertexType } from '../../../../../graph/vertex';
import type { RNode } from '../../../../../../r-bridge/lang-4.x/ast/model/model';

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
	if(args.length === 0){
		return processKnownFunctionCall({ name, args, rootId, data, hasUnknownSideEffect: true, origin: 'default' }).information;
	}
	const params = {
		'package':        'pkg',
		'character.only': 'char'
	};
	const resolveArgs = { environment: data.environment, idMap: data.completeAst.idMap, resolve: data.ctx.config.solver.variables, ctx: data.ctx };
	const argMaps = pMatch(convertFnArguments(args), params);
	const packageId = Array.from(new Set(argMaps.get('pkg')));
	const charId = Array.from(new Set(argMaps.get('char')));

	let namesToLoad = packageId.map(v => RArgument.getValue<OtherInfo & ParentInformation>(args, v)) as RNode<OtherInfo & ParentInformation>[];
	//check if library name provided
	namesToLoad = namesToLoad.filter(v => v !== undefined && (v.type === RType.Symbol ||v.type === RType.String)) ;
	if(namesToLoad.length === 0){
		dataflowLogger.warn('No library name provided, skipping');
		return processKnownFunctionCall({ name, args, rootId, data, hasUnknownSideEffect: true, origin: 'default' }).information;
	}
	for(const nameToLoad of namesToLoad){
		if(nameToLoad !== undefined && (nameToLoad.type === RType.Symbol ||nameToLoad.type === RType.String) && Identifier.getNamespace(nameToLoad.type === RType.String ? nameToLoad.content.str : nameToLoad.content) !== undefined) {
			dataflowLogger.warn('Namespaced library names are not supported, ignoring namespace of library: ', nameToLoad);
		}
	}
	let isCharacterOnly: Lift<TernaryLogical> = false;
	if(charId.length >= 1){
		const values = valueSetGuard(resolveIdToValue(charId[0], resolveArgs));
		if(values?.type === 'set' && values?.elements.length > 0) {
			let hasTrue = 0;
			let hasFalse = 0;
			let hasMaybe = 0;
			for(const elem of values.elements){
				if(elem.type === 'logical'){
					switch(elem.value) {
						case true:
							hasTrue++;
							break;
						case false:
							hasFalse++;
							break;
						default:
							hasMaybe++;
							break;
					}
				}
			}
			if(hasMaybe > 0){
				isCharacterOnly = 'maybe';
			} else if(hasTrue === 0 && hasFalse > 0){
				isCharacterOnly = false;
			} else if(hasTrue > 0 && hasFalse === 0){
				isCharacterOnly = true;
			} else {
				isCharacterOnly = 'maybe';
			}
		}
	}
	const packetName: string[] = [];
	//case: true or maybe
	if(isCharacterOnly){
		for(const nameToLoad of namesToLoad){
			const values = valueSetGuard(resolveIdToValue(nameToLoad.info.id, resolveArgs));
			if(values?.type === 'set' && values.elements.length !== 0){
				for(const elem of values.elements){
					if(elem.type === 'string' && 'str' in elem.value){
						packetName.push(elem.value.str);
					}
				}
			}
		}

	}
	if(!isCharacterOnly || isCharacterOnly === 'maybe'){
		for(const nameToLoad of namesToLoad){
			if(isNotUndefined(nameToLoad.lexeme)){
				packetName.push(nameToLoad.lexeme);
			}
		}
	}
	if(!isCharacterOnly ||isCharacterOnly === 'maybe') {
		// treat as a function call but convert the first argument to a string
		const newArgs = [];
		for(const nameToLoad of namesToLoad){
			if(!(nameToLoad.type === RType.Symbol ||nameToLoad.type === RType.String)){
				continue;
			}
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
			newArgs.push(newArg);
		}
		args =  wrapArgumentsUnnamed([...newArgs, ...args.slice(1)], data.completeAst.idMap);

	}
	const info = processKnownFunctionCall({
		name,
		args, rootId, data,
		hasUnknownSideEffect: false,
		origin:               BuiltInProcName.Library
	}).information;

	for(const p of packetName){
		const dependency = data.ctx.deps.getDependency(p);
		if(dependency){
			linkLibrary(dependency, info, rootId, data);
		} else {
			info.graph.markIdForUnknownSideEffects(rootId);
		}
	}
	if(packetName.length === 0){
		info.graph.markIdForUnknownSideEffects(rootId);
	}
	return info;
}

function linkLibrary<OtherInfo>(dependency: Package, info: DataflowInformation, rootId: NodeId, data: DataflowProcessorInformation<OtherInfo & ParentInformation>) {
	if(info.environment.level < 0|| isUndefined(dependency.namespaceInfo)){
		return;
	}
	const currentEnv = info.environment.current;
	const pack = dependency.name;
	// R attaches a package only once: re-loading an already attached package is a no-op (neither moved nor duplicated)
	if(isAttached(currentEnv, pack)){
		return;
	}
	const functions = dependency.namespaceInfo.callable;

	// the imports layer sits on the current search path, the namespace layer (package exports) on top of it
	let importsEnv = new Environment(currentEnv).asLibrary(pack, EnvType.Imports);
	importsEnv = recImports(importsEnv, dependency.namespaceInfo, data, new Set());

	let namespaceEnv = new Environment(importsEnv).asLibrary(pack, EnvType.Namespace);
	for(const func of functions){
		const builtInId = NodeId.toBuiltIn(Package.funcIdentif(pack, func));
		namespaceEnv = namespaceEnv.define({
			name:      Identifier.make(func, pack),
			type:      ReferenceType.Function,
			nodeId:    builtInId,
			definedAt: NodeId.toBuiltIn(pack),
		});
		info.graph.addVertex({
			tag:         VertexType.FunctionDefinition,
			id:          builtInId,
			environment: info.environment,
			cds:         data.cds,
			params:      {},
			subflow:     {
				graph:             new Set(),
				unknownReferences: [],
				in:                [],
				out:               [],
				environment:       info.environment,
				entryPoint:        builtInId,
				hooks:             []
			},
			exitPoints: [],
		}, data.ctx.env.makeCleanEnv());
		info.graph.addEdge(builtInId, rootId, EdgeType.Reads | EdgeType.Calls);
	}
	info.environment = {
		level:   info.environment.level + 2,
		current: namespaceEnv
	};
}

/** Whether package `pack` is already on the current search path, i.e. among the leading library layers (see {@link EnvType}). */
function isAttached(env: Environment, pack: string): boolean {
	for(let e: Environment | undefined = env; e !== undefined && e.t !== undefined && !e.builtInEnv; e = e.parent){
		if(e.n === pack){
			return true;
		}
	}
	return false;
}

function recImports<OtherInfo>(importsEnv: Environment, namespaceInfo: NamespaceInfo, data: DataflowProcessorInformation<OtherInfo & ParentInformation>, alreadyImportedAll: Set<string>){
	for(const imp of namespaceInfo.importedPackages){
		const importedDependency = data.ctx.deps.getDependency(imp[0]);
		if(isUndefined(importedDependency)){
			continue;
		}
		const funcToImport: string[] | undefined = imp[1] === 'all' ? importedDependency?.namespaceInfo?.callable : importedDependency?.namespaceInfo?.callable.filter(v => (imp[1] as string[]).includes(v));
		if(isUndefined(funcToImport)){
			continue;
		}
		if(alreadyImportedAll.has(importedDependency.name)){
			continue;
		}
		for(const func of funcToImport){
			if(importsEnv.memory.has(Package.funcIdentif(importedDependency.name, func))){
				continue;
			}
			importsEnv = importsEnv.define({
				name:      Identifier.make(Package.funcIdentif(importedDependency.name, func), importsEnv.n),
				type:      ReferenceType.Function,
				nodeId:    NodeId.toBuiltIn(Package.funcIdentif(importedDependency.name, func)),
				definedAt: NodeId.toBuiltIn(importedDependency.name)
			});
		}
		if(imp[1] === 'all'){
			alreadyImportedAll.add(importedDependency.name);
		}
		//if only importFrom() we don't have to recursively import
		if(imp[1] === 'all' && importedDependency?.namespaceInfo){
			importsEnv = recImports(importsEnv, importedDependency.namespaceInfo, data, alreadyImportedAll);
		}
	}
	return importsEnv;
}