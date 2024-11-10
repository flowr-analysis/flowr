/**
 * Labels can be used whenever a test name is expected, to wrap around the original
 * string and link it to functionality it refers to. As this is currently work in
 * progress, no automated linkage or validation is performed.
 * @module
 */


import { DefaultMap } from '../../../src/util/defaultmap';
import type { MergeableRecord } from '../../../src/util/objects';
import type { FlowrCapabilityWithPath, SupportedFlowrCapabilityId } from '../../../src/r-bridge/data/get';
import { getAllCapabilities } from '../../../src/r-bridge/data/get';
import { randomString } from '../../../src/util/random';

// map flowr ids to the capabilities
export const TheGlobalLabelMap: DefaultMap<string, TestLabel[]> = new DefaultMap(() => []);

function uniqueTestId(): string {
	return randomString(20);
}


const TestLabelContexts = ['parse', 'desugar', 'dataflow', 'other', 'slice', 'output', 'lineage', 'query'] as const;
export type TestLabelContext = typeof TestLabelContexts[number]

export interface TestLabel extends MergeableRecord {
	readonly id:           string
	readonly name:         string
	/** even if ids appear multiple times, we only want to count each one once */
	readonly capabilities: ReadonlySet<SupportedFlowrCapabilityId>
	/** this is automatically set (hihi) by functions like `assertAst` to correctly derive what part of capability we check */
	readonly context:      Set<TestLabelContext>
}


/**
 * Wraps a test name with a unique identifier and label it with the given ids.
 * @param testname - the name of the test (`it`) to be labeled
 * @param ids      - the capability ids to attach to the test
 * @param context  - the context in which the test is run, if not given this returns the label information for a test-helper to attach it
 */
export function label(testname: string, ids: readonly SupportedFlowrCapabilityId[], context: readonly TestLabelContext[]): string
export function label(testname: string, ids?: readonly SupportedFlowrCapabilityId[], context?: readonly TestLabelContext[]): TestLabel
export function label(testname: string, ids?: readonly SupportedFlowrCapabilityId[], context?: readonly TestLabelContext[]): TestLabel | string {
	const capabilities: Set<SupportedFlowrCapabilityId> = new Set(ids);
	const label: TestLabel = {
		id:      uniqueTestId(),
		name:    testname.toLowerCase(),
		capabilities,
		context: context === undefined ? new Set() : new Set(context)
	};

	if(capabilities.size > 0) {
		for(const i of capabilities) {
			TheGlobalLabelMap.get(i).push(label);
		}
	} else {
		TheGlobalLabelMap.get('.').push(label);
	}

	if(context === undefined) {
		return label;
	} else {
		return getFullNameOfLabel(label);
	}
}

function getFullNameOfLabel(label: TestLabel): string {
	if(label.capabilities.size === 0) {
		return `${label.name}`;
	} else {
		return `${label.name} [${[...label.capabilities].join(', ')}]`;
	}
}


export function modifyLabelName(label: TestLabel, nameModification: (name: string) => string): TestLabel
export function modifyLabelName(label: string, nameModification: (name: string) => string): string
export function modifyLabelName(label: TestLabel | string, nameModification: (name: string) => string): TestLabel | string
export function modifyLabelName(label: TestLabel | string, nameModification: (name: string) => string): TestLabel | string {
	if(typeof label === 'string') {
		return nameModification(label);
	}

	return {
		...label,
		name: nameModification(label.name)
	};
}

/**
 * Returns the full name of the testlabel and adds the respective contexts
 */
export function decorateLabelContext(label: TestLabel | string, context: readonly TestLabelContext[]): string {
	if(typeof label === 'string') {
		return label;
	}

	for(const c of context) {
		label.context.add(c);
	}

	return getFullNameOfLabel(label);
}

function printMissingCapability(label: FlowrCapabilityWithPath, testNames: readonly TestLabel[]) {
	const supportClaim = label.supported ? ` (claim: ${label.supported} supported)` : '';
	const paddedLabel = `${' '.repeat(label.path.length * 2 - 2)}[${label.path.join('/')}] ${label.name}${supportClaim}`;
	// we only have to warn if we claim to support but do not offer
	if(testNames.length === 0) {
		if(label.supported !== 'not' && label.supported !== undefined) {
			console.log(`\x1b[1;31m${paddedLabel} is not covered by any tests\x1b[0m`);
		}
	}
}

export function printMissingLabelSummary(map: Map<string, readonly TestLabel[]> | DefaultMap<string, readonly TestLabel[]> = TheGlobalLabelMap): void {
	console.log('== Test Capability Coverage (missing only)' + '='.repeat(80));
	// only list those for which we have a support claim
	const allCapabilities = [...getAllCapabilities()];
	const entries = allCapabilities.map(c => [c, map.get(c.id)] as const);

	for(const [capability, testNames] of entries) {
		printMissingCapability(capability, testNames ?? []);
	}

	console.log('-- Tests-By-Context (Systematic Only)' + '-'.repeat(80));
	const contextMap = new DefaultMap<TestLabelContext, number>(() => 0);
	const blockedIds = new Set<string>();
	for(const testNames of map.values()) {
		for(const t of testNames) {
			if(blockedIds.has(t.id)) {
				continue;
			}
			blockedIds.add(t.id);
			for(const c of t.context) {
				contextMap.set(c, contextMap.get(c) + 1);
			}
		}
	}
	for(const [context, count] of [...contextMap.entries()].sort((a, b) => a[0].localeCompare(b[0]))){
		console.log(`- ${context}: ${count}`);
	}
}
