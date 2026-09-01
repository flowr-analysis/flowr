import { assert, describe, test } from 'vitest';
import { FlowrAnalyzerBuilder } from '../../../../src/project/flowr-analyzer-builder';
import { ClassSystem, type DeclaredClass, MemberVisibility } from '../../../../src/dataflow/fn/class-declaration';
import { applyAssumedPackages, assumedPackagesOf, assumeLoadedPackages } from '../../_helper/shell';
import { FunctionSemantics } from '../../../../src/dataflow/fn/function-semantics';


assumeLoadedPackages('R6', 'S7');

/** the classes {@link FunctionSemantics.classes.declared} finds in `code`; `attach` leaves nothing assumed, so the snippet's own `library()` has to bring the package in */
async function classesOf(code: string, attach = false): Promise<Map<string, DeclaredClass>> {
	const builder = attach ? new FlowrAnalyzerBuilder() : applyAssumedPackages(new FlowrAnalyzerBuilder(), assumedPackagesOf(undefined));
	const analyzer = await builder.build();
	analyzer.addRequest(code);
	return FunctionSemantics.classes.declared((await analyzer.dataflow()).graph);
}

/** runs `pick` over what {@link classesOf} finds in `code` and compares it against `expected` */
function testClasses(name: string, code: string, pick: (classes: Map<string, DeclaredClass>) => unknown, expected: unknown) {
	test(name, async() => {
		assert.deepEqual(pick(await classesOf(code)), expected);
	});
}

describe('S4 class declarations', () => {
	const code = `
setClass("Base", representation(x = "numeric"))
setClass("Derived", contains = "Base", slots = c(y = "character"), prototype = prototype(y = "hi"))
setClass("Abstract", representation("VIRTUAL"))
setClassUnion("NumOrChar", c("numeric", "character"))
setIs("Derived", "Abstract")
setValidity("Derived", function(object) TRUE)
`;
	testClasses('a base class states its slot types', code,
		c => ({ system: c.get('Base')?.system, members: c.get('Base')?.members }), { system: ClassSystem.S4, members: [{ name: 'x', type: 'numeric' }] });
	testClasses('a derived class states its own members and its prototype default', code,
		c => ({ members: c.get('Derived')?.members, prototype: c.get('Derived')?.prototype }), { members: [{ name: 'y', type: 'character' }], prototype: ['y'] });
	testClasses('a VIRTUAL representation cannot be instantiated, so it is virtual', code, c => c.get('Abstract')?.virtual, true);
	testClasses('a class union states the members it unites and is virtual too', code,
		c => ({ union: c.get('NumOrChar')?.union, virtual: c.get('NumOrChar')?.virtual }), { union: ['numeric', 'character'], virtual: true });
	testClasses('setValidity attributes to a class rather than declaring one, so it contributes no class of its own', code, c => c.has('object'), false);
	testClasses('setIs extends the contains chain the way it would state itself, and the superclass chain resolves it', code,
		c => ({ hasBase: (c.get('Derived')?.contains ?? []).includes('Base'), hasAbstract: (c.get('Derived')?.contains ?? []).includes('Abstract'), supers: FunctionSemantics.classes.superOf('Derived', c).toSorted() }),
		{ hasBase: true, hasAbstract: true, supers: ['Abstract', 'Base'] });
});

