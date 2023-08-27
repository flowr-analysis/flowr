import { DecoratedAst, NodeId, RExpressionList, RParseRequest, RShell, TokenMap } from '../r-bridge'
import {
	doSubStep,
	StepRequired,
	STEPS_PER_FILE,
	STEPS_PER_SLICE,
	SubStepName,
	SubStepProcessor
} from './steps'
import { guard } from '../util/assert'
import { MergeableRecord } from '../util/objects'
import { SlicingCriteria } from '../slicing'
import { DataflowGraph } from '../dataflow'

type StepResults<InterestedIn extends SubStepName> = InterestedIn extends never ? Record<string, never> : { [K in InterestedIn]: Awaited<ReturnType<SubStepProcessor<K>>> }

/**
 * We split the types, as if you are only interested in what can be done per-file, you do not need a slicing criterion
 */
interface BaseSteppingSlicerInput<InterestedIn extends SubStepName[]> extends MergeableRecord {
	stepsOfInterest: InterestedIn
	shell:           RShell
	tokenMap:        TokenMap
	request:         RParseRequest
}

interface SliceSteppingSlicerInput<InterestedIn extends SubStepName[]> extends BaseSteppingSlicerInput<InterestedIn> {
	criterion: SlicingCriteria
}

export type SteppingSlicerInput<InterestedIn extends SubStepName[]> = InterestedIn extends (keyof typeof STEPS_PER_FILE)[] ?
	BaseSteppingSlicerInput<InterestedIn> : SliceSteppingSlicerInput<InterestedIn>

/**
 * This is ultimately the root representation of flowR's slicing procedure.
 * It clearly defines the steps that are to be executed and splits them into two stages.
 * - `once-per-file`: for steps that are executed once per file. These can be performed *without* the knowledge of a slicing criteria,
 *   and they can be cached and re-used if you want to slice the same file multiple times.
 * - `once-per-slice`: for steps that are executed once per slice. These can only be performed *with* a slicing criteria.
 *
 * Furthermore, this stepper follows an iterable fashion to be *as flexible as possible* (e.g., to be instrumented with measurements).
 * So, you can essentially use the stepping slicer like this:
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
 * ```
 *
 * Of course, you might think, that this is rather overkill if you simply want to receive the slice of a given input source or in general
 * the result of any step. And this is true. Therefore, if you do not want to perform some kind of magic in-between steps, you can use the
 * {@link retrieveResultOfStep} function.
 *
 * Giving the steps of interest allows you to filter 1) the steps that are executed and 2) the results that are returned.
 * So, if you pass `['slice', 'reconstruct']` as the steps of interest, you will only receive the results of these two steps (however,
 * the stepping slicer *still* performs all previous steps as they are required to obtain the slice and its reconstruction).
 *
 * **Note:** Even though, using the stepping slicer introduces some performance overhead, we consider
 * it to be the baseline for performance benchmarking. It may very well be possible to squeeze out some more performance by
 * directly constructing the steps in the right order. However, we consider this to be negligible when compared with the time required
 * for, for example, the dataflow analysis.
 *
 * @see retrieveResultOfStep
 * @see SteppingSlicer#doNextStep
 */
export class SteppingSlicer<InterestedIn extends SubStepName[]> {
	public readonly maximumNumberOfStepsPerFile = Object.keys(STEPS_PER_FILE).length
	public readonly maximumNumberOfStepsPerSlice = Object.keys(STEPS_PER_SLICE).length

	private readonly shell:           RShell
	private readonly tokenMap:        TokenMap
	private readonly stepsOfInterest: Set<InterestedIn[number]>
	private readonly request:         RParseRequest
	private readonly criterion?:      SlicingCriteria

	private results = {} as Record<string, unknown>

	private stage: StepRequired = 'once-per-file'
	private stepCounter = 0
	private wantedCounter = 0

	constructor(input: SteppingSlicerInput<InterestedIn>) {
		this.shell = input.shell
		this.tokenMap = input.tokenMap
		this.request = input.request
		this.stepsOfInterest = new Set(input.stepsOfInterest)
		this.criterion = (input as SliceSteppingSlicerInput<InterestedIn>).criterion
	}

	public getCurrentStage(): StepRequired {
		return this.stage
	}

	public switchToSliceStage(): void {
		guard(this.stepCounter === this.maximumNumberOfStepsPerFile, 'First need to complete all steps before switching')
		guard(this.stage === 'once-per-file', 'Cannot switch to next stage, already in once-per-slice stage')
		this.stage = 'once-per-slice'
	}

	public getResults(): StepResults<InterestedIn[number]> {
		guard(this.wantedCounter === this.stepsOfInterest.size, 'First we need to retrieve all desired steps')
		return this.results as StepResults<InterestedIn[number]>
	}

	/**
	 * Returns true only if 1) there are more steps to-do for the current stage and 2) there are still steps of interest
	 */
	public hasNextStep(): boolean {
		return (this.stage === 'once-per-file' ?
			this.stepCounter < this.maximumNumberOfStepsPerFile
			: this.stepCounter < this.maximumNumberOfStepsPerSlice
		) && this.wantedCounter < this.stepsOfInterest.size
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
				guard( expectedStepName === name, `Expected step ${expectedStepName} but got ${step}`)
				return name
			}

		const { step, result } = await this.doNextStep(guardStep)

		this.results[step] = result
		this.stepCounter += 1
		if(this.stepsOfInterest.has(step)) {
			this.wantedCounter += 1
		}

		return { name: step, result: result as Awaited<ReturnType<SubStepProcessor<typeof step>>>}
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
				result = await doSubStep(step, this.results.parse as string, this.tokenMap)
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
}

/**
 * Essentially a comfort variant of the {@link SteppingSlicer} which is used under the hood.
 * It performs all steps up to the given `step` and returns the corresponding result.
 * In other words, if you pass `'dataflow'` as the step, this returns the dataflow graph.
 */
export async function retrieveResultOfStep(step: SubStepName, input: Omit<SteppingSlicerInput<SubStepName[]>, 'stepsOfInterest'>): Promise<StepResults<typeof step>> {
	const slicer = new SteppingSlicer({ ...input, stepsOfInterest: [step] } as SteppingSlicerInput<SubStepName[]>)
	// we do not have to check if the name is the desired one, as this is already done with it being the 'step(s) of interest'
	while(slicer.hasNextStep()) {
		await slicer.nextStep()
	}
	slicer.switchToSliceStage()
	while(slicer.hasNextStep()) {
		await slicer.nextStep()
	}
	return slicer.getResults()
}
