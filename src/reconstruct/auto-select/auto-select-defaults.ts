import {NoInfo, RNode} from "../../r-bridge/lang-4.x/ast/model/model";
import {type NormalizedAst, ParentInformation} from "../../r-bridge/lang-4.x/ast/model/processing/decorate";
import { RType } from "../../r-bridge/lang-4.x/ast/model/type";

/**
 * The structure of the predicate that should be used to determine
 * if a given normalized node should be included in the reconstructed code,
 * independent of if it is selected by the slice or not.
 *
 * @see reconstructToCode
 * @see doNotAutoSelect
 * @see autoSelectLibrary
 */
export type AutoSelectPredicate = (node: RNode<ParentInformation>, fullAst: NormalizedAst) => boolean

/**
 * A variant of the {@link AutoSelectPredicate} which does not select any additional statements (~&gt; false)
 */
export function doNotAutoSelect(_node: RNode): boolean {
	return false
}

const libraryFunctionCall = /^(library|require|((require|load|attach)Namespace))$/

/**
 * A variant of the {@link AutoSelectPredicate} which does its best
 * to select any kind of library import automatically.
 */
export function autoSelectLibrary<Info = NoInfo>(node: RNode<Info>): boolean {
	if(node.type !== RType.FunctionCall || !node.named) {
		return false
	}
	return libraryFunctionCall.test(node.functionName.content)
}
