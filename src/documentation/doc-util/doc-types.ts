import ts from 'typescript';
import { guard } from '../../util/assert';
import { RemoteFlowrFilePathBaseRef } from './doc-files';
import fs from 'fs';
import path from 'path';
import { escapeMarkdown } from '../../util/mermaid/mermaid';
import { codeBlock } from './doc-code';
import { details } from './doc-structure';
import { textWithTooltip } from '../../util/html-hover-over';

/* basics generated */

export interface TypeElementInSource {
	name:                 string;
	node:                 ts.Node;
	kind:                 'interface' | 'type' | 'enum' | 'class' | 'variable';
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

function removeCommentSymbols(comment: string): string {
	return comment
	// remove '/** \n * \n */...
		.replace(/^\/\*\*?/gm, '').replace(/^\s*\*\s*/gm, '').replace(/\*\/$/gm, '').replace(/^\s*\*/gm, '')
	/* replace {@key foo|bar} with `bar` and {@key foo} with `foo` */
		.replace(/\{@[a-zA-Z]+ ([^}]+\|)?(?<name>[^}]+)}/gm, '<code>$<name></code>')
		.trim();
}

function getTextualComments(node: ts.Node): string[] {
	const comments = ts.getJSDocCommentsAndTags(node);
	const out: string[] = [];
	for(const { comment } of comments) {
		if(typeof comment === 'string') {
			out.push(removeCommentSymbols(comment));
		} else if(comment !== undefined) {
			for(const c of comment) {
				out.push(removeCommentSymbols(c.getText(c.getSourceFile())));
			}
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

const defaultSkip = ['Pick', 'Partial', 'Required', 'Readonly', 'Omit', 'DeepPartial', 'DeepReadonly', 'DeepWritable', 'StrictOmit'];

export function followTypeReference(type: ts.TypeReferenceNode, sourceFile: ts.SourceFile): string[] {
	const node = type.typeName;
	if(ts.isQualifiedName(node)) {
		return [node.right.getText(sourceFile) ?? ''];
	}
	const args = type.typeArguments?.map(arg => arg.getText(sourceFile)) ?? [];
	const nodeLexeme = node.getText(sourceFile) ?? '';
	const baseLexeme = type.getText(sourceFile) ?? '';

	if(defaultSkip.map(s => nodeLexeme.startsWith(s))) {
		return [baseLexeme, ...args];
	}
	return [nodeLexeme, baseLexeme, ...args];
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
					.flatMap(typeName => followTypeReference(typeName, sourceFile))
					.map(dropGenericsFromType);
			} else if(ts.isTypeReferenceNode(node.type)) {
				baseTypes = [...followTypeReference(node.type, sourceFile)].map(dropGenericsFromType);
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
			hierarchyList.push({
				name:       dropGenericsFromType(enumName),
				node,
				kind:       'enum',
				extends:    [],
				comments:   getTextualComments(node),
				generics:   [],
				filePath:   sourceFile.fileName,
				lineNumber: getStartLine(node, sourceFile),
				properties: node.members.map(member => {
					const name = member.name?.getText(sourceFile) ?? '';
					return `${name}${escapeMarkdown(': ' + getType(member, typeChecker))}`;
				})
			});
		} else if(ts.isClassDeclaration(node)) {
			const className = node.name?.getText(sourceFile) ?? '';
			const baseTypes = node.heritageClauses?.flatMap(clause =>
				clause.types
					.map(type => type.getText(sourceFile) ?? '')
					.map(dropGenericsFromType)
			) ?? [];
			const generics = node.typeParameters?.map(param => param.getText(sourceFile) ?? '') ?? [];

			hierarchyList.push({
				name:       dropGenericsFromType(className),
				node,
				kind:       'class',
				extends:    baseTypes,
				comments:   getTextualComments(node),
				generics,
				filePath:   sourceFile.fileName,
				lineNumber: getStartLine(node, sourceFile),
				properties: node.members.map(member => {
					const name = member.name?.getText(sourceFile) ?? '';
					return `${name}${escapeMarkdown(': ' + getType(member, typeChecker))}`;
				}),
			});
		} else if(
			ts.isVariableDeclaration(node) || ts.isExportDeclaration(node) || ts.isExportAssignment(node) || ts.isDeclarationStatement(node)
		) {
			const name = node.name?.getText(sourceFile) ?? '';
			const comments = getTextualComments(node);
			hierarchyList.push({
				name:       dropGenericsFromType(name),
				node,
				kind:       'variable',
				extends:    [],
				comments,
				generics:   [],
				filePath:   sourceFile.fileName,
				lineNumber: getStartLine(node, sourceFile),
			});
		} else if(
			ts.isPropertyAssignment(node) || ts.isPropertyDeclaration(node) || ts.isPropertySignature(node)
			|| ts.isMethodDeclaration(node) || ts.isMethodSignature(node) || ts.isFunctionDeclaration(node)
		) {
			const name = node.name?.getText(sourceFile) ?? '';

			// get the name of the object/enclosing type
			let parent = node.parent;
			while(typeof parent === 'object' && parent !== undefined && !('name' in parent)) {
				parent = parent.parent;
			}
			if(typeof parent === 'object' && 'name' in parent) {
				const comments = getTextualComments(node);
				hierarchyList.push({
					name:       dropGenericsFromType(name),
					node,
					kind:       'variable',
					extends:    [parent.name?.getText(sourceFile) ?? ''],
					comments,
					generics:   [],
					filePath:   sourceFile.fileName,
					lineNumber: getStartLine(node, sourceFile),
				});
			}
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
	const fromSource = filePath.replace(/^.*\/src\//, 'src/').replace(/^.*\/test\//, 'test/');
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
	const inline = [...options.inlineTypes ?? [], ...defaultSkip];
	if(node.extends.length > 0) {
		for(const baseType of node.extends) {
			if(inline.includes(baseType)) {
				const info = hierarchyList.find(h => h.name === baseType);
				for(const property of info?.properties ?? []) {
					if(!writtenProperties.has(property)) {
						collect.nodeLines.push(`    ${node.name} : ${property} [from ${baseType}]`);
						writtenProperties.add(property);
					}
				}
			} else {
				if(node.kind === 'type' || hierarchyList.find(h => h.name === baseType)?.kind === 'type') {
					collect.edgeLines.push(`${dropGenericsFromType(baseType)} .. ${node.name}`);
				} else {
					collect.edgeLines.push(`${dropGenericsFromType(baseType)} <|-- ${node.name}`);
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

export function implSnippet(node: TypeElementInSource | undefined, program: ts.Program, showName = true, nesting = 0, open = false): string {
	guard(node !== undefined, 'Node must be defined => invalid change of type name?');
	const indent = ' '.repeat(nesting * 2);
	const bold = node.kind === 'interface' || node.kind === 'enum' ? '**' : '';
	const sep = node.comments ? '  \n' : '\n';

	let text = node.comments?.join('\n') ?? '';
	if(text.trim() !== '') {
		text = '  ' + text;
	}
	const code = node.node.getFullText(program.getSourceFile(node.node.getSourceFile().fileName));
	text += `\n<details${open ? ' open' : ''}><summary style="color:gray">Defined at <a href="${getTypePathLink(node)}">${getTypePathLink(node, '.')}</a></summary>\n\n${codeBlock('ts', code)}\n\n</details>\n`;
	const init = showName ? `* ${bold}[${node.name}](${getTypePathLink(node)})${bold} ${sep}${indent}` : '';
	return ` ${indent}${showName ? init : ''} ${text.replaceAll('\t','    ').split(/\n/g).join(`\n${indent}   `)}`;
}

export interface PrintHierarchyArguments {
	readonly program:              ts.Program
	readonly info:                 TypeElementInSource[]
	readonly root:                 string
	readonly collapseFromNesting?: number
	readonly initialNesting?:      number
	readonly maxDepth?:            number
	readonly openTop?:             boolean
}

export const mermaidHide = ['Leaf', 'Location', 'Namespace', 'Base', 'WithChildren', 'Partial', 'RAccessBase'];
export function printHierarchy({ program, info, root, collapseFromNesting = 1, initialNesting = 0, maxDepth = 20, openTop }: PrintHierarchyArguments): string {
	if(initialNesting > maxDepth) {
		return '';
	}
	const node = info.find(e => e.name === root);
	if(!node) {
		return '';
	}

	const thisLine = implSnippet(node, program, true, initialNesting, initialNesting === 0 && openTop);
	const result = [];

	for(const baseType of node.extends) {
		if(mermaidHide.includes(baseType)) {
			continue;
		}
		const res = printHierarchy({ program, info: info, root: baseType, collapseFromNesting, initialNesting: initialNesting + 1, maxDepth });
		result.push(res);
	}

	const out = result.join('\n');
	if(initialNesting === collapseFromNesting - 1) {
		return thisLine + (out ? details(`View more (${node.extends.join(', ')})`, out, { prefixInit: ' '.repeat(2 * (collapseFromNesting + 1)) }) : '');
	} else {
		return thisLine + (out ? '\n' + out : '');
	}
}

function retrieveNode(name: string, hierarchy: readonly TypeElementInSource[]): [string | undefined, string, TypeElementInSource]| undefined {
	let container: string | undefined = undefined;
	if(name.includes('::')) {
		[container, name] = name.split(/:::?/);
	}
	let node = hierarchy.filter(e => e.name === name);
	if(node.length === 0) {
		return undefined;
	} else if(container) {
		node = node.filter(n => n.extends.includes(container));
		if(node.length === 0) {
			return undefined;
		}
	}
	return [container, name, node[0]];
}

/**
 * Create a short link to a type in the documentation
 * @param name      - The name of the type, e.g. `MyType`, may include a container, e.g.,`MyContainer::MyType` (this works with function nestings too)
 *                    Use `:::` if you want to access a scoped function, but the name should be displayed without the scope
 * @param hierarchy - The hierarchy of types to search in
 * @param codeStyle - Whether to use code style for the link
 * @param realNameWrapper - How to highlight the function in name in the `x::y` format?
 */
export function shortLink(name: string, hierarchy: readonly TypeElementInSource[], codeStyle = true, realNameWrapper = 'b'): string {
	const res = retrieveNode(name, hierarchy);
	if(!res) {
		console.error(`Could not find node ${name} when resolving short link!`);
		return '';
	}
	const [, mainName, node] = res;
	let pkg = res[0];
	if(name.includes(':::')) {
		pkg = undefined;
	}
	const comments = node.comments?.join('\n').replace(/\\?\n|```[a-zA-Z]*|\s\s*/g, ' ').replace(/<\/?code>|`/g, '').replace(/<\/?p\/?>/g, ' ').replace(/"/g, '\'') ?? '';
	return `[${codeStyle ? '<code>' : ''}${
		(node.comments?.length ?? 0) > 0 ?
			textWithTooltip(pkg ? `${pkg}::<${realNameWrapper}>${mainName}</${realNameWrapper}>` : mainName, comments.length > 400 ? comments.slice(0, 400) + '...' : comments) : node.name
	}${codeStyle ? '</code>' : ''}](${getTypePathLink(node)})`;
}

export function getDocumentationForType(name: string, hierarchy: TypeElementInSource[]): string {
	const res = retrieveNode(name, hierarchy);
	if(!res) {
		return '';
	}
	const [, , node] = res;
	return node.comments?.join('\n') ?? '';
}
