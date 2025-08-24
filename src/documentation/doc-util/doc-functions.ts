import type { Expression } from 'typescript';
import ts from 'typescript';
import { guard } from '../../util/assert';
import fs from 'fs';
import path from 'path';
import {
	dropGenericsFromTypeName,
	getStartLineOfTypeScriptNode,
	getTypeScriptSourceFiles, removeCommentSymbolsFromTypeScriptComment
} from './doc-types';

export interface FunctionElementInSource {
	name:       string;
	node:       ts.Node;
	source:     ts.SourceFile;
	kind:       'function';
	arguments:  Expression[];
	lineNumber: number;
	comments?:  string[];
}

function collectHierarchyInformation(sourceFiles: readonly ts.SourceFile[], options: GetFunctionsWithProgramOption, fname?: RegExp): FunctionElementInSource[] {
	const hierarchyList: FunctionElementInSource[] = [];
	const visit = (node: ts.Node | undefined, sourceFile: ts.SourceFile) => {
		if(!node) {
			return;
		}

		if(ts.isCallExpression(node) || ts.isNewExpression(node)) {
			const name = node.expression.getText(sourceFile);
			if(!fname || fname.test(name)) {
				const comments =  ts.getLeadingCommentRanges(sourceFile.getText(sourceFile), node.getFullStart())?.map(c => {
					return removeCommentSymbolsFromTypeScriptComment(sourceFile.getText(sourceFile).substring(c.pos, c.end).trim());
				});
				hierarchyList.push({
					name:       dropGenericsFromTypeName(name),
					node,
					kind:       'function',
					comments,
					lineNumber: getStartLineOfTypeScriptNode(node, sourceFile),
					source:     sourceFile,
					arguments:  node.arguments?.map(n => n) ?? []
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

export interface GetFunctionsOption {
	readonly rootFolder?: string;
	readonly files?:      readonly string[];
	readonly fname?:      RegExp;
}

interface GetFunctionsWithProgramOption extends GetFunctionsOption {
	readonly program: ts.Program;
}

export interface FunctionsReport {
	info:    FunctionElementInSource[],
	program: ts.Program
}

/**
 * Inspect typescript source code for types and return a report.
 */
export function getFunctionsFromFolder(options: GetFunctionsOption): FunctionsReport {
	guard(options.rootFolder !== undefined || options.files !== undefined, 'Either rootFolder or files must be provided');
	const fileNames = [...options.files ?? []];
	if(options.rootFolder) {
		for(const fileBuff of fs.readdirSync(options.rootFolder, { recursive: true })) {
			const file = fileBuff.toString();
			if(file.endsWith('.ts')) {
				fileNames.push(path.join(options.rootFolder, file));
			}
		}
	}
	const { files, program } = getTypeScriptSourceFiles(fileNames);
	guard(files.length > 0, () => `No source files found for ${JSON.stringify(fileNames)}`);
	const withProgram = { ...options, program };
	const hierarchyList = collectHierarchyInformation(files, withProgram, options.fname);
	return {
		info: hierarchyList,
		program
	};
}
