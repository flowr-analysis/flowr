import type { BrandedIdentifier } from '../../environments/identifier';
import type { GuardFactsLookup } from '../../environments/guard-facts';
import { s3GroupGenericOf } from '../../environments/group-generics';
import { RGroupMethodGuards } from '../../../data/r-group-method-guards.generated';
import { GuardTerm } from './guard-term';

/**
 * What a value of a class vector R makes, like `c("POSIXct", "POSIXt")`, runs for a member of a group generic, and what that asks:
 * the method of the base packages dispatch finds for it.
 */
export interface GroupMethodGuard {
	/** the class vector, as `oldClass` returns it */
	readonly classes:  readonly string[]
	/** the method, written `generic.class` */
	readonly method:   string
	/** the formals of the method, the first ones standing for what is dispatched on */
	readonly formals:  readonly BrandedIdentifier[]
	/** what the method asks of its formals for the member, `.Generic` being its name */
	readonly requires: GuardTerm
}

/* what these read is the frame of the method, which the call of the member does not have */
const OfTheFrame: ReadonlySet<BrandedIdentifier> = new Set(['nargs', 'missing', 'sys.call', 'sys.function', 'match.call', 'parent.frame', 'environment', 'NextMethod', 'UseMethod', 'standardGeneric', 'callGeneric', 'on.exit']);

/** The condition with every part that reads the frame of the method weakened into `TRUE`, the condition being in negation normal form. */
function withoutFrame(this: void, term: GuardTerm): GuardTerm {
	if(GuardTerm.isCall(term) && term.known && (term.fn === '&&' || term.fn === '||')) {
		const operands = term.args.map(a => withoutFrame(a.value));
		return term.fn === '&&' ? GuardTerm.all(...operands) : GuardTerm.any(...operands);
	}
	return [...OfTheFrame].some(fn => GuardTerm.mentions(term, fn)) ? GuardTerm.True : term;
}

/** The operands a member of the group dispatches on: both of an operator, the first one else. */
export function dispatchedOperands(this: void, name: BrandedIdentifier): number {
	return s3GroupGenericOf(name) === 'Ops' ? 2 : 1;
}

/**
 * What the methods the base packages define for the classes of R's own values ask on a call of the member `name` of a group generic,
 * each as a condition that holds unless the operand is of another class: R does not look for a method of an operand without a class,
 * and one of a class outside these may bring a method from anywhere, so all that is stated is what these classes run.
 * @param name      - the member called, like `sin`
 * @param operands  - what the call hands over for what is dispatched on, `undefined` where flowR cannot state it, and a constant having no class
 * @param excluded  - the classes with a method of the program, which may run instead
 */
export function groupMethodConditions(this: void, name: BrandedIdentifier, operands: readonly (GuardTerm | undefined)[], excluded: ReadonlySet<string>, facts?: GuardFactsLookup): GuardTerm[] {
	const entries = RGroupMethodGuards[String(name)] ?? [];
	const dispatched = operands.slice(0, dispatchedOperands(name));
	/* the classes asking the same, so that each operand needs only one condition for them */
	const byAsked = new Map<string, { readonly asked: GuardTerm, readonly classes: (readonly string[])[] }>();
	for(const { classes, formals, requires } of entries.filter(e => !e.classes.some(c => excluded.has(c)))) {
		const asked = GuardTerm.substituteCondition(withoutFrame(requires), new Map(formals.slice(0, dispatched.length).flatMap((f, at) => {
			const operand = dispatched[at];
			return operand === undefined ? [] : [[f, operand] as const];
		})), undefined, facts);
		const key = GuardTerm.render(asked);
		if(!GuardTerm.isTrue(asked)) {
			byAsked.set(key, { asked, classes: [...byAsked.get(key)?.classes ?? [], classes] });
		}
	}
	return [...byAsked.values()].flatMap(({ asked, classes }) => dispatched.flatMap((operand, at) => {
		/* the other operand having a class may bring a method of its own */
		const others = dispatched.filter((_, i) => i !== at);
		if(operand === undefined || operand.kind === 'constant' || others.includes(undefined)) {
			return [];
		}
		const notOfClass = classes.map(cls => GuardTerm.known('!', GuardTerm.known('identical', GuardTerm.known('oldClass', operand), cls.length === 1 ? GuardTerm.string(cls[0]) : GuardTerm.known('c', ...cls.map(GuardTerm.string)))));
		const classed = (others as GuardTerm[]).filter(o => o.kind !== 'constant').map(o => GuardTerm.known('is.object', o));
		return [GuardTerm.any(GuardTerm.all(...notOfClass), ...classed, asked)];
	}));
}
