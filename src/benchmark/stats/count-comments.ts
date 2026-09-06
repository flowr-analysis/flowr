import { RProject } from '../../r-bridge/lang-4.x/ast/model/nodes/r-project';
import { RComment } from '../../r-bridge/lang-4.x/ast/model/nodes/r-comment';
import { withoutWhitespace } from '../../util/text/strings';

/** How many nodes an AST holds and how much of its source is taken up by the comments attached to them. */
export interface AstCommentCounts {
	/** All normalized nodes. */
	readonly nodes:                    number;
	/** The nodes without an attached comment. */
	readonly nodesNoComments:          number;
	/** Characters taken up by the attached comments. */
	readonly commentChars:             number;
	/** {@link commentChars} without any whitespace. */
	readonly commentCharsNoWhitespace: number;
}

/**
 * Counts the nodes of the given AST and the source characters its attached comments take up.
 */
export function countAstComments(ast: Parameters<typeof RProject.visitAst>[0]): AstCommentCounts {
	let nodes = 0;
	let nodesNoComments = 0;
	let commentChars = 0;
	let commentCharsNoWhitespace = 0;
	RProject.visitAst(ast, t => {
		nodes++;
		const comments = t.info.adToks?.filter(RComment.is);
		if(comments && comments.length > 0) {
			const content = comments.map(c => c.lexeme ?? '').join('');
			commentChars += content.length;
			commentCharsNoWhitespace += withoutWhitespace(content).length;
		} else {
			nodesNoComments++;
		}
		return false;
	});
	return { nodes, nodesNoComments, commentChars, commentCharsNoWhitespace };
}
