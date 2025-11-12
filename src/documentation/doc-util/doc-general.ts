
/**
 *
 */
export function prefixLines(line: string, prefix: string) {
	return line.split('\n').map(l => `${prefix}${l}`).join('\n');
}


/**
 *
 */
export function lastJoin(elements: readonly string[], join: string, lastjoin: string) {
	if(elements.length <= 1) {
		return elements.join(lastjoin);
	} else {
		return elements.slice(0, -1).join(join) + lastjoin + elements[elements.length - 1];
	}
}
