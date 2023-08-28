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

interface NormalizeSteppingSlicerInput<InterestedIn extends SubStepName | undefined> extends BaseSteppingSlicerInput<InterestedIn> {
	tokenMap: TokenMap
}

interface DecorateSteppingSlicerInput<InterestedIn extends SubStepName | undefined> extends NormalizeSteppingSlicerInput<InterestedIn> {
	getId: IdGenerator<NoInfo>
}


interface SliceSteppingSlicerInput<InterestedIn extends SubStepName | undefined> extends DecorateSteppingSlicerInput<InterestedIn> {
	criterion: SlicingCriteria
}

/**
 * For a given set of steps of interest, this essentially (statically) determines the required inputs for the {@link SteppingSlicer}.
 * All arguments are documented alongside {@link BaseSteppingSlicerInput}.
 */
export type SteppingSlicerInput<InterestedIn extends SubStepName | undefined = undefined> =
// we are interested in a step that requires the slicing criteria
	'reconstruct' extends InterestedIn ? SliceSteppingSlicerInput<InterestedIn> :
		'slice' extends InterestedIn ? SliceSteppingSlicerInput<InterestedIn> :
			'decode criteria' extends InterestedIn ? SliceSteppingSlicerInput<InterestedIn> :
				// we are interested in a step that does not require the slicing criteria but at least needs to normalize
				'dataflow' extends InterestedIn ? DecorateSteppingSlicerInput<InterestedIn> :
					'decorate' extends InterestedIn ? DecorateSteppingSlicerInput<InterestedIn> :
						// we are interested in normalize step which does not yet require the id generator
						'normalize ast' extends InterestedIn ? NormalizeSteppingSlicerInput<InterestedIn> :
							// we are only interested in the parse step
							BaseSteppingSlicerInput<InterestedIn>
