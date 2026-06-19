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
import { isUndefined } from '../../../../../../util/assert';
import { RArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { resolveIdToValue } from '../../../../../eval/resolve/alias-tracking';
import { valueSetGuard } from '../../../../../eval/values/general';
import { Package } from '../../../../../../project/plugins/package-version-plugins/package';
import type { NamespaceInfo } from '../../../../../../project/plugins/file-plugins/files/flowr-namespace-file';
import { convertFnArguments } from '../common';
import { pMatch } from '../../../../linker';
import type { Lift, TernaryLogical } from '../../../../../eval/values/r-value';
import { VertexType } from '../../../../../graph/vertex';

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

	const nameToLoad = RArgument.getValue<OtherInfo & ParentInformation>(args, packageId[0]);

	if(nameToLoad === undefined || nameToLoad.type !== RType.Symbol && nameToLoad.type !== RType.String){
		dataflowLogger.warn('No library name provided, skipping');
		return processKnownFunctionCall({ name, args, rootId, data, hasUnknownSideEffect: true, origin: 'default' }).information;
	}
	if(Identifier.getNamespace(nameToLoad.type === RType.String ? nameToLoad.content.str : nameToLoad.content) !== undefined) {
		dataflowLogger.warn('Namespaced library names are not supported, ignoring namespace');
	}

	let packetName = nameToLoad?.lexeme;
	let isCharacterOnly: Lift<TernaryLogical> = false;
	if(charId.length >= 1){
		const values = valueSetGuard(resolveIdToValue(charId[0], resolveArgs));
		if(values?.type === 'set' && values.elements.length === 1 && values.elements[0].type === 'logical') {
			isCharacterOnly = values.elements[0].value;
		}
	}
	if(isCharacterOnly !== false){
		const values = valueSetGuard(resolveIdToValue(nameToLoad.info.id, resolveArgs));
		if(values?.type === 'set' && values.elements.length !== 0){
			if(values.elements[0].type === 'string' && 'str' in values.elements[0].value){
				packetName =  values.elements[0].value.str;
			}
		}
	} else {
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
		args =  wrapArgumentsUnnamed([newArg, ...args.slice(1)], data.completeAst.idMap);
	}
	const info = processKnownFunctionCall({
		name,
		args, rootId, data,
		hasUnknownSideEffect: false,
		origin:               BuiltInProcName.Library
	}).information;
	const dependency = data.ctx.deps.getDependency(packetName);
	if(dependency){
		linkLibrary(dependency, info, rootId, data);
	} else {
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
	const functions = dependency.namespaceInfo.callable;

	//add package environment
	let namespaceEnv = new Environment(currentEnv);
	namespaceEnv.n = pack;
	namespaceEnv.t = EnvType.Namespace;
	for(const func of functions){
		namespaceEnv = namespaceEnv.define({
			name:      Identifier.make(func, pack),
			type:      ReferenceType.Function,
			nodeId:    NodeId.toBuiltIn(func),
			definedAt: NodeId.toBuiltIn(pack),
		});
		info.graph.addVertex({
			tag:         VertexType.FunctionDefinition,
			id:          NodeId.toBuiltIn(func),
			environment: info.environment,
			cds:         data.cds,
			params:      {},
			subflow:     {
				graph:             new Set(),
				unknownReferences: [],
				in:                [],
				out:               [],
				environment:       info.environment,
				entryPoint:        NodeId.toBuiltIn(func),
				hooks:             []
			},
			exitPoints: [],
		}, data.ctx.env.makeCleanEnv());
		info.graph.addEdge(NodeId.toBuiltIn(func), rootId, EdgeType.Reads | EdgeType.Calls);
	}
	info.environment = {
		level:   info.environment.level + 1,
		current: namespaceEnv
	};
	//add imports environment
	let importsEnv: Environment = new Environment(currentEnv);
	importsEnv.n = pack;
	importsEnv.t = EnvType.Imports;
	importsEnv = recImports(importsEnv, dependency.namespaceInfo, data, new Set());

	info.environment = {
		level:   info.environment.level + 1,
		current: info.environment.current
	};
	namespaceEnv.parent = importsEnv;
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
			if(importsEnv.memory.has(Package.createImpFunc(importedDependency.name, func))){
				continue;
			}
			importsEnv = importsEnv.define({
				name:      Identifier.make(Package.createImpFunc(importedDependency.name, func), importsEnv.n),
				type:      ReferenceType.Function,
				nodeId:    NodeId.toBuiltIn(func),
				definedAt: NodeId.toBuiltIn(importedDependency.name)
			});
		}
		if(imp[1] === 'all'){
			alreadyImportedAll.add(importedDependency.name);
		}
		//info.graph.addEdge(rootId, NodeId.toBuiltIn((importedDependency as Package).name), EdgeType.Reads | EdgeType.Calls);
		//if only importFrom() we don't have to recursively import
		if(imp[1] === 'all' && importedDependency?.namespaceInfo){
			importsEnv = recImports(importsEnv, importedDependency.namespaceInfo, data, alreadyImportedAll);
		}
	}
	return importsEnv;
}