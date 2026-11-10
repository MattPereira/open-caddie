// ADR 0007: Player is the domain term; User names only the sign-in identity.
// Files on the sign-in side are exempted in eslint.config.mjs.

// Matched by word, so `useRef` and `username` (the Player's handle) pass.
const BANNED_WORDS = new Set(["user", "users"]);

// Names with a "user" word that don't mean the domain person.
const ALLOWED = [
  /^users$/, // the Auth.js `user` table's Drizzle export
  /^User\w*Icon$/, // third-party icon components
  /user_?prompt/i, // the LLM "user" message role
  /^userAgent$/, // HTTP and robots.txt user agent
];

function words(name) {
  return name.split(/_|(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/);
}

function isBanned(name) {
  return (
    words(name).some((word) => BANNED_WORDS.has(word.toLowerCase())) &&
    !ALLOWED.some((pattern) => pattern.test(name))
  );
}

// Accessing a name doesn't introduce it. Third-party shapes (`session.user`,
// `process.env.DATABASE_USER`) are only ever accessed; any name declared here
// is reported where it's declared.
function isPropertyAccess(node) {
  const parent = node.parent;
  return (
    (parent.type === "MemberExpression" &&
      parent.property === node &&
      !parent.computed) ||
    (parent.type === "TSQualifiedName" && parent.right === node)
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
