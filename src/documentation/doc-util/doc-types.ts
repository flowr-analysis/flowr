import * as ts from 'typescript';

/* basics generated */

interface Hierarchy {
	name:     string;
	kind:     'interface' | 'type';
	extends:  string[];
	generics: string[];
}

function getSourceFiles(fileNames: string[]): ts.SourceFile[] {
	try {
		const program = ts.createProgram(fileNames, {});
		return fileNames.map(fileName => program.getSourceFile(fileName)).filter(file => !!file);
	} catch(err) {
		console.error('Failed to get source files', err);
		return [];
	}
}

function collectHierarchyInformation(sourceFiles: ts.SourceFile[]): Hierarchy[] {
	const hierarchyList: Hierarchy[] = [];

	function visit(node: ts.Node, sourceFile: ts.SourceFile) {
		if(!node) {
			return;
		}

		if(ts.isInterfaceDeclaration(node)) {
			const interfaceName = node.name?.getText(sourceFile) ?? '';
			const baseTypes = node.heritageClauses?.flatMap(clause =>
				clause.types.map(type => type.getText(sourceFile) ?? '')
			) || [];
			const generics = node.typeParameters?.map(param => param.getText(sourceFile) ?? '') || [];

			hierarchyList.push({
				name:    interfaceName,
				kind:    'interface',
				extends: baseTypes,
				generics,
			});
		} else if(ts.isTypeAliasDeclaration(node)) {
			const typeName = node.name?.getText(sourceFile) ?? '';

			let baseTypes: string[] = [];
			if(ts.isIntersectionTypeNode(node.type) || ts.isUnionTypeNode(node.type)) {
				baseTypes = node.type.types
					.filter(typeNode => ts.isTypeReferenceNode(typeNode))
					.map(typeNode => (typeNode)?.getText(sourceFile) ?? '');
			} else if(ts.isTypeReferenceNode(node.type)) {
				baseTypes = [node.type.getText(sourceFile) ?? ''];
			}

			const generics = node.typeParameters?.map(param => param.getText(sourceFile) ?? '') || [];

			hierarchyList.push({
				name:    typeName,
				kind:    'type',
				extends: baseTypes,
				generics,
			});
		}

		ts.forEachChild(node, child => visit(child, sourceFile));
	}

	sourceFiles.forEach(sourceFile => {
		visit(sourceFile, sourceFile);
	});

	return hierarchyList;
}

function printHierarchyFromRoot(hierarchyList: Hierarchy[], rootName: string, visited: Set<string> = new Set(), depth: number = 0) {
	if(visited.has(rootName)) {
		return;
	} // Prevent circular references
	visited.add(rootName);

	const node = hierarchyList.find(h => h.name === rootName);
	if(!node) {
		return;
	}

	const indentation = '  '.repeat(depth);
	const genericPart = node.generics.length > 0 ? `<${node.generics.join(', ')}>` : '';
	console.log(`${indentation}${node.kind === 'interface' ? 'Interface' : 'Type'}: ${node.name}${genericPart}`);

	if(node.extends.length > 0) {
		console.log(`${indentation}  Extends: ${node.extends.join(', ')}`);
		node.extends.forEach(baseType => printHierarchyFromRoot(hierarchyList, baseType, visited, depth + 1));
	}
}

/* TODO: support multipile files; TODO: pretty print markdown */
export function getTypesFromFile(fileNames: string[], rootName: string) {
	const sourceFiles = getSourceFiles(fileNames);
	if(sourceFiles) {
		const hierarchyList = collectHierarchyInformation(sourceFiles);
		printHierarchyFromRoot(hierarchyList, rootName);
	}
}
