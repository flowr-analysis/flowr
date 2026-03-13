import type { AstIdMap, ParentInformation } from '../lang-4.x/ast/model/processing/decorate';
import type { NodeId } from '../lang-4.x/ast/model/processing/node-id';
import type { RoxygenTag, RoxygenTagParam } from './roxygen-ast';
import { KnownRoxygenTags } from './roxygen-ast';
import { RType } from '../lang-4.x/ast/model/type';
import type { RNode } from '../lang-4.x/ast/model/model';
import { parseRoxygenComment, parseRoxygenCommentsOfNode } from './roxygen-parse';

export interface DocumentationInfo {
	doc?: Documentation;
}
export type Documentation = RoxygenTag | readonly RoxygenTag[];

type CommentRetriever<Node extends RType> = (node: Extract<RNode<ParentInformation>, { type: Node }>, idMap: AstIdMap<ParentInformation & DocumentationInfo>) => Documentation | undefined;
type CommentRetrievers = { [Node in RType]?: CommentRetriever<Node> };
const CommentRetriever: CommentRetrievers = {
	[RType.Comment]:   n => parseRoxygenComment([n.lexeme]),
	[RType.Parameter]: (n, idMap) => {
		// get the documentation of the parent function
		const doc = n.info.parent ? getDocumentationOf(n.info.parent, idMap) : undefined;
		const paramName = n.lexeme;
		if(doc && paramName) {
			if(Array.isArray(doc)) {
				const res = (doc as RoxygenTag[]).filter(t => t.type === KnownRoxygenTags.Param && t.value.name === paramName);
				if(res.length === 1) {
					return res[0];
				} else {
					return res;
				}
			} else {
				if((doc as RoxygenTag).type === KnownRoxygenTags.Param && (doc as RoxygenTagParam).value.name === paramName) {
					return doc;
				}
			}
		}
		return undefined;
	}
};


/**
 * Given a normalized AST and a node ID, returns the Roxygen documentation (if any) associated with that node.
 * Please note that this does more than {@link parseRoxygenCommentsOfNode}, as it also traverses up the AST to find documentation.
 * Additionally, this function instruments the normalized AST to cache the parsed documentation for future queries.
 * @param idMap   - The AST ID map to use for looking up nodes and traversing the AST.
 * @param nodeId  - The ID of the node to get documentation for.
 */
export function getDocumentationOf(nodeId: NodeId, idMap: AstIdMap<ParentInformation & DocumentationInfo>): Documentation | undefined {
	const node = idMap.get(nodeId);
	if(!node) {
		return undefined;
	} else if('doc' in node.info) {
		return node.info.doc;
	}
	const retriever = CommentRetriever[node.type as RType] ?? ((c: RNode<ParentInformation>, a: AstIdMap) => parseRoxygenCommentsOfNode(c, a)?.tags);
	const doc = retriever(node as never, idMap);
	if(doc) {
		// to avoid endless recursion, we block the caching here once:
		(node.info as DocumentationInfo).doc = undefined;
		// cache the documentation for future queries
		const expanded = expandInheritsOfTags(doc, idMap);
		(node.info as DocumentationInfo).doc = expanded;
		return expanded;
	}
	return doc;
}

function expandInheritsOfTags(tags: RoxygenTag | readonly RoxygenTag[], idMap: AstIdMap<ParentInformation & DocumentationInfo>): RoxygenTag | readonly RoxygenTag[] {
	const expandedTags: RoxygenTag[] = [];
	const tagArray: readonly RoxygenTag[] = Array.isArray(tags) ? tags : [tags];
	for(const tag of tagArray) {
		const expanded: RoxygenTag | readonly RoxygenTag[] | undefined = expandInheritOfTag(tag, tagArray, idMap);
		if(!expanded) {
			continue;
		}
		if(Array.isArray(expanded)) {
			expandedTags.push(...expanded as readonly RoxygenTag[]);
		} else {
			expandedTags.push(expanded as RoxygenTag);
		}
	}
	if(expandedTags.length === 1) {
		return expandedTags[0];
	}
	return expandedTags;
}

function getDocumentationOfByName(name: string, idMap: AstIdMap<ParentInformation & DocumentationInfo>): Documentation | undefined {
	for(const [, node] of idMap) {
		const nodeName = node.lexeme ?? node.info.fullLexeme;
		if(nodeName !== name) {
			continue;
		}
		return getDocumentationOf(node.info.id, idMap);
	}
}

function filterDocumentationForParams(doc: Documentation | undefined, filter: (r: RoxygenTag) => boolean): Documentation | undefined {
	if(!doc) {
		return doc;
	}
	if(Array.isArray(doc)) {
		return doc.filter(filter) as readonly RoxygenTag[];
	} else {
		return filter(doc as RoxygenTag) ? doc : undefined;
	}

}

function expandInheritOfTag(tag: RoxygenTag, otherTags: readonly RoxygenTag[], idMap: AstIdMap<ParentInformation & DocumentationInfo>): Documentation | undefined {
	if(tag.type === KnownRoxygenTags.Inherit) {
		const inheritDoc = getDocumentationOfByName(tag.value.source, idMap);
		return filterDocumentationForParams(inheritDoc, t => tag.value.components.includes(t.type));
	} else if(tag.type === KnownRoxygenTags.InheritDotParams) {
		const inheritDoc = getDocumentationOfByName(tag.value.source, idMap);
		return filterDocumentationForParams(inheritDoc, t => t.type === KnownRoxygenTags.Param && t.value.name === '...');
	} else if(tag.type === KnownRoxygenTags.InheritParams) {
		const inheritDoc = getDocumentationOfByName(tag.value, idMap);
		const alreadyExplainedParams = new Set(otherTags.filter(t => t.type === KnownRoxygenTags.Param).map(t => t.value.name));
		return filterDocumentationForParams(inheritDoc, t => t.type === KnownRoxygenTags.Param && !alreadyExplainedParams.has(t.value.name));
	}
	return tag;
}
