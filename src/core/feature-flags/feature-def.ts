export const featureFlags = {
	paralleliseFiles:              false,
	paralleliseDataflowOperations: false,
};

export type FeatureFlag = keyof typeof featureFlags;