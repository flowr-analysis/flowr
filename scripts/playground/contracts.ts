import { el } from '../page-lib/dom';
import { contract, link, originTag, originWords, titled, type Part } from '../sigdb-page/contract-view';
import { guardsTuple } from '../sigdb-page/contract-tuple';
import { contractFormals } from '../sigdb-page/contract-formals';
import type { Guards } from '../sigdb-page/database';
import type { InspectFnGuardsQueryResult } from '../../src/queries/catalog/inspect-fn-guards-query/inspect-fn-guards-query-format';
import { statedGuardsOf } from '../../src/dataflow/fn/guards/stated-guards';
import type { StatedGuards } from '../../src/dataflow/fn/guards/built-in-guards';
import type { AstIdMap } from '../../src/r-bridge/lang-4.x/ast/model/processing/decorate';
import type { DataflowGraph } from '../../src/dataflow/graph/graph';
import { NodeId } from '../../src/r-bridge/lang-4.x/ast/model/processing/node-id';
import { RFunctionDefinition } from '../../src/r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import { Dataflow } from '../../src/dataflow/graph/df-helper';
import { EdgeType } from '../../src/dataflow/graph/edge';
import { SourceRange } from '../../src/util/range';

/** a place in the project: a line of the open file, or of another one */
export interface Place { readonly line?: number, readonly file?: string }

/** What a function of the script asks of its calls, as the inspect-fn-guards query infers it. */
export interface ProgramContract extends Place {
	/** the name the function is bound to, `function` for an anonymous one */
	readonly name:    string
	readonly formals: readonly string[]
	readonly guards:  Guards
	/** the definition and the names bound to it, which is what a hover finds through the origin of a call */
	readonly ids:     readonly NodeId[]
	/** where the failing code of each of the conditions is */
	readonly fails:   readonly Place[]
}

/** The contracts of the definitions in `answer`, `placeOf` telling where a node is. */
export function programContracts(answer: InspectFnGuardsQueryResult['guards'], graph: DataflowGraph, idMap: AstIdMap, placeOf: (id: NodeId) => Place): ProgramContract[] {
	return Object.entries(answer).flatMap(([raw, inferred]) => {
		const id = NodeId.normalize(raw);
		const definition = idMap.get(id);
		const stated = statedGuardsOf(inferred, idMap);
		const guards = guardsTuple(stated);
		if(!RFunctionDefinition.is(definition) || guards === undefined) {
			return [];
		}
		const holders = Dataflow.sourcesOf(graph, id, EdgeType.DefinedBy);
		const name = holders.map(h => NodeId.recoverName(h, idMap)).find(n => n !== undefined);
		const shown = definition.parameters.map(p => String(p.name.content));
		/* the same clauses statedGuardsOf keeps, in the same order as its reasons */
		const fails = inferred.clauses.filter(c => !c.rendered.includes('.Internal(')).map(c => placeOf(c.at));
		return [{ name: name ?? 'function', formals: contractFormals(shown, [], guards), guards, ids: [id, ...holders], fails, ...placeOf(id) }];
	});
}

/** the contract of a base or package function, from what the signature database states or else flowR's own table */
export function statedContract(stated: StatedGuards | undefined, params: string): { readonly guards: Guards, readonly formals: readonly string[] } | undefined {
	const guards = guardsTuple(stated);
	/* the names alone, a piece of a default holding a comma (`c("a", "b")`) is no name followed by `=` or the end */
	const shown = params.split(',').map(arg => /^\s*([\w.]+)\s*(?:=|$)/.exec(arg)?.[1]).filter(formal => formal !== undefined);
	return guards === undefined ? undefined : { guards, formals: contractFormals(shown, [], guards) };
}

/** where the signature browser looks a function up, from the playground next to it */
const search = (q: string): string => '../sigdb/?q=' + encodeURIComponent(q);

/** the condition count up to which the card of a function of the script shows the failures without asking */
const OpenUpTo = 4;

/**
 * The contract as a card: where it comes from, then the claims per formal and, folded once there are many, each condition
 * with the failure it guards against. `go` jumps to a place of the script.
 */
export function contractCard(name: string, formals: readonly string[], guards: Guards, from: { readonly program?: ProgramContract, readonly qualified?: string, readonly note?: string }, go: (place: Place) => void): HTMLElement {
	const { program, qualified = name, note } = from;
	const at = (place: Place, text: string): Part => {
		const jump = link('at', text, '#', 'go to ' + text);
		jump.addEventListener('click', event => (event.preventDefault(), go(place)));
		return jump;
	};
	const updated = guards[3] ?? '';
	const origin = program === undefined
		? [originTag(updated), ...updated === '' ? [] : [el('span', 'rver', originWords(updated))]]
		: [titled(el('span', 'origin inferred', 'inferred'), 'inferred by reading the code of ' + name + ' in this script'),
			...program.line === undefined ? [] : [at(program, (program.file === undefined ? '' : program.file + ':') + 'L' + program.line)]];
	const head = el('div', 'chead');
	head.append(el('span', 'label', 'contract'), ...origin, ...note === undefined ? [] : [titled(el('span', 'via', 'of ' + name), note)]);
	const fn = (named: string) => titled(el('code', 'fn', named.replace(/^.*::/, '')), named);
	const box = titled(contract(name, guards, formals, {
		head:    () => [head],
		search,
		located: named => [fn(named)],
		/* failing code of the script is a line to go to, that of a function of R a line of it as R prints it */
		failing: (loc, raiser, index) => {
			const place = program?.fails[index];
			if(place?.line !== undefined) {
				return { parts: [fn(raiser), ', ', at(place, (place.file === undefined ? '' : place.file + ':') + 'L' + place.line)] };
			}
			const [line, column] = loc === '' ? [] : loc.split(':').slice(-2);
			return { parts: [fn(loc === '' ? raiser : loc.split(':').slice(0, -2).join(':')), ...line === undefined ? [] : [', line ' + line + ':' + column]] };
		}
	}), 'what a call of ' + qualified + ' has to fulfill to return normally');
	const why = box.querySelector('details.why');
	if(why instanceof HTMLDetailsElement && program !== undefined && box.querySelectorAll('.crow.condition').length <= OpenUpTo) {
		why.open = true;
	}
	return box;
}

/** the line and file of a node, the file only when it is not the open one */
export function placeIn(idMap: AstIdMap, elsewhere: (node: ReturnType<AstIdMap['get']>) => string | undefined): (id: NodeId) => Place {
	return id => {
		const node = idMap.get(id);
		return { line: SourceRange.getStartLine(node?.location), file: elsewhere(node) };
	};
}
