// TODO: get steps before so we can get all results up untilk that point so define the order clearly somewhere
import { SubStepName } from './steps'

export type StepResults<InterestedIn extends SubStepName> = InterestedIn extends never ? Record<string, never> : { [K in InterestedIn]: Awaited<ReturnType<SubStepProcessor<K>>> }
