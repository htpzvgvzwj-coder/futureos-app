// Tiny server-side schema validator (Usable RC, section 十四). No
// dependency - the codebase has no ORM/framework abstractions. Enough to
// reject bad request bodies with a clear error instead of a 500.
//
//   const S = obj({ amount: num({ min: 0 }), kind: enumOf(["a","b"]), note: opt(str()) });
//   const { ok, value, errors } = S(body);

function fail(path, msg) {
  return { path, msg };
}

export function str({ min = 0, max = 10000, pattern = null } = {}) {
  return (v, path) => {
    if (typeof v !== "string") return { errors: [fail(path, "must be a string")] };
    if (v.length < min) return { errors: [fail(path, `must be at least ${min} chars`)] };
    if (v.length > max) return { errors: [fail(path, `must be at most ${max} chars`)] };
    if (pattern && !pattern.test(v)) return { errors: [fail(path, "has an invalid format")] };
    return { value: v };
  };
}

export function num({ min = -Infinity, max = Infinity, integer = false } = {}) {
  return (v, path) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return { errors: [fail(path, "must be a number")] };
    if (integer && !Number.isInteger(n)) return { errors: [fail(path, "must be an integer")] };
    if (n < min) return { errors: [fail(path, `must be >= ${min}`)] };
    if (n > max) return { errors: [fail(path, `must be <= ${max}`)] };
    return { value: n };
  };
}

export function bool() {
  return (v, path) => (typeof v === "boolean" ? { value: v } : { errors: [fail(path, "must be a boolean")] });
}

export function enumOf(values) {
  return (v, path) => (values.includes(v) ? { value: v } : { errors: [fail(path, `must be one of ${values.join(", ")}`)] });
}

export function isoDate() {
  return (v, path) => {
    if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(v) || Number.isNaN(Date.parse(v))) {
      return { errors: [fail(path, "must be an ISO date")] };
    }
    return { value: v.slice(0, 10) };
  };
}

export function opt(inner) {
  return (v, path) => (v == null || v === "" ? { value: null } : inner(v, path));
}

export function arrayOf(inner, { max = 5000 } = {}) {
  return (v, path) => {
    if (!Array.isArray(v)) return { errors: [fail(path, "must be an array")] };
    if (v.length > max) return { errors: [fail(path, `at most ${max} items`)] };
    const out = [];
    const errors = [];
    v.forEach((item, i) => {
      const r = inner(item, `${path}[${i}]`);
      if (r.errors) errors.push(...r.errors);
      else out.push(r.value);
    });
    return errors.length ? { errors } : { value: out };
  };
}

export function obj(shape, { allowUnknown = false } = {}) {
  return (v, path = "$") => {
    if (v == null || typeof v !== "object" || Array.isArray(v)) return { ok: false, errors: [fail(path, "must be an object")] };
    const out = {};
    const errors = [];
    for (const [key, validator] of Object.entries(shape)) {
      const r = validator(v[key], `${path}.${key}`);
      if (r.errors) errors.push(...r.errors);
      else out[key] = r.value;
    }
    if (!allowUnknown) {
      for (const key of Object.keys(v)) {
        if (!(key in shape)) errors.push(fail(`${path}.${key}`, "unknown field"));
      }
    }
    return errors.length ? { ok: false, errors } : { ok: true, value: out };
  };
}

// Convenience for a route: returns a Response on failure, or the parsed value.
export function parseOr400(schema, body) {
  const r = schema(body ?? {});
  if (!r.ok) {
    return {
      response: Response.json(
        { error: "invalid_request", details: r.errors.map((e) => `${e.path}: ${e.msg}`) },
        { status: 400 },
      ),
    };
  }
  return { value: r.value };
}
