import ts from 'typescript';
import { guard } from '../../util/assert';
import { RemoteFlowrFilePathBaseRef } from './doc-files';
import fs from 'fs';
import path from 'path';
import { escapeMarkdown } from '../../util/mermaid/mermaid';
import { codeBlock } from './doc-code';
import { details } from './doc-structure';

/* basics generated */

export interface TypeElementInSource {
	name:                 string;
	node:                 ts.Node;
	kind:                 'interface' | 'type' | 'enum';
	extends:              string[];
	generics:             string[];
	filePath:             string;
	lineNumber:           number;
	comments?:            string[];
	readonly properties?: string[];
}

function getSourceFiles(fileNames: readonly string[]): { files: ts.SourceFile[], program: ts.Program } {
	try {
		const program = ts.createProgram(fileNames, { target: ts.ScriptTarget.ESNext });
		return { program, files: fileNames.map(fileName => program.getSourceFile(fileName)).filter(file => !!file) };
	} catch(err) {
		console.error('Failed to get source files', err);
		return { files: [], program: undefined as unknown as ts.Program };
	}
}

function dropGenericsFromType(type: string): string {
	let previous;
	do{
		previous = type;
		type = type.replace(/<.*>/g, '');
	} while(type !== previous);
	return type;
}

function getTextualComments(node: ts.Node): string[] {
	const comments = ts.getJSDocCommentsAndTags(node);
	const out: string[] = [];
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

export function getType(node: ts.Node, typeChecker: ts.TypeChecker): string {
	const tryDirect = typeChecker.getTypeAtLocation(node);
	return tryDirect ? typeChecker.typeToString(tryDirect) : 'unknown';
}

export function followTypeReference(type: ts.TypeReferenceNode, sourceFile: ts.SourceFile): string[] {
	// if the type is required, partial, ... we need to follow the generic reference
	const node = type.typeName;
	if(ts.isQualifiedName(node)) {
		return [node.right.getText(sourceFile) ?? ''];
	}
	const args = type.typeArguments?.map(arg => arg.getText(sourceFile)) ?? [];
	const nodeLexeme = node.getText(sourceFile) ?? '';
	if(['Pick', 'Partial', 'Required', 'Readonly'].map(s => nodeLexeme.startsWith(s))) {
		return args;
	}
	return [nodeLexeme, ...args];
}

function collectHierarchyInformation(sourceFiles: readonly ts.SourceFile[], options: GetTypesWithProgramOption): TypeElementInSource[] {
	const hierarchyList: TypeElementInSource[] = [];
	const typeChecker = options.program.getTypeChecker();
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
				name:       dropGenericsFromType(interfaceName),
				node,
				kind:       'interface',
				extends:    baseTypes,
				generics,
				comments:   getTextualComments(node),
				filePath:   sourceFile.fileName,
				lineNumber: getStartLine(node, sourceFile),
				properties: node.members.map(member => {
					const name = member.name?.getText(sourceFile) ?? '';
					return `${name}${escapeMarkdown(': ' + getType(member, typeChecker))}`;
				}),
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
				baseTypes = [...followTypeReference(node.type, sourceFile)];
			}

			const generics = node.typeParameters?.map(param => param.getText(sourceFile) ?? '') ?? [];

			hierarchyList.push({
				name:       dropGenericsFromType(typeName),
				node,
				kind:       'type',
				extends:    baseTypes,
				comments:   getTextualComments(node),
				generics,
				filePath:   sourceFile.fileName,
				lineNumber: getStartLine(node, sourceFile),
			});
		} else if(ts.isEnumDeclaration(node)) {
			const enumName = node.name?.getText(sourceFile) ?? '';
			/* TODO: comments, and mark correctly as enum */
			hierarchyList.push({
				name:       enumName,
				node,
				kind:       'enum',
				extends:    [],
				comments:   getTextualComments(node),
				generics:   [],
				filePath:   sourceFile.fileName,
				lineNumber: getStartLine(node, sourceFile)
			});
		}

		ts.forEachChild(node, child => visit(child, sourceFile));
	};

	sourceFiles.forEach(sourceFile => {
		visit(sourceFile, sourceFile);
	});

	return hierarchyList;
}

interface MermaidCompact {
	nodeLines: string[]
	edgeLines: string[]
}

export function getTypePathLink({ filePath, lineNumber }: TypeElementInSource, prefix = RemoteFlowrFilePathBaseRef): string {
	const fromSource = filePath.replace(/^.*\/src\//, 'src/');
	return `${prefix}/${fromSource}#L${lineNumber}`;
}

function generateMermaidClassDiagram(hierarchyList: readonly TypeElementInSource[], rootName: string, options: GetTypesWithProgramOption, visited: Set<string> = new Set()): MermaidCompact {
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

	collect.nodeLines.push(`class ${node.name}${genericPart}`);
	collect.nodeLines.push(`    <<${node.kind}>> ${node.name}`);
	if(node.kind === 'type') {
		collect.nodeLines.push(`style ${node.name} opacity:.35,fill:#FAFAFA`);
	}
	const writtenProperties = new Set<string>();
	if(node.properties) {
		for(const property of node.properties) {
			collect.nodeLines.push(`    ${node.name} : ${property}`);
			writtenProperties.add(property);
		}
	}
	collect.nodeLines.push(`click ${node.name} href "${getTypePathLink(node)}" "${escapeMarkdown(node.comments?.join('; ').replace(/\n/g,' ') ?? '' )}"`);

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
				if(node.kind === 'type' || hierarchyList.find(h => h.name === baseType)?.kind === 'type') {
					collect.edgeLines.push(`${baseType} .. ${node.name}`);
				} else {
					collect.edgeLines.push(`${baseType} <|-- ${node.name}`);
				}
				const { nodeLines, edgeLines } = generateMermaidClassDiagram(hierarchyList, baseType, options, visited);
				collect.nodeLines.push(...nodeLines);
				collect.edgeLines.push(...edgeLines);
			}
		}
	}
	return collect;
}

