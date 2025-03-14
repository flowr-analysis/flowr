import type { Lift } from './r-value';
import { Bottom, isBottom, isTop, Top } from './r-value';

/**
 * Takes two potentially lifted ops and returns `Top` or `Bottom` if either is `Top` or `Bottom`.
 */
export function bottomTopGuard<A extends Lift<unknown>, B extends Lift<unknown>>(
	a: A,
	b: B
): typeof Top | typeof Bottom | undefined {
	if(isBottom(a) || isBottom(b)) {
		return Bottom;
	} else if(isTop(a) || isTop(b)) {
		return Top;
	}
}

export function bottomTopGuardSingle<A extends Lift<unknown>>(
	a: A
): typeof Top | typeof Bottom | undefined {
	if(isBottom(a)) {
		return Bottom;
	} else if(isTop(a)) {
		return Top;
	}
}