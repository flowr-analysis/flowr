import { findByPrefixIfUnique } from './prefix';

/** the name of the special `...` parameter which collects everything that finds no formal of its own */
export const DotsParameterName = '...';

/**
 * Bind the arguments of a call to the formal parameters of the called function, following R's argument matching
 * rules (see https://cran.r-project.org/doc/manuals/R-lang.html#Argument-matching):
 *
 * 1. every named argument that *exactly* matches a formal takes it,
 * 2. every remaining named argument that is a *unique prefix* of a still-free formal takes it (`pmatch`),
 * 3. the remaining unnamed arguments fill the still-free formals from left to right, stopping at `...`
 *    (formals behind `...` can only be matched by name), and
 * 4. everything that is still unmatched goes to `...` if the function has one.
 *
 * Both sides are given by their names alone (`undefined` for an unnamed argument or an anonymous formal), so this
 * works for the normalized AST, the dataflow graph, and a plain signature list alike. An empty argument (`f(1, ,3)`)
 * is an unnamed one: it takes its formal like any other, the caller just has nothing to bind to it.
 * @returns for every argument (by index) the index of the parameter it binds to, `undefined` if it stays unbound
 */
export function matchArgumentsToParameters(
	argNames: readonly (string | undefined)[],
	paramNames: readonly (string | undefined)[]
): readonly (number | undefined)[] {
	const bound: (number | undefined)[] = Array.from(argNames, () => undefined);
	const names = paramNames.map(p => p ?? '');
	const dots = names.indexOf(DotsParameterName);
	const taken = new Set<number>();
	const take = (arg: number, param: number): void => {
		bound[arg] = param;
		taken.add(param);
	};
	/** binds each still-free named argument to the formal `pick` names for it, as long as that one is still free too */
	const byName = (pick: (name: string) => string | undefined): void => {
		for(let i = 0; i < argNames.length; i++) {
			const name = argNames[i];
			if(name === undefined || bound[i] !== undefined) {
				continue;
			}
			const target = pick(name);
			const param = target === undefined ? -1 : names.indexOf(target);
			if(param >= 0 && !taken.has(param)) {
				take(i, param);
			}
		}
	};

	byName(name => name);                                     // (1) exact
	byName(name => findByPrefixIfUnique(name, names));        // (2) pmatch
	// (3) positional
	let formal = 0;
	for(let i = 0; i < argNames.length; i++) {
		if(argNames[i] !== undefined || bound[i] !== undefined) {
			continue;
		}
		while(taken.has(formal)) {
			formal++;
		}
		if(formal >= names.length || formal === dots) {
			break;
		}
		take(i, formal);
	}
	// (4) `...`
	if(dots >= 0) {
		for(let i = 0; i < argNames.length; i++) {
			bound[i] ??= dots;
		}
	}
	return bound;
}
