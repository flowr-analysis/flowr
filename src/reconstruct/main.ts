import { Selection, AutoSelectPredicate, autoSelectLibrary, ReconstructionResult, reconstructLogger, reconstructAstFolds, removeOuterExpressionListIfApplicable } from './reconstruct';

import { NormalizedAst, RNode, ParentInformation, foldAstStateful } from '../r-bridge';
import { LogLevel } from '../util/log';


/*
--main function--
*/
/**
 * Reconstructs parts of a normalized R ast into R code on an expression basis.
 *
 * @param ast          - The {@link NormalizedAst|normalized ast} to be used as a basis for reconstruction
 * @param selection    - The selection of nodes to be reconstructed (probably the {@link NodeId|NodeIds} identified by the slicer)
 * @param autoSelectIf - A predicate that can be used to force the reconstruction of a node (for example to reconstruct library call statements, see {@link autoSelectLibrary}, {@link doNotAutoSelect})
 *
 * @returns The number of times `autoSelectIf` triggered, as well as the reconstructed code itself.
 */

export function reconstructToCode<Info>(ast: NormalizedAst<Info>, selection: Selection, autoSelectIf: AutoSelectPredicate = autoSelectLibrary): ReconstructionResult {
	if (reconstructLogger.settings.minLevel >= LogLevel.Trace) {
		reconstructLogger.trace(`reconstruct ast with ids: ${JSON.stringify([...selection])}`)
	}

	// we use a wrapper to count the number of times the autoSelectIf predicate triggered
	let autoSelected = 0
	const autoSelectIfWrapper = (node: RNode<ParentInformation>) => {
		const result = autoSelectIf(node)
		if (result) {
			autoSelected++
		}
		return result
	}

	// fold of the normalized ast
	const result = foldAstStateful(ast.ast, { selection, autoSelectIf: autoSelectIfWrapper }, reconstructAstFolds)

	if (reconstructLogger.settings.minLevel >= LogLevel.Trace) {
		reconstructLogger.trace('reconstructed ast before string conversion: ', JSON.stringify(result))
	}

	return removeOuterExpressionListIfApplicable(result, autoSelected)
}
