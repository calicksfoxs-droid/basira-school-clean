import Module from "node:module";

// minimatch 3 (a transitive dependency of the current Next lint plugins)
// imports brace-expansion as a CommonJS function. brace-expansion 5 safely
// exposes the same function as `expand`; adapt only that legacy caller at
// runtime, leaving the installed package and its security fixes untouched.
const originalLoad = Module._load;

Module._load = function patchedLoad(request, parent, isMain) {
  const loaded = originalLoad.call(this, request, parent, isMain);
  if (
    request === "brace-expansion" &&
    parent?.filename?.includes("minimatch") &&
    typeof loaded?.expand === "function"
  ) {
    return loaded.expand;
  }
  return loaded;
};
