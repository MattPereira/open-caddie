// ADR 0007: Player is the domain term; User names only the sign-in identity.
// Files on the sign-in side are exempted in eslint.config.mjs.

// Matched by word, so `useRef` and `username` (the Player's handle) pass.
const BANNED_WORDS = new Set(["user", "users"]);

// Names with a "user" word that don't mean the domain person.
const ALLOWED = [
  /^(?:\w*User|user)Prompt$|^(?:\w+_)?USER_PROMPT$/, // the LLM "user" message role
  /^userAgent$/, // HTTP and robots.txt user agent
];

const SCHEMA_MODULE = "@/db/schema";
const SCHEMA_FILE = /(?:^|[\\/])db[\\/]schema\.ts$/;

function words(name) {
  return name.split(/_|(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/);
}

function isBanned(name) {
  return (
    words(name).some((word) => BANNED_WORDS.has(word.toLowerCase())) &&
    !ALLOWED.some((pattern) => pattern.test(name))
  );
}

// The ImportDeclaration that binds this identifier, whether it is the import
// specifier itself or a reference to one.
function importOf(node, sourceCode) {
  if (node.parent.type.startsWith("Import") && node.parent.local === node) {
    return node.parent.parent;
  }
  for (let scope = sourceCode.getScope(node); scope; scope = scope.upper) {
    const reference = scope.references.find((r) => r.identifier === node);
    if (!reference) continue;
    const def = reference.resolved?.defs[0];
    return def?.type === "ImportBinding" ? def.parent : null;
  }
  return null;
}

// Allowed only as bindings of the real thing, so a local `users` or
// `UserFooIcon` is still reported.
function isAllowedBinding(node, context) {
  const { name } = node;
  if (name === "users") {
    if (SCHEMA_FILE.test(context.filename)) return true;
    return importOf(node, context.sourceCode)?.source.value === SCHEMA_MODULE;
  }
  if (/^User\w*Icon$/.test(name)) {
    return importOf(node, context.sourceCode) != null;
  }
  return false;
}

// Accessing a name doesn't introduce it. Third-party shapes (`session.user`,
// `process.env.DATABASE_USER`, the imported side of `import { a as b }`) are
// only ever accessed; any name declared here is reported where it's declared.
function isPropertyAccess(node) {
  const parent = node.parent;
  return (
    (parent.type === "MemberExpression" &&
      parent.property === node &&
      !parent.computed) ||
    (parent.type === "TSQualifiedName" && parent.right === node) ||
    (parent.type === "ImportSpecifier" &&
      parent.imported === node &&
      parent.local !== node)
  );
}

/** @type {import("eslint").Rule.RuleModule} */
const rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Ban User-named identifiers in domain code; say Player (ADR 0007).",
    },
    messages: {
      domainTerm:
        "'{{name}}' says User; domain code says Player (ADR 0007). User is only the sign-in identity.",
    },
    schema: [],
  },
  create(context) {
    function check(node) {
      if (!isBanned(node.name)) return;
      if (isPropertyAccess(node)) return;
      if (isAllowedBinding(node, context)) return;
      context.report({ node, messageId: "domainTerm", data: { name: node.name } });
    }
    return {
      Identifier: check,
      JSXIdentifier(node) {
        if (node.parent.type === "JSXAttribute") check(node);
      },
    };
  },
};

const plugin = { rules: { "player-domain-term": rule } };

export default plugin;
