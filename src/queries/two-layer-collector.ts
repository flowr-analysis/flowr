/** two layer map abstraction */
export class TwoLayerCollector<Layer1 extends string, Layer2 extends string, Values> {
	readonly store = new Map<Layer1, Map<Layer2, Values[]>>();

	public add(layer1: Layer1, layer2: Layer2, value: Values) {
		let layer2Map = this.store.get(layer1);
		if(layer2Map === undefined) {
			layer2Map = new Map<Layer2, Values[]>();
			this.store.set(layer1, layer2Map);
		}
		let values = layer2Map.get(layer2);
		if(values === undefined) {
			values = [];
			layer2Map.set(layer2, values);
		}
		values.push(value);
	}

	public get(layer1: Layer1, layer2: Layer2): Values[] | undefined {
		return this.store.get(layer1)?.get(layer2);
	}

	public outerKeys(): Iterable<Layer1> {
		return this.store.keys();
	}

	public innerKeys(layer1: Layer1): Iterable<Layer2> {
		return this.store.get(layer1)?.keys() ?? [];
	}
}
