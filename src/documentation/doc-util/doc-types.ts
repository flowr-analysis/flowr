import * as ts from 'typescript';
import {guard} from "../../util/assert";
import {RemoteFlowrFilePathBaseRef} from "./doc-files";
import fs from "fs";
import path from "path";

/* basics generated */

interface Hierarchy {
	name:     string;
	kind:     'interface' | 'type';
	extends:  string[];
	generics: string[];
	filePath: string;
	lineNumber: number;
	comments?: string[];
	readonly properties?: string[];
}

function getSourceFiles(fileNames: readonly string[]): ts.SourceFile[] {
	try {
		const program = ts.createProgram(fileNames, {});
		return fileNames.map(fileName => program.getSourceFile(fileName)).filter(file => !!file);
	} catch(err) {
		console.error('Failed to get source files', err);
		return [];
	}
}

function dropGenericsFromType(type: string): string {
	return type.replace(/<.*>/, '');
}

function getTextualComments(node: ts.Node): string[] {
	const comments = ts.getJSDocCommentsAndTags(node);
	let out: string[] = []
	for(const { comment } of comments) {
		/* we may support others in the future */
		if(typeof comment === 'string') {
			out.push(comment);
		}
	}
	return out;
}

function getStartLine(node: ts.Node, sourceFile: ts.SourceFile): number {
	const lineStart = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line;
	return lineStart + 1;
}

function collectHierarchyInformation(sourceFiles: readonly ts.SourceFile[]): Hierarchy[] {
	const hierarchyList: Hierarchy[] = [];

	const visit = (node: ts.Node | undefined, sourceFile: ts.SourceFile) => {
		if(!node) {
			return;
		}

		if(ts.isInterfaceDeclaration(node)) {
			const interfaceName = node.name?.getText(sourceFile) ?? '';
			const baseTypes = node.heritageClauses?.flatMap(clause =>
				clause.types
					.map(type => type.getText(sourceFile) ?? '')
					.map(dropGenericsFromType)
			) ?? [];
			const generics = node.typeParameters?.map(param => param.getText(sourceFile) ?? '') || [];

			hierarchyList.push({
				name:    dropGenericsFromType(interfaceName),
				kind:    'interface',
				extends: baseTypes,
				generics,
				comments: getTextualComments(node),
				filePath: sourceFile.fileName,
				lineNumber: getStartLine(node, sourceFile),
				properties: node.members.map(member => member.name?.getText(sourceFile) ?? ''),
			});
		} else if(ts.isTypeAliasDeclaration(node)) {
			const typeName = node.name?.getText(sourceFile) ?? '';

			let baseTypes: string[] = [];
			if(ts.isIntersectionTypeNode(node.type) || ts.isUnionTypeNode(node.type)) {
				baseTypes = node.type.types
					.filter(typeNode => ts.isTypeReferenceNode(typeNode))
					.map(typeNode => (typeNode)?.getText(sourceFile) ?? '')
					.map(dropGenericsFromType);
			} else if(ts.isTypeReferenceNode(node.type)) {
				baseTypes = [node.type.getText(sourceFile) ?? ''];
			}

			const generics = node.typeParameters?.map(param => param.getText(sourceFile) ?? '') ?? [];

			hierarchyList.push({
				name:    dropGenericsFromType(typeName),
				kind:    'type',
				extends: baseTypes,
				generics,
				filePath: sourceFile.fileName,
				lineNumber: getStartLine(node, sourceFile),
			});
		}

		ts.forEachChild(node, child => visit(child, sourceFile));
	}

	sourceFiles.forEach(sourceFile => {
		visit(sourceFile, sourceFile);
	});

	return hierarchyList;
}

interface MermaidCompact {
	nodeLines: string[]
	edgeLines: string[]
}

function getFileLink(filePath: string, startLine: number): string {
	const fromSource = filePath.replace(/^.*\/src\//, 'src/');
	return `${RemoteFlowrFilePathBaseRef}/${fromSource}#L${startLine}`;
}

function generateMermaidClassDiagram(hierarchyList: readonly Hierarchy[], rootName: string, options: GetTypesAsMermaidOption, visited: Set<string> = new Set()): MermaidCompact {
	const collect: MermaidCompact = { nodeLines: [], edgeLines: [] };
	if(visited.has(rootName)) {
		return collect;
	} // Prevent circular references
	visited.add(rootName);

	const node = hierarchyList.find(h => h.name === rootName);
	if(!node) {
		return collect;
	}

	const genericPart = node.generics.length > 0 ? `~${node.generics.join(', ')}~` : '';
	for(const comment of node.comments ?? []) {
		// TODO: comments
		collect.nodeLines.push(`%% ${comment}`);
	}
	collect.nodeLines.push(`class ${node.name}${genericPart}`);
	collect.nodeLines.push(`    <<${node.kind}>> ${node.name}`);
	if(node.kind === 'type') {
		collect.nodeLines.push(`style ${node.name} fill:#FAFAFA,stroke:#333`);
	}
	let writtenProperties = new Set<string>();
	if(node.properties) {
		for(const property of node.properties) {
			collect.nodeLines.push(`    ${node.name} : ${property}`);
			writtenProperties.add(property);
		}
	}
	collect.nodeLines.push(`click ${node.name} href "${getFileLink(node.filePath, node.lineNumber)}" "${node.comments?.join('; ') ?? ''}"`);

	if(node.extends.length > 0) {
		for(const baseType of node.extends) {
			if(options.inlineTypes?.includes(baseType)) {
				const info = hierarchyList.find(h => h.name === baseType);
				for(const property of info?.properties ?? []) {
					if(!writtenProperties.has(property)) {
						collect.nodeLines.push(`    ${node.name} : ${property} [from ${baseType}]`);
						writtenProperties.add(property);
					}
				}
			} else {
				if (node.kind === 'type' || hierarchyList.find(h => h.name === baseType)?.kind === 'type') {
					collect.edgeLines.push(`${baseType} .. ${node.name}`);
				} else {
					collect.edgeLines.push(`${baseType} <|-- ${node.name}`);
				}
				const {nodeLines, edgeLines} = generateMermaidClassDiagram(hierarchyList, baseType, options, visited);
				collect.nodeLines.push(...nodeLines);
				collect.edgeLines.push(...edgeLines);
			}
		}
	}
	return collect;
}

function visualizeMermaidClassDiagram(hierarchyList: readonly Hierarchy[], options: GetTypesAsMermaidOption) {
	const { nodeLines, edgeLines } = generateMermaidClassDiagram(hierarchyList, options.typeName, options);
	return `
classDiagram
direction RL
${nodeLines.join('\n')}
${edgeLines.join('\n')}
`;
}

/* TODO: fetch attached comments */
function getTypesFromFileAsMermaid(fileNames: string[], options: GetTypesAsMermaidOption): string {
	const sourceFiles = getSourceFiles(fileNames);
	guard(sourceFiles !== undefined, 'No source files found');
	const hierarchyList = collectHierarchyInformation(sourceFiles);
	return visualizeMermaidClassDiagram(hierarchyList, options);
}

export interface GetTypesAsMermaidOption {
	readonly rootFolder: string;
	readonly typeName: string;
	readonly inlineTypes?: readonly string[]
}

export function getTypesFromFolderAsMermaid(options: GetTypesAsMermaidOption): string {
	let files = []
	for (const fileBuff of fs.readdirSync(options.rootFolder, {recursive: true})) {
		const file = fileBuff.toString();
		if (file.endsWith('.ts')) {
			files.push(path.join(options.rootFolder, file));
		}
	}
	return getTypesFromFileAsMermaid(files, options);
}
