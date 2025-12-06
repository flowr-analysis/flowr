export const featureFlags = {
	paralleliseFiles: true,
};

export type FeatureFlag = keyof typeof featureFlags;