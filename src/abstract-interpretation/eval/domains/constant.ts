
type ConstInterval = {
  kind: "const",
  value: String,
};

type Test<S extends String> = {
  kind: S
}

export type ConstDomain
