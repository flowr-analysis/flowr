import type { FeatureFlag } from './feature-def';
import { featureFlags } from './feature-def';

/**
 * Mutable version of the feature Flags for type safety
 */
const mutableFlags = { ...featureFlags };


/**
 *  Feature Manager object to handle interacting with Feature Flags
 */
export const FeatureManager = {
    /**
     * Checks the provided feature Flag
     * @param flag - feature to check for
     * @returns status of the feature selection
     */
	isEnabled(flag: FeatureFlag): boolean {
		return mutableFlags[flag];
	},

    /**
     * Sets the status selection flag of a feature
     * @param flag - feature to set status for
     * @param value - value to set
     */
	setFlag(flag: FeatureFlag, value: boolean): void {
		mutableFlags[flag] = value;
	},

    /**
     * Tries to load the state of each feature flag from the enviroment. If present, the default status is overwritten.
     */
	loadFromEnv(){
		(Object.keys(mutableFlags) as FeatureFlag[]).forEach(key => {
			const envValue = process.env[`FEATURE_${key.toUpperCase()}`];
			if( envValue !== undefined){
				mutableFlags[key] = envValue === 'true';
			}
		});
	}
};