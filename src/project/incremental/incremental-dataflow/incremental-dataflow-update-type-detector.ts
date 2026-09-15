import type { NormalizedAst, ParentInformation } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RComment } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-comment';
import { Hash53 } from '../../../util/hash';
import { setMinus } from '../../../util/collections/set';
import fs from 'fs';
import type { FlowrAnalyzerContext } from '../../context/flowr-analyzer-context';
import type { RProject } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-project';
import type { RExpressionList } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-expression-list';

export enum IncrementalUpdateType {
	Full         = 'Full',
	AddedAtEnd   = 'AddedAtEnd',
	RemovedAtEnd   = 'RemovedAtEnd',
	NewFileAtEnd = 'NewFileAtEnd',
	RemovedFileAtEnd = 'RemovedFileAtEnd',
	Location     = 'Location',
	Comment      = 'Comment',
	Nothing      = 'Nothing'
}

/**
 * What {@link determineUpdateTypes} classified, plus whether {@link tryIncrementalUpdate} actually applied a patch for it.
 */
export interface IncrementalUpdateResult {
	types:     IncrementalUpdateType[];
	filePath?: string;
	applied?:  boolean;
}

const alwaysIgnoredKeys = new Set(['id', 'parent', 'tsId']);

/**
 *
 */
export function hashAst(ast: unknown, filterLocation = false, filterComments = false): string {
	return new Hash53().update(JSON.stringify(ast, (key: string, value: unknown) => {
		if(alwaysIgnoredKeys.has(key) || (filterLocation && (key === 'location' || key === 'fullRange'))) {
			return undefined;
		}
		if((key === 'lexeme' || key === 'fullLexeme') && typeof value === 'string') {
			return value.replace(/\s+/g, ' ').trim();
		}
		if(filterComments && Array.isArray(value)) {
			return (value as unknown[]).filter(entry => !RComment.is(entry));
		}
		return value;
	})).digest();
}

function changedFiles(oldAst: RProject<ParentInformation>, ctx: FlowrAnalyzerContext, ignoreIndexes: number[] = []): string[] | undefined {
	return oldAst.files
		.filter((file, i) => {
			if(ignoreIndexes.includes(i)) {
				return false;
			}
			if(file.filePath === undefined) {
				return true;
			}
			try {
				return ctx.inc.getLastKnownMtime(file.filePath) !== fs.statSync(file.filePath).mtimeMs;
			} catch{
				return true;
			}
		})
		.map(file => file.filePath ?? '');
}

function isAddedAtEnd(shorter: RExpressionList<ParentInformation>, longer: RExpressionList<ParentInformation>): boolean {
	if(longer.children.length <= shorter.children.length) {
		return false;
	}
	return shorter.children.every((child, i) => sameHash(child, longer.children[i]));
}

function sameHash(old: unknown, new_: unknown, ignoreLocations: boolean = true, ignoreComments: boolean = true): boolean {
	// currently used for comparing two asts or nodes. probably very costly
	return hashAst(old, ignoreLocations, ignoreComments) === hashAst(new_, ignoreLocations, ignoreComments);
}

function commentsChanged(old: unknown, new_: unknown): boolean {
	return hashAst(old, true, false) !== hashAst(new_, true, false);
}

function locationsChanged(old: unknown, new_: unknown): boolean {
	return hashAst(old, false, true) !== hashAst(new_, false, true);
}

function classifyUnchangedFileSet(oldAst: RProject<ParentInformation>, newAst: RProject<ParentInformation>, ctx: FlowrAnalyzerContext): IncrementalUpdateResult {
	const changed = changedFiles(oldAst, ctx);
	if(changed === undefined || changed.length > 1) {
		return { types: [IncrementalUpdateType.Full] };
	}
	if(changed.length === 0) {
		return { types: [IncrementalUpdateType.Nothing] };
	}

	const oldAstFiles = oldAst.files;
	const newAstFiles = newAst.files;
	const changedIndex = oldAstFiles.findIndex(file => file.filePath === changed[0]);
	if(changedIndex === -1 || newAstFiles[changedIndex]?.filePath !== changed[0]) {
		return { types: [IncrementalUpdateType.Full] };
	}

	const oldAstRoot = oldAstFiles[changedIndex].root;
	const newAstRoot = newAstFiles[changedIndex].root;
	const filePath = newAstFiles[changedIndex].filePath;

	if(sameHash(oldAstRoot, newAstRoot)) {
		const result: IncrementalUpdateType[] = [];
		if(commentsChanged(oldAstRoot, newAstRoot)) {
			result.push(IncrementalUpdateType.Comment);
		}
		if(locationsChanged(oldAstRoot, newAstRoot)) {
			result.push(IncrementalUpdateType.Location);
		}
		return { types: result.length > 0 ? result : [IncrementalUpdateType.Nothing] };
	}

	if(isAddedAtEnd(oldAstRoot, newAstRoot)) {
		return { types: [IncrementalUpdateType.AddedAtEnd], filePath };
	} else if(isAddedAtEnd(newAstRoot, oldAstRoot)) {
		return { types: [IncrementalUpdateType.RemovedAtEnd], filePath };
	}
	return { types: [IncrementalUpdateType.Full] };
}

