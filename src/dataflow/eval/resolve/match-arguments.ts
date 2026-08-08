import type { RNodeWithParent } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { EmptyArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RType } from '../../../r-bridge/lang-4.x/ast/model/type';

/** what one declared parameter was given: nothing, one argument, or -- for `...` -- every argument it collected */
export type MatchedArgument = RNodeWithParent | readonly RNodeWithParent[] | undefined;

/**
 * The arguments of a call, one slot per declared parameter, matched the way R does: a named argument goes to
 * the parameter it names, the rest fill the remaining slots left to right, and a `...` parameter collects
 * everything that is left over (positional arguments from its position on, and named ones matching no other
 * parameter). Parameters in `ignored` may be supplied but get no slot, for the ones that change nothing about
 * what the call yields.
 *
 * `undefined` when the call cannot be the one `params` describes: an argument that names an unknown parameter
 * with no `...` to absorb it, one parameter given twice, or more arguments than there are slots. The value
 * solver relies on that, since a call it cannot match is one whose result it must not guess at.
 */
export function matchCallArguments(node: RNodeWithParent, params: readonly string[], ignored: readonly string[] = []): MatchedArgument[] | undefined {
	if(node.type === RType.UnaryOp) {
		return [node.operand];
	} else if(node.type === RType.BinaryOp) {
		return [node.lhs, node.rhs];
	} else if(node.type !== RType.FunctionCall || !node.named) {
		return undefined;
	}
	const rest = params.indexOf('...');
	const matched: MatchedArgument[] = params.map(() => undefined);
	// what `...` collects, remembered with the position it was written at, since R keeps them in source order
	const collected: { at: number, value: RNodeWithParent }[] = [];
	const positional: { at: number, value: RNodeWithParent }[] = [];
	// R matches every named argument before it gives a slot to a positional one, so this takes two passes
	for(const [at, arg] of node.arguments.entries()) {
		if(arg === EmptyArgument || arg.value === undefined) {
			continue;
		} else if(arg.name === undefined) {
			positional.push({ at, value: arg.value });
			continue;
		}
		const name = arg.name.content;
		if(ignored.includes(name)) {
			continue;
		}
		const to = params.indexOf(name);
		if(to >= 0 && to !== rest) {
			if(matched[to] !== undefined) {
				return undefined;   // the same parameter twice, which R would reject too
			}
			matched[to] = arg.value;
		} else if(rest >= 0) {
			collected.push({ at, value: arg.value });   // a name no parameter carries falls into `...`, as it does in R
		} else {
			return undefined;
		}
	}
	// the slots before `...` take positional arguments in order, everything from there on `...` collects
	for(const entry of positional) {
		const free = matched.findIndex((m, i) => m === undefined && i !== rest);
		if(free >= 0 && (rest < 0 || free < rest)) {
			matched[free] = entry.value;
		} else if(rest >= 0) {
			collected.push(entry);
		} else {
			return undefined;   // more arguments than the parameters describe, so this is another call
		}
	}
	if(rest >= 0) {
		matched[rest] = collected.sort((a, b) => a.at - b.at).map(e => e.value);
	}
	return matched;
}
