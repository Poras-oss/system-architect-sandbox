global.localStorage = { getItem: () => null, setItem: () => {} };
global.window = { matchMedia: () => ({ matches: false }) } as any;
import useStore from "./src/store/useStore.ts";
console.log("useStore keys:", Object.keys(useStore));
console.log("useStore.temporal:", useStore.temporal);