function classifyFileAppended(oldAst: RProject<ParentInformation>, newAst: RProject<ParentInformation>, ctx: FlowrAnalyzerContext, addedPath: string | undefined): IncrementalUpdateResult {
	const oldAstFiles = oldAst.files;
	const newAstFiles = newAst.files;
	const addedIndex = newAstFiles.findIndex(file => file.filePath === addedPath);
	if(addedIndex !== (newAst.files.length - 1)) {
		return { types: [IncrementalUpdateType.Full] };
	}

	const changed = changedFiles(oldAst, ctx);
	if(changed === undefined || changed.length > 1) {
		return { types: [IncrementalUpdateType.Full] };
	}
	if(changed.length === 1) {
		const oldIdx = oldAstFiles.findIndex(file => file.filePath === changed[0]);
		const newIdx = newAstFiles.findIndex(file => file.filePath === changed[0]);
		if(oldIdx === -1 || newIdx === -1 || !isAddedAtEnd(oldAstFiles[oldIdx].root, newAstFiles[newIdx].root)) {
			return { types: [IncrementalUpdateType.Full] };
		}
	}
	return { types: [IncrementalUpdateType.NewFileAtEnd], filePath: newAstFiles[addedIndex].filePath };
}

function classifyFileRemoved(oldAst: RProject<ParentInformation>, newAst: RProject<ParentInformation>, ctx: FlowrAnalyzerContext, removedPath: string | undefined): IncrementalUpdateResult {
	const oldAstFiles = oldAst.files;
	const newAstFiles = newAst.files;
	const removedIndex = oldAstFiles.findIndex(file => file.filePath === removedPath);
	if(removedIndex !== (oldAst.files.length - 1)) {
		return { types: [IncrementalUpdateType.Full] };
	}

	const changed = changedFiles(oldAst, ctx, [removedIndex]);
	if(changed === undefined || changed.length > 1) {
		return { types: [IncrementalUpdateType.Full] };
	}
	if(changed.length === 1) {
		const oldIdx = oldAstFiles.findIndex(file => file.filePath === changed[0]);
		const newIdx = newAstFiles.findIndex(file => file.filePath === changed[0]);
		if(oldIdx === -1 || newIdx === -1 || !isAddedAtEnd(newAstFiles[newIdx].root, oldAstFiles[oldIdx].root)) {
			return { types: [IncrementalUpdateType.Full] };
		}
	}
	return { types: [IncrementalUpdateType.RemovedFileAtEnd], filePath: oldAstFiles[removedIndex].filePath };
}

/**
 * Determines the {@link IncrementalUpdateType} from the old ast to the new ast.
 */
export function determineUpdateTypes(oldNormalizedAst: NormalizedAst | undefined, newNormalizedAst: NormalizedAst, ctx: FlowrAnalyzerContext): IncrementalUpdateResult {
	if(oldNormalizedAst === undefined) {
		return { types: [IncrementalUpdateType.Full] };
	}
	const oldAst = oldNormalizedAst.ast;
	const newAst = newNormalizedAst.ast;

	const oldPaths = new Set(oldAst.files.map(file => file.filePath));
	const newPaths = new Set(newAst.files.map(file => file.filePath));
	const added = setMinus(newPaths, oldPaths);
	const removed = setMinus(oldPaths, newPaths);

	if(added.size === 0 && removed.size === 0) {
		return classifyUnchangedFileSet(oldAst, newAst, ctx);
	} else if(added.size === 1 && removed.size === 0) {
		return classifyFileAppended(oldAst, newAst, ctx, added.values().next().value);
	} else if(removed.size === 1 && added.size === 0) {
		return classifyFileRemoved(oldAst, newAst, ctx, removed.values().next().value);
	} else {
		return { types: [IncrementalUpdateType.Full] };
	}
}