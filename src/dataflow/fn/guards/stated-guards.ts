import { compactRecord, nonEmpty } from '../../../util/objects';
import type { AstIdMap } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { summarizeClauses, type FunctionGuards } from './function-guards';
import { callsOfTerms, reasonsOf, type StatedGuards } from './built-in-guards';

/**
 * What of the {@link FunctionGuards} of a definition is worth stating without the program, as the signature
 * database and the guards of the base packages store it: `undefined` if that is nothing.
 * A clause asking something of R's internals (`.Internal(...)`) is left out, as a reader cannot write it, and a
 * formal being required alone is what the signature already says of a formal without a default.
 * @param guards - what flowR inferred for the definition, see {@link FunctionGuards}
 * @param idMap  - the ids of the program the guards were read off, to quote the code that fails, see {@link reasonsOf}
 * @param ownerOf - the package defining a function of the program, see {@link reasonsOf}
 */
export function statedGuardsOf(this: void, guards: FunctionGuards, idMap: AstIdMap, ownerOf?: (name: string) => string | undefined): StatedGuards | undefined {
	const clauses = guards.clauses.filter(c => !c.rendered.includes('.Internal('));
	const hasFormals = Object.keys(guards.formals).length > 0;
	if(clauses.length === 0 && !hasFormals && guards.returns === undefined) {
		return undefined;
	}
	const calls = callsOfTerms(clauses.map(c => c.requires));
	return compactRecord({
		requires:    summarizeClauses(clauses).requires,
		calls:       nonEmpty(calls),
		required:    nonEmpty(guards.required),
		formals:     hasFormals ? guards.formals : undefined,
		relations:   nonEmpty(guards.relations),
		conditional: nonEmpty(guards.conditional),
		returns:     guards.returns,
		passes:      guards.passes,
		because:     clauses.length > 0 ? reasonsOf(clauses, idMap, ownerOf) : undefined
	});
}