describe('Reference, S7 and R6 classes', () => {
	const code = `
Account <- setRefClass("Account", fields = list(balance = "numeric"), contains = "envRefClass",
                       methods = list(deposit = function(x) { balance <<- balance + x }))
Person <- R6::R6Class("Person", public = list(name = NULL, greet = function() self$name),
                      private = list(secret = 1), active = list(upper = function() toupper(self$name)))
Employee <- R6::R6Class("Employee", inherit = Person, public = list(salary = 0))
Range <- S7::new_class("Range", parent = S7::S7_object, properties = list(start = class_numeric), abstract = TRUE)
`;
	testClasses('a reference class states typed fields and its methods apart', code,
		c => ({ system: c.get('Account')?.system, contains: c.get('Account')?.contains, members: c.get('Account')?.members }),
		{ system: ClassSystem.RefClass, contains: ['envRefClass'], members: [{ name: 'balance', type: 'numeric' }, { name: 'deposit', method: true }] });
	testClasses('R6 members carry the visibility they were declared under', code,
		c => ({ system: c.get('Person')?.system, members: c.get('Person')?.members }), { system:  ClassSystem.R6, members: [
			{ name: 'name', visibility: MemberVisibility.Public }, { name: 'greet', method: true, visibility: MemberVisibility.Public },
			{ name: 'secret', visibility: MemberVisibility.Private }, { name: 'upper', method: true, visibility: MemberVisibility.Active }] });
	testClasses('an R6 parent by generator variable resolves', code,
		c => ({ byVariable: c.get('Employee')?.byVariable, contains: c.get('Employee')?.contains, supers: FunctionSemantics.classes.superOf('Employee', c) }),
		{ byVariable: ['Person'], contains: ['Person'], supers: ['Person'] });
	testClasses('an S7 class states its properties and abstractness', code,
		c => ({ system: c.get('Range')?.system, members: c.get('Range')?.members, virtual: c.get('Range')?.virtual }),
		{ system: ClassSystem.S7, members: [{ name: 'start', type: 'class_numeric' }], virtual: true });
});

describe('Handing the declarations to the signature database', () => {
	testClasses('a declared class becomes a record the package owns, with no package of its own', 'setClass("A", contains = "B", slots = c(x = "numeric"))',
		c => FunctionSemantics.classes.toSig(c)[0], { name: 'A', system: 's4', supers: ['B'], slots: [{ name: 'x', type: 'numeric' }] });
	testClasses('a superclass declared elsewhere is attributed to its package, or left out if nothing places it', 'setClass("A", contains = "B")',
		c => ({ withOwner: FunctionSemantics.classes.toSig(c, n => n === 'B' ? 'otherpkg' : undefined).find(r => r.name === 'B'), withoutOwner: FunctionSemantics.classes.toSig(c, () => undefined).length }),
		{ withOwner: { name: 'B', system: 's4', supers: [], slots: [], package: 'otherpkg' }, withoutOwner: 1 });
});

describe('library() keeps what flowR states about the exports it attaches', () => {
	/** `attachedCode` (via `library(pkg)`) must declare `className` the same way `qualifiedCode` (via `pkg::`) does */
	function testAttachedExport(name: string, attachedCode: string, qualifiedCode: string, className: string, system: ClassSystem, members?: DeclaredClass['members']) {
		test(name, async() => {
			const attached = await classesOf(attachedCode, true);
			assert.strictEqual(attached.get(className)?.system, system);
			if(members !== undefined) {
				assert.deepEqual(attached.get(className)?.members, members);
			}
			assert.deepEqual(attached.get(className)?.members, (await classesOf(qualifiedCode, true)).get(className)?.members);
		});
	}
	testAttachedExport('library(R6) declares the class R6::R6Class declares',
		'library(R6)\nP <- R6Class("P", public = list(x = 1))', 'P <- R6::R6Class("P", public = list(x = 1))',
		'P', ClassSystem.R6, [{ name: 'x', visibility: MemberVisibility.Public }]);
	testAttachedExport('library(S7) declares the class S7::new_class declares',
		'library(S7)\nR <- new_class("R", properties = list(x = class_numeric))', 'R <- S7::new_class("R", properties = list(x = class_numeric))', 'R', ClassSystem.S7);

	test('library(methods) declares the class a bare setClass declares', async() => {
		const attached = await classesOf('library(methods)\nsetClass("A", representation(x = "numeric"))', true);
		assert.strictEqual(attached.get('A')?.system, ClassSystem.S4);
		assert.deepEqual(attached.get('A')?.members, [{ name: 'x', type: 'numeric' }]);
	});

	test('a local definition of the name still shadows the attached export', async() => {
		const shadowed = await classesOf('library(R6)\nR6Class <- function(...) 1\nP <- R6Class("P")', true);
		assert.isFalse(shadowed.has('P'));
	});
});
