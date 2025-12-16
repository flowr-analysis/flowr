import type { FeatureFlag, Features } from './feature-def';
import { featureFlags } from './feature-def';



/**
 *  Feature Manager object to handle interacting with Feature Flags
 */
export class FeatureManager {
	/**
	 * Mutable version of the feature Flags for type safety
	 */
	private mutableFlags;

	constructor(flags?: Features){
		this.mutableFlags = { ...(flags ?? featureFlags) };
	}

	/**
	 * Checks the provided feature Flag
	 * @param flag - feature to check for
	 * @returns status of the feature selection
	 */
	public isEnabled(flag: FeatureFlag): boolean {
		return this.mutableFlags[flag];
	}

	/**
	 * Sets the status selection flag of a feature
	 * @param flag - feature to set status for
	 * @param value - value to set
	 */
	public setFlag(flag: FeatureFlag, value: boolean): void {
		this.mutableFlags[flag] = value;
	}

	/**
	 * Tries to load the state of each feature flag from the enviroment. If present, the default status is overwritten.
	 */
	public loadFromEnv(){
		(Object.keys(this.mutableFlags) as FeatureFlag[]).forEach(key => {
			const envValue = process.env[`FEATURE_${key.toUpperCase()}`];
			if( envValue !== undefined){
				this.mutableFlags[key] = envValue === 'true';
			}
		});
	}

	/**
	 *  Serialize this Feature Manager
	 * @returns just the flags as a readonly Instance
	 */
	public toSerializable(): Readonly<Features> {
		return this.mutableFlags;
	}

	/**
	 *  Deserialize Feature Manager
	 * @param flags - flag set to recreate the Feature Manager
	 * @returns Instance of the created Feature Manager
	 */
	public static fromSerializable(flags: Readonly<Features> | Features): FeatureManager {
		return new FeatureManager(flags);
	}
};