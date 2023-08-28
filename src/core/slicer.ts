import {
	DecoratedAst,
	NodeId,
	RExpressionList,
	RParseRequest,
	RShell,
	TokenMap,
	XmlParserHooks
} from '../r-bridge'
import {
	doSubStep, LAST_STEP,
	StepRequired,
	STEPS_PER_FILE,
	STEPS_PER_SLICE,
	SubStepName,
	SubStepProcessor
} from './steps'
import { guard } from '../util/assert'
import { SlicingCriteria } from '../slicing'
import { DataflowGraph } from '../dataflow'
import { DeepPartial } from 'ts-essentials'
import { SteppingSlicerInput } from './intput'
import { StepResults } from './output'

/**
 * This is ultimately the root of flowR's static slicing procedure.
 * It clearly defines the steps that are to be executed and splits them into two stages.
 * - `once-per-file`: for steps that are executed once per file. These can be performed *without* the knowledge of a slicing criteria,
 *   and they can be cached and re-used if you want to slice the same file multiple times.
 * - `once-per-slice`: for steps that are executed once per slice. These can only be performed *with* a slicing criteria.
 *
 * Furthermore, this stepper follows an iterable fashion to be *as flexible as possible* (e.g., to be instrumented with measurements).
 * So, you can use the stepping slicer like this:
 *
 * ```ts
 * const slicer = new SteppingSlicer({ ... })
 * while(slicer.hasNextStep()) {
 *     await slicer.nextStep()
 * }
 *
 * slicer.switchToSliceStage()
 *
 * while(slicer.hasNextStep()) {
 *     await slicer.nextStep()
 * }
 *
 * const result = slicer.getResults()
 * ```
 *
 * Of course, you might think, that this is rather overkill if you simply want to receive the slice of a given input source or in general
 * the result of any step. And this is true. Therefore, if you do not want to perform some kind of magic in-between steps, you can use the
 * **{@link allRemainingSteps}** function like this:
 *
 * ```ts
 * const slicer = new SteppingSlicer({ ... })
 * const result = await slicer.allRemainingSteps()
 * ```
 *
 * As the name suggest, you can combine this name with previous calls to {@link nextStep} to only execute the remaining steps.
 *
 * Giving the **step of interest** allows you to declare the maximum step to execute.
 * So, if you pass `dataflow` as the step of interest, the stepping slicer will stop after the dataflow step.
 * If you do not pass a step, the stepping slicer will execute all steps.
 *
 * By default, the {@link SteppingSlicer} does not offer an automatic way to repeat the per-slice steps for multiple slices (this is mostly to prevent accidental errors).
 * However, you can use the **{@link updateCriterion}** function to reset the per-slice steps and re-execute them for a new slice. This allows something like the following:
 *
 * ```ts
 * const slicer = new SteppingSlicer({ ... })
 * const result = await slicer.allRemainingSteps()
 *
 * slicer.updateCriterion(...)
 * const result2 = await slicer.allRemainingSteps()
 * ```
 *
 * **Note:** Even though, using the stepping slicer introduces some performance overhead, we consider
 * it to be the baseline for performance benchmarking. It may very well be possible to squeeze out some more performance by
 * directly constructing the steps in the right order. However, we consider this to be negligible when compared with the time required
 * for, for example, the dataflow analysis.
 *
 * @see retrieveResultOfStep
 * @see SteppingSlicer#doNextStep
 * @see SubStepName
 */
export class SteppingSlicer<InterestedIn extends SubStepName> {
	public readonly maximumNumberOfStepsPerFile = Object.keys(STEPS_PER_FILE).length
	public readonly maximumNumberOfStepsPerSlice = Object.keys(STEPS_PER_SLICE).length

	private readonly shell:          RShell
	private readonly tokenMap?:      TokenMap
	private readonly stepOfInterest: InterestedIn
	private readonly request:        RParseRequest
	private readonly hooks?:         DeepPartial<XmlParserHooks>

	private criterion?: SlicingCriteria

	private results = {} as Record<string, unknown>

	private stage: StepRequired = 'once-per-file'
	private stepCounter = 0
	private reachedWanted = false

	constructor(input: SteppingSlicerInput<InterestedIn>) {
		this.shell = input.shell
		this.tokenMap = input.tokenMap
		this.request = input.request
		this.hooks = input.hooks
		this.stepOfInterest = input.stepOfInterest ?? LAST_STEP as InterestedIn
		this.criterion = input.criterion
	}

	/**
	 * Retrieve the current stage the stepping slicer is in.
	 * @see StepRequired
	 * @see switchToSliceStage
	 */
	public getCurrentStage(): StepRequired {
		return this.stage
	}

	/**
	 * Switch to the next stage of the stepping slicer.
	 * @see SteppingSlicer
	 * @see getCurrentStage
	 */
	public switchToSliceStage(): void {
		guard(this.stepCounter === this.maximumNumberOfStepsPerFile, 'First need to complete all steps before switching')
		guard(this.stage === 'once-per-file', 'Cannot switch to next stage, already in once-per-slice stage')
		this.stage = 'once-per-slice'
	}

