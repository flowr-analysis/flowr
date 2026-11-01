import { SemVer } from 'semver';
import { RNode } from './model';
import { RPipe } from './nodes/r-pipe';
import { RString } from './nodes/r-string';
import { RAccess } from './nodes/r-access';
import { RSymbol } from './nodes/r-symbol';
import { RFunctionDefinition } from './nodes/r-function-definition';
import { MIN_VERSION_LAMBDA, MIN_VERSION_PIPE_BIND } from './versions';

/**
 * The R version the syntax of `ast` needs at least, `undefined` if every R reads it: the native pipe `|>`, the
 * lambda shorthand `\(x)` and raw strings `r"(...)"` need R 4.1, the placeholder `_` (`x |> f(y = _)`) R 4.2,
 * and the placeholder at the head of an extraction (`x |> _$a`) R 4.3.
 */
export function minRVersionOf<Info>(ast: RNode<Info> | readonly RNode<Info>[]): SemVer | undefined {
	let needed: SemVer | undefined;
	const atLeast = (version: SemVer | string) => {
		const v = new SemVer(version);
		if(needed === undefined || v.compare(needed) > 0) {
			needed = v;
		}
	};
	const placeholders = (rhs: RNode<Info>) => RNode.visitAst(rhs, n => {
		if(RAccess.is(n) && RSymbol.is(n.accessed) && n.accessed.lexeme === '_') {
			atLeast(RPipe.hasAccessPlaceHolderFromRVersion());
		} else if(RSymbol.is(n) && n.lexeme === '_') {
			atLeast(RPipe.hasPlaceHolderFromRVersion());
		}
		return false;
	});
	RNode.visitAst(ast, n => {
		if(RPipe.is(n)) {
			atLeast(RPipe.availableFromRVersion());
			placeholders(n.rhs);
		} else if(RFunctionDefinition.is(n) && (n.lexeme === '\\' || n.lexeme === '=>')) {
			atLeast(n.lexeme === '\\' ? MIN_VERSION_LAMBDA : MIN_VERSION_PIPE_BIND);
		} else if(RString.is(n) && n.content.flag === 'raw') {
			atLeast(RString.rawStringAvailableFromRVersion());
		}
		return false;
	});
	return needed;
}
