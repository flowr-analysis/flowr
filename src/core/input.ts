import { MergeableRecord } from '../util/objects'
import { IdGenerator, NoInfo, RParseRequest, RShell, TokenMap, XmlParserHooks } from '../r-bridge'
import { DeepPartial } from 'ts-essentials'
import { SlicingCriteria } from '../slicing'
import { SubStepName } from './steps'

/**
 * We split the types, as if you are only interested in what can be done per-file, you do not need a slicing criterion.
 * Furthermore, if you are only interested in the parse result, you do not require the token map and you can not pass hooks
 */
interface BaseSteppingSlicerInput<InterestedIn extends SubStepName | undefined> extends MergeableRecord {
	/**
	 * The step you are actually interested in.
	 * If you pass 'dataflow', the stepper will stop after analyzing the dataflow.
	 * The step is optional, if you do not pass a step, the stepper will execute all steps.
	 */
	stepOfInterest?: InterestedIn
	/** This is the {@link RShell} connection to be used to obtain the original parses AST of the R code */
	shell:           RShell
	/** The request which essentially indicates the input to extract the AST from */
	request:         RParseRequest
	/** This token map is only necessary if you need to normalize the parsed R AST as we have to deal with automatic token replacements */
	tokenMap?:       TokenMap
	/** These hooks only make sense if you at least want to normalize the parsed R AST. They can augment the normalization process */
	hooks?:          DeepPartial<XmlParserHooks>
	/** This id generator is only necessary if you want to retrieve a dataflow from the parsed R AST, it determines the id generator to use and if you are unsure, use the {@link deterministicCountingIdGenerator}*/
	getId?:          IdGenerator<NoInfo>
	/** The slicing criterion is only of interest if you actually want to slice the R code */
	criterion?:      SlicingCriteria
}

interface NormalizeSteppingSlicerInput<InterestedIn extends 'dataflow' | 'decorate' | 'normalize ast'> extends BaseSteppingSlicerInput<InterestedIn> {
	stepOfInterest: InterestedIn
	tokenMap:       TokenMap
}

interface SliceSteppingSlicerInput<InterestedIn extends 'reconstruct' | 'slice' | 'decode criteria' | undefined> extends BaseSteppingSlicerInput<InterestedIn> {
	stepOfInterest?: InterestedIn
	tokenMap:        TokenMap
	criterion:       SlicingCriteria
}

/**
 * For a given set of steps of interest, this essentially (statically) determines the required inputs for the {@link SteppingSlicer}.
 * All arguments are documented alongside {@link BaseSteppingSlicerInput}.
 */
export type SteppingSlicerInput<InterestedIn extends SubStepName | undefined = undefined> =
		InterestedIn extends 'reconstruct' | 'slice' | 'decode criteria' | undefined ? SliceSteppingSlicerInput<InterestedIn> :
			InterestedIn extends 'dataflow' | 'decorate' | 'normalize ast' ? NormalizeSteppingSlicerInput<InterestedIn> :
				BaseSteppingSlicerInput<InterestedIn>