	public getResults(): StepResults<InterestedIn> {
		guard(this.reachedWanted, 'Before reading the results, we need to reach the step we are interested in')
		return this.results as StepResults<InterestedIn>
	}

	/**
	 * Returns true only if 1) there are more steps to-do for the current stage and 2) we have not yet reached the step we are interested in
	 */
	public hasNextStep(): boolean {
		return (this.stage === 'once-per-file' ?
			this.stepCounter < this.maximumNumberOfStepsPerFile
			: this.stepCounter < this.maximumNumberOfStepsPerSlice
		) && !this.reachedWanted
	}

	/**
	 * Execute the next step (guarded with {@link hasNextStep}) and return the name of the step that was executed, as well as its result.
	 * The `step` parameter is a safeguard if you want to retrieve the result.
	 * If given, it causes the execution to fail if the next step is not the one you expect.
	 * *Without step, please refrain from accessing the result.*
	 */
	public async nextStep(expectedStepName?: SubStepName): Promise<{
		name:   typeof expectedStepName extends undefined ? SubStepName : typeof expectedStepName
		result: typeof expectedStepName extends undefined ? unknown : Awaited<ReturnType<SubStepProcessor<Exclude<typeof expectedStepName, undefined>>>>
	}> {
		guard(this.hasNextStep(), 'No more steps to do')

		const guardStep = expectedStepName === undefined ?
			(name: SubStepName) => name
			:
			(name: SubStepName): SubStepName => {
				guard(expectedStepName === name, `Expected step ${expectedStepName} but got ${step}`)
				return name
			}

		const { step, result } = await this.doNextStep(guardStep)

		this.results[step] = result
		this.stepCounter += 1
		if (this.stepOfInterest === step) {
			this.reachedWanted = true
		}

		return { name: step, result: result as Awaited<ReturnType<SubStepProcessor<typeof step>>> }
	}

	private async doNextStep(guardStep: (name: SubStepName) => SubStepName) {
		let step: SubStepName
		let result: unknown

		switch (this.stepCounter) {
			case 0:
				step = guardStep('parse')
				result = await doSubStep(step, this.request, this.shell)
				break
			case 1:
				step = guardStep('normalize ast')
				guard(this.tokenMap !== undefined, 'Cannot normalize ast without a token map')
				result = await doSubStep(step, this.results.parse as string, this.tokenMap, this.hooks)
				break
			case 2:
				step = guardStep('decorate')
				result = doSubStep(step, this.results.normalizeAst as RExpressionList)
				break
			case 3:
				step = guardStep('dataflow')
				result = doSubStep(step, this.results.decorate as DecoratedAst)
				break
			case 4:
				guard(this.stage === 'once-per-slice', 'Cannot decode criteria in once-per-file stage')
				guard(this.criterion !== undefined, 'Cannot decode criteria without a criterion')
				step = guardStep('decode criteria')
				result = doSubStep(step, this.criterion, this.results.decorate as DecoratedAst)
				break
			case 5:
				step = guardStep('slice')
				result = doSubStep(step, this.results.dataflow as DataflowGraph, (this.results.decorate as DecoratedAst).idMap, this.results['decode criteria'] as NodeId[])
				break
			case 6:
				step = guardStep('reconstruct')
				result = doSubStep(step, this.results.decorate as DecoratedAst, this.results.slice as Set<NodeId>)
				break
			default:
				throw new Error(`Unknown step ${this.stepCounter}, reaching this should not happen!`)
		}
		return { step, result }
	}

	/**
	 * This only makes sense if you have already sliced a file (e.g., by running up to the `slice` step) and want to do so again while caching the results.
	 * Or if for whatever reason you did not pass a criterion with the constructor.
	 *
	 * @param newCriterion - the new slicing criterion to use for the next slice
	 */
	public updateCriterion(newCriterion: SlicingCriteria): void {
		guard(this.stepCounter >= this.maximumNumberOfStepsPerFile , 'Cannot reset slice prior to once-per-slice stage')
		this.criterion = newCriterion
		this.stepCounter = this.maximumNumberOfStepsPerFile
		this.results['decode criteria'] = undefined
		this.results.slice = undefined
		this.results.reconstruct = undefined
		if(this.stepOfInterest === 'decode criteria' || this.stepOfInterest === 'slice' || this.stepOfInterest === 'reconstruct') {
			this.reachedWanted = false
		}
	}

	/**
	 * Execute all remaining steps and automatically call {@link switchToSliceStage} if necessary.
	 * @param switchStage - if true, automatically switch to the slice stage if necessary
	 * (i.e., this is what you want if you have never executed {@link nextStep} and you want to execute *all* steps).
	 * However, passing false allows you to only execute the steps of the 'once-per-file' stage (i.e., the steps that can be cached).
	 */
	public async allRemainingSteps(switchStage = true): Promise<StepResults<InterestedIn>> {
		while (this.hasNextStep()) {
			await this.nextStep()
		}
		if(switchStage && this.stage === 'once-per-file') {
			this.switchToSliceStage()
			while (this.hasNextStep()) {
				await this.nextStep()
			}
		}
		return this.getResults()
	}
}
