import { assert, describe, test } from 'vitest';
import { FlowrAnalyzerBuilder } from '../../../../src/project/flowr-analyzer-builder';
import {
	ClassSystem,
	type DeclaredClass,
	MemberVisibility,
	declaredClasses,
	superClassesOf,
	toSigClasses
} from '../../../../src/dataflow/fn/class-declaration';
import { applyAssumedPackages, assumedPackagesOf, assumeLoadedPackages } from '../../_helper/shell';

assumeLoadedPackages('R6', 'S7');


async function classesOf(code: string): Promise<Map<string, DeclaredClass>> {
	const analyzer = await applyAssumedPackages(new FlowrAnalyzerBuilder(), assumedPackagesOf(undefined)).build();
	analyzer.addRequest(code);
	return declaredClasses((await analyzer.dataflow()).graph);
}

/**
 * As {@link classesOf}, but with nothing assumed attached, so the snippet's own `library()` is what has to bring
 * the package in -- attaching a package must not disable what flowR states about its exports.
 */
async function classesOfAttaching(code: string): Promise<Map<string, DeclaredClass>> {
	const analyzer = await new FlowrAnalyzerBuilder().build();
	analyzer.addRequest(code);
	return declaredClasses((await analyzer.dataflow()).graph);
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

	test('slots, their declared types and the contains chain', async() => {
		const classes = await classesOf(code);
		const base = classes.get('Base');
		assert.strictEqual(base?.system, ClassSystem.S4);
		assert.deepEqual(base?.members, [{ name: 'x', type: 'numeric' }]);
		const derived = classes.get('Derived');
		assert.deepEqual(derived?.members, [{ name: 'y', type: 'character' }]);
		assert.include(derived?.contains ?? [], 'Base');
		assert.deepEqual(derived?.prototype, ['y']);
	});

	test('a representation("VIRTUAL") class cannot be instantiated', async() => {
		assert.isTrue((await classesOf(code)).get('Abstract')?.virtual);
	});

	test('setClassUnion states its members and is virtual', async() => {
		const union = (await classesOf(code)).get('NumOrChar');
		assert.deepEqual(union?.union, ['numeric', 'character']);
		assert.isTrue(union?.virtual);
	});

	test('setIs adds the is-a relation contains would have stated', async() => {
		assert.include((await classesOf(code)).get('Derived')?.contains ?? [], 'Abstract');
	});

	test('setValidity attributes to a class rather than declaring one', async() => {
		/* it states a relation, so it contributes no class of its own */
		assert.isFalse((await classesOf(code)).has('object'));
	});

	test('the superclass chain is resolved transitively', async() => {
		const classes = await classesOf(code);
		assert.deepEqual(superClassesOf('Derived', classes).toSorted(), ['Abstract', 'Base']);
	});
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

	test('a reference class states typed fields and its methods apart', async() => {
		const account = (await classesOf(code)).get('Account');
		assert.strictEqual(account?.system, ClassSystem.RefClass);
		assert.deepEqual(account?.contains, ['envRefClass']);
		assert.deepEqual(account?.members, [{ name: 'balance', type: 'numeric' }, { name: 'deposit', method: true }]);
	});

	test('R6 members carry the visibility they were declared under', async() => {
		const person = (await classesOf(code)).get('Person');
		assert.strictEqual(person?.system, ClassSystem.R6);
		assert.deepEqual(person?.members, [
			{ name: 'name', visibility: MemberVisibility.Public },
			{ name: 'greet', method: true, visibility: MemberVisibility.Public },
			{ name: 'secret', visibility: MemberVisibility.Private },
			{ name: 'upper', method: true, visibility: MemberVisibility.Active }
		]);
	});

	test('an R6 parent named by its generator variable resolves to the class it declares', async() => {
		const classes = await classesOf(code);
		assert.deepEqual(classes.get('Employee')?.byVariable, ['Person']);
		assert.deepEqual(classes.get('Employee')?.contains, ['Person']);
		assert.deepEqual(superClassesOf('Employee', classes), ['Person']);
	});

	test('an S7 class states its properties and abstractness', async() => {
		const range = (await classesOf(code)).get('Range');
		assert.strictEqual(range?.system, ClassSystem.S7);
		assert.deepEqual(range?.members, [{ name: 'start', type: 'class_numeric' }]);
		assert.isTrue(range?.virtual);
	});
});

describe('Handing the declarations to the signature database', () => {
	test('a declared class becomes a record the package owns', async() => {
		const classes = await classesOf('setClass("A", contains = "B", slots = c(x = "numeric"))');
		const [record] = toSigClasses(classes);
		assert.deepEqual(record, { name: 'A', system: 's4', supers: ['B'], slots: [{ name: 'x', type: 'numeric' }] });
		assert.isUndefined(record.package, 'a class the package declares is its own');
	});

	test('a superclass declared elsewhere is attributed to the package defining it', async() => {
		const classes = await classesOf('setClass("A", contains = "B")');
		const records = toSigClasses(classes, name => name === 'B' ? 'otherpkg' : undefined);
		assert.deepEqual(records.find(r => r.name === 'B'),
			{ name: 'B', system: 's4', supers: [], slots: [], package: 'otherpkg' });
	});

	test('a class nothing can place is left out rather than invented', async() => {
		const classes = await classesOf('setClass("A", contains = "B")');
		assert.lengthOf(toSigClasses(classes, () => undefined), 1);
	});
});

describe('library() keeps what flowR states about the exports it attaches', () => {
	test('library(R6) declares the class R6::R6Class declares', async() => {
		const attached = await classesOfAttaching('library(R6)\nP <- R6Class("P", public = list(x = 1))');
		assert.strictEqual(attached.get('P')?.system, ClassSystem.R6);
		assert.deepEqual(attached.get('P')?.members, [{ name: 'x', visibility: MemberVisibility.Public }]);
		/* the qualified call is what the attached export has to keep meaning (the ids differ by the library line) */
		const qualified = await classesOfAttaching('P <- R6::R6Class("P", public = list(x = 1))');
		assert.deepEqual(attached.get('P')?.members, qualified.get('P')?.members);
	});

	test('library(S7) declares the class S7::new_class declares', async() => {
		const attached = await classesOfAttaching('library(S7)\nR <- new_class("R", properties = list(x = class_numeric))');
		assert.strictEqual(attached.get('R')?.system, ClassSystem.S7);
		const qualified = await classesOfAttaching('R <- S7::new_class("R", properties = list(x = class_numeric))');
		assert.deepEqual(attached.get('R')?.members, qualified.get('R')?.members);
	});

	test('library(methods) declares the class a bare setClass declares', async() => {
		const attached = await classesOfAttaching('library(methods)\nsetClass("A", representation(x = "numeric"))');
		assert.strictEqual(attached.get('A')?.system, ClassSystem.S4);
		assert.deepEqual(attached.get('A')?.members, [{ name: 'x', type: 'numeric' }]);
	});

	test('a local definition of the name still shadows the attached export', async() => {
		const shadowed = await classesOfAttaching('library(R6)\nR6Class <- function(...) 1\nP <- R6Class("P")');
		assert.isFalse(shadowed.has('P'));
	});
});
