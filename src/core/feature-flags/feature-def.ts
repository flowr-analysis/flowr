export const featureFlags = {
	paralleliseFiles:              false,
	paralleliseDataflowOperations: false,
};

export type FeatureFlag = keyof typeof featureFlags;
export type Features = typeof featureFlags;