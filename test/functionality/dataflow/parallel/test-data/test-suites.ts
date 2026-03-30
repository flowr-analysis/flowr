import type { AnalyzerSetupFunction } from './types';
import {
	SingleFile,
	MultiDef,
	MultiFile,
	ComplexVariableChains,
	MultipleUsages,
	FunctionDefinition,
	ConditionalDefinitions,
	LoopsWithCrossFile,
	VariableShadowing,
	NestedFunctions,
	SourceSimple,
	SourceMultiple,
	SourceWithDefinitions,
	SourceChain,
	SourceWithConditional
} from './standard-cases';
import {
	RedefinedPrintUsedAcrossFiles,
	RedefinedPlusUsedAcrossFiles,
	RedefinedPrintNotUsedAcrossFiles,
	BuiltinUsedWithoutRedefinitionAcrossFiles
} from './builtin-redefinitions';
import {
	ClosureWithCapture,
	ClosureWithSuperAssignment,
	NestedClosuresWithSideEffects,
	CascadingSideEffects,
	SourceWithClosureAndSideEffect,
	SourceChainWithClosure,
	MultipleClosuresCapturingSameVar,
	ConditionalSideEffectAcrossFiles,
	LoopWithSideEffect,
	FunctionModifyingExternalState,
	RedefinedBuiltinWithClosureCapture,
	ClosureCapturingRedefinedBuiltin,
	RecursiveClosureWithSideEffect,
	CycleDetectionWithSideEffects,
	SourceFileWithSideEffect,
	EnvironmentCaptureBoundary,
	ClosureWithMultipleSuperAssignments,
	SourceWithMultipleSideEffects
} from './side-effects';

/**
 * Collections of Analysis Test Cases
 */

export type NamedTestCase = {
	name:                          string;
    setup:                      AnalyzerSetupFunction;
    expectReanalysisTriggered?: boolean; // Optional flag to indicate if a fallback re-analysis is expected
    expectedTriggerFileIndex?:  number; // Optional expected file index for the trigger
};

export type TestSuite = NamedTestCase[];

export const simpleDataflowTests: TestSuite = [
	{ name: 'SingleFile', setup: SingleFile },
	{ name: 'MultiDef', setup: MultiDef },
	{ name: 'MultiFile', setup: MultiFile }
];

export const complexDataflowTests: TestSuite = [
	{ name: 'ComplexVariableChains', setup: ComplexVariableChains },
	{ name: 'MultipleUsages', setup: MultipleUsages },
	{ name: 'FunctionDefinition', setup: FunctionDefinition },
	{ name: 'ConditionalDefinitions', setup: ConditionalDefinitions },
	{ name: 'LoopsWithCrossFile', setup: LoopsWithCrossFile },
	{ name: 'VariableShadowing', setup: VariableShadowing },
	{ name: 'NestedFunctions', setup: NestedFunctions }
];

export const sourceBasedDataflowTests: TestSuite = [
	{ name: 'SourceSimple', setup: SourceSimple },
	{ name: 'SourceMultiple', setup: SourceMultiple },
	{ name: 'SourceWithDefinitions', setup: SourceWithDefinitions },
	{ name: 'SourceChain', setup: SourceChain },
	{ name: 'SourceWithConditional', setup: SourceWithConditional }
];

export const builtinRedefinitionDataflowTests: TestSuite = [
	{
		name:  'RedefinedPrintUsedAcrossFiles',
		setup: RedefinedPrintUsedAcrossFiles,
	},
	{
		name:  'RedefinedPlusUsedAcrossFiles',
		setup: RedefinedPlusUsedAcrossFiles,
	},
	{
		name:  'RedefinedPrintNotUsedAcrossFiles',
		setup: RedefinedPrintNotUsedAcrossFiles,
	},
	{
		name:  'BuiltinUsedWithoutRedefinitionAcrossFiles',
		setup: BuiltinUsedWithoutRedefinitionAcrossFiles,
	}
];

export const closureAndSideEffectTests: TestSuite = [
	{ name: 'ClosureWithCapture', setup: ClosureWithCapture },
	{ name: 'ClosureWithSuperAssignment', setup: ClosureWithSuperAssignment },
	{ name: 'NestedClosuresWithSideEffects', setup: NestedClosuresWithSideEffects },
	{ name: 'CascadingSideEffects', setup: CascadingSideEffects },
	{ name: 'SourceWithClosureAndSideEffect', setup: SourceWithClosureAndSideEffect },
	{ name: 'SourceChainWithClosure', setup: SourceChainWithClosure },
	{ name: 'MultipleClosuresCapturingSameVar', setup: MultipleClosuresCapturingSameVar },
	{ name: 'ConditionalSideEffectAcrossFiles', setup: ConditionalSideEffectAcrossFiles },
	{ name: 'LoopWithSideEffect', setup: LoopWithSideEffect },
	{ name: 'FunctionModifyingExternalState', setup: FunctionModifyingExternalState }
];

/**
 * Test suite for interaction between redefinitions and closures
 *
 * Ensures that parallel analysis handles cases where:
 * - Built-ins are redefined and captured by closures
 * - Closures capture variables that are later modified by side effects
 */
export const redefinitionAndClosureInteractionTests: TestSuite = [
	{ name: 'RedefinedBuiltinWithClosureCapture', setup: RedefinedBuiltinWithClosureCapture },
	{ name: 'ClosureCapturingRedefinedBuiltin', setup: ClosureCapturingRedefinedBuiltin }
];

/**
 * Test suite for advanced side-effect scenarios
 *
 * Covers complex cases like recursion, cycles, sourcing with side effects,
 * and environment boundary issues.
 */
export const advancedSideEffectTests: TestSuite = [
	{ name: 'RecursiveClosureWithSideEffect', setup: RecursiveClosureWithSideEffect },
	{ name: 'CycleDetectionWithSideEffects', setup: CycleDetectionWithSideEffects },
	{ name: 'SourceFileWithSideEffect', setup: SourceFileWithSideEffect },
	{ name: 'EnvironmentCaptureBoundary', setup: EnvironmentCaptureBoundary },
	{ name: 'ClosureWithMultipleSuperAssignments', setup: ClosureWithMultipleSuperAssignments },
	{ name: 'SourceWithMultipleSideEffects', setup: SourceWithMultipleSideEffects }
];
