import type { FeatureFlag } from './feature-def';
import { featureFlags } from './feature-def';



/**
 *  Feature Manager object to handle interacting with Feature Flags
*/
export class FeatureManager {
	/**
	 * Mutable version of the feature Flags for type safety
	 */
	private mutableFlags;

	constructor(flags?: typeof featureFlags){
		this.mutableFlags = {...(flags ?? featureFlags)};
	}

	/**
	 * Checks the provided feature Flag
	 * @param flag - feature to check for
	 * @returns status of the feature selection
	 */
	isEnabled(flag: FeatureFlag): boolean {
		return this.mutableFlags[flag];
	}

	/**
	 * Sets the status selection flag of a feature
	 * @param flag - feature to set status for
	 * @param value - value to set
	 */
	setFlag(flag: FeatureFlag, value: boolean): void {
		this.mutableFlags[flag] = value;
	}

	/**
	 * Tries to load the state of each feature flag from the enviroment. If present, the default status is overwritten.
	 */
	loadFromEnv(){
		(Object.keys(this.mutableFlags) as FeatureFlag[]).forEach(key => {
			const envValue = process.env[`FEATURE_${key.toUpperCase()}`];
			if( envValue !== undefined){
				this.mutableFlags[key] = envValue === 'true';
			}
		});
	}
};