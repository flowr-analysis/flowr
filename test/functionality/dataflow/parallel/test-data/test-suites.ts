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
	ClosureWithSuperAssignment,
	NestedClosuresWithSideEffects,
	CascadingSideEffects,
	SourceWithClosureAndSideEffect,
	SourceChainWithClosure,
	MultipleClosuresCapturingSameVar,
	ConditionalSideEffectAcrossFiles,
	LoopWithSideEffect,
	FunctionModifyingExternalState,
	RecursiveClosureWithSideEffect,
	CycleDetectionWithSideEffects,
	SourceFileWithSideEffect,
	ClosureWithMultipleSuperAssignments,
	SourceWithMultipleSideEffects
} from './side-effects';
import {
	ClosureWithCapture,
	FunctionCallingFunction,
	ClosureFactoryWithMultipleInstances,
	NestedFunctionShadowing,
	ClosureCapturingUpdatedBinding,
	HigherOrderFunctionComposition
} from './function-and-closures';
import {
	DirectSourceLinking,
	ChainedSourceLinking,
	FunctionReferenceThroughSource,
	SourceOrderOverridesReference,
	SourceInsideHelperFunction
} from './file-reference-linking';
import {
	CascadingSetterWithRedefinedMultiply,
	CascadingLoggerWithRedefinedPrint,
	ClosureCascadeWithRedefinedPlus
} from './cascading-side-effects-with-redefinitions';
import { RealScriptWithError, SingleFileFailures } from './real-scripts';

/**
 * Collections of Analysis Test Cases
 */

export type NamedTestCase = {
	name:                          string;
    setup:                      AnalyzerSetupFunction;
    expectReanalysisTriggered?: boolean; // Optional flag to indicate if a fallback re-analysis is expected
    expectedTriggerFileIndex?:  number; // Optional expected file index for the trigger
	expectImprecision?:            boolean; // Optional flag for cases where parallel may conservatively over-approximate
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
	{ name: 'ConditionalDefinitions', setup: ConditionalDefinitions },
	{ name: 'LoopsWithCrossFile', setup: LoopsWithCrossFile },
	{ name: 'VariableShadowing', setup: VariableShadowing }
];

export const standardFunctionAndClosureTests: TestSuite = [
	{ name: 'FunctionDefinition', setup: FunctionDefinition },
	{ name: 'NestedFunctions', setup: NestedFunctions },
	{ name: 'ClosureWithCapture', setup: ClosureWithCapture, expectImprecision: true },
	{ name: 'FunctionCallingFunction', setup: FunctionCallingFunction },
	{ name: 'ClosureFactoryWithMultipleInstances', setup: ClosureFactoryWithMultipleInstances },
	{ name: 'NestedFunctionShadowing', setup: NestedFunctionShadowing },
	{ name: 'ClosureCapturingUpdatedBinding', setup: ClosureCapturingUpdatedBinding, expectImprecision: true },
	{ name: 'HigherOrderFunctionComposition', setup: HigherOrderFunctionComposition }
];

export const sourceBasedDataflowTests: TestSuite = [
	{ name: 'SourceSimple', setup: SourceSimple },
	{ name: 'SourceMultiple', setup: SourceMultiple },
	{ name: 'SourceWithDefinitions', setup: SourceWithDefinitions },
	{ name: 'SourceChain', setup: SourceChain },
	{ name: 'SourceWithConditional', setup: SourceWithConditional }
];

export const fileReferenceLinkingTests: TestSuite = [
	{ name: 'DirectSourceLinking', setup: DirectSourceLinking },
	{ name: 'ChainedSourceLinking', setup: ChainedSourceLinking },
	{ name: 'FunctionReferenceThroughSource', setup: FunctionReferenceThroughSource },
	{ name: 'SourceOrderOverridesReference', setup: SourceOrderOverridesReference },
	{ name: 'SourceInsideHelperFunction', setup: SourceInsideHelperFunction }
];

export const builtinRedefinitionOnlyTests: TestSuite = [
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

export const sideEffectOnlyTests: TestSuite = [
	{ name: 'ClosureWithSuperAssignment', setup: ClosureWithSuperAssignment },
	{ name: 'NestedClosuresWithSideEffects', setup: NestedClosuresWithSideEffects },
	{ name: 'CascadingSideEffects', setup: CascadingSideEffects, expectImprecision: true },
	{ name: 'SourceWithClosureAndSideEffect', setup: SourceWithClosureAndSideEffect, expectImprecision: true },
	{ name: 'SourceChainWithClosure', setup: SourceChainWithClosure },
	{ name: 'MultipleClosuresCapturingSameVar', setup: MultipleClosuresCapturingSameVar, expectImprecision: true },
	{ name: 'ConditionalSideEffectAcrossFiles', setup: ConditionalSideEffectAcrossFiles, expectImprecision: true },
	{ name: 'LoopWithSideEffect', setup: LoopWithSideEffect },
	{ name: 'FunctionModifyingExternalState', setup: FunctionModifyingExternalState },
	{ name: 'RecursiveClosureWithSideEffect', setup: RecursiveClosureWithSideEffect, expectImprecision: true },
	{ name: 'CycleDetectionWithSideEffects', setup: CycleDetectionWithSideEffects, expectImprecision: true },
	{ name: 'SourceFileWithSideEffect', setup: SourceFileWithSideEffect },
	{ name: 'ClosureWithMultipleSuperAssignments', setup: ClosureWithMultipleSuperAssignments },
	{ name: 'SourceWithMultipleSideEffects', setup: SourceWithMultipleSideEffects }
];

export const cascadingSideEffectsWithRedefinitionTests: TestSuite = [
	{ name: 'CascadingSetterWithRedefinedMultiply', setup: CascadingSetterWithRedefinedMultiply },
	{ name: 'CascadingLoggerWithRedefinedPrint', setup: CascadingLoggerWithRedefinedPrint },
	{ name: 'ClosureCascadeWithRedefinedPlus', setup: ClosureCascadeWithRedefinedPlus }
];

export const realScriptTests: TestSuite = [
	{ name: 'RealScriptWithError', setup: RealScriptWithError },
	{ name: 'SingleFileFailures', setup: SingleFileFailures }
];