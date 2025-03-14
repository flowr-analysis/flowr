import type { Lift } from './r-value';
import { Bottom, isBottom, isTop, Top } from './r-value';

/**
 * Takes n potentially lifted ops and returns `Top` or `Bottom` if any is `Top` or `Bottom`.
 */
export function bottomTopGuard(...a: Lift<unknown>[]): typeof Top | typeof Bottom | undefined {
	if(a.some(isBottom)) {
		return Bottom;
	} else if(a.some(isTop)) {
		return Top;
	}
}