function visualizeMermaidClassDiagram(hierarchyList: readonly TypeElementInSource[], options: GetTypesWithProgramOption) {
	const { nodeLines, edgeLines } = generateMermaidClassDiagram(hierarchyList, options.typeName, options);
	return nodeLines.length === 0 && edgeLines.length === 0 ? '' : `
classDiagram
direction RL
${nodeLines.join('\n')}
${edgeLines.join('\n')}
`;
}

function getTypesFromFileAsMermaid(fileNames: string[], options: GetTypesAsMermaidOption): {
	text:    string,
	info:    TypeElementInSource[],
	program: ts.Program
} {
	const { files, program } = getSourceFiles(fileNames);
	guard(files.length > 0, () => `No source files found for ${JSON.stringify(fileNames)}`);
	const withProgram = { ...options, program };
	const hierarchyList = collectHierarchyInformation(files, withProgram);
	return {
		text: visualizeMermaidClassDiagram(hierarchyList, withProgram),
		info: hierarchyList,
		program
	};
}

export interface GetTypesAsMermaidOption {
	readonly rootFolder?:  string;
	readonly files?:       readonly string[];
	readonly typeName:     string;
	readonly inlineTypes?: readonly string[]
}

interface GetTypesWithProgramOption extends GetTypesAsMermaidOption {
	readonly program: ts.Program;
}

export interface MermaidTypeReport {
	text:    string,
	info:    TypeElementInSource[],
	program: ts.Program
}

export function getTypesFromFolderAsMermaid(options: GetTypesAsMermaidOption): MermaidTypeReport {
	guard(options.rootFolder !== undefined || options.files !== undefined, 'Either rootFolder or files must be provided');
	const files = [...options.files ?? []];
	if(options.rootFolder) {
		for(const fileBuff of fs.readdirSync(options.rootFolder, { recursive: true })) {
			const file = fileBuff.toString();
			if(file.endsWith('.ts')) {
				files.push(path.join(options.rootFolder, file));
			}
		}
	}
	return getTypesFromFileAsMermaid(files, options);
}


export function implSnippet(node: TypeElementInSource | undefined, program: ts.Program, nesting = 0): string {
	guard(node !== undefined, 'Node must be defined => invalid change of type name?');
	const indent = ' '.repeat(nesting * 2);
	const bold = node.kind === 'interface' || node.kind === 'enum' ? '**' : '';
	const sep = node.comments ? '  \n' : '\n';

	let text = node.comments?.join('\n') ?? '';
	const code = node.node.getText(program.getSourceFile(node.node.getSourceFile().fileName));
	text += `\n<details><summary style="color:gray">Defined at <a href="${getTypePathLink(node)}">${getTypePathLink(node, '.')}</a></summary>\n\n${codeBlock('ts', code)}\n\n</details>\n`;
	return `${indent} * ${bold}[${node.name}](${getTypePathLink(node)})${bold} ${sep}${indent}   ${text.replaceAll('\t','    ').split(/\n/g).join(`\n${indent}   `)}`;
}

export interface PrintHierarchyArguments {
	readonly program:              ts.Program
	readonly hierarchy:            TypeElementInSource[]
	readonly root:                 string
	readonly collapseFromNesting?: number
	readonly initialNesting?:      number
	readonly maxDepth?:            number
}

export const mermaidHide = ['Leaf', 'Location', 'Namespace', 'Base', 'WithChildren', 'Partial', 'RAccessBase'];
export function printHierarchy({ program, hierarchy, root, collapseFromNesting = 1, initialNesting = 0, maxDepth = 20 }: PrintHierarchyArguments): string {
	if(initialNesting > maxDepth) {
		return '';
	}
	const node = hierarchy.find(e => e.name === root);
	if(!node) {
		return '';
	}

	const thisLine = implSnippet(node, program, initialNesting);
	const result = [];

	for(const baseType of node.extends) {
		if(mermaidHide.includes(baseType)) {
			continue;
		}
		const res = printHierarchy({ program, hierarchy, root: baseType, collapseFromNesting, initialNesting: initialNesting + 1, maxDepth });
		result.push(res);
	}

	const out = result.join('\n');
	if(initialNesting === collapseFromNesting - 1) {
		return thisLine + (out ? details(`View more (${node.extends.join(', ')})`, out, { prefixInit: ' '.repeat(2 * (collapseFromNesting + 1)) }) : '');
	} else {
		return thisLine + (out ? '\n' + out : '');
	}
}
