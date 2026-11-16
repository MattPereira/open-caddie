// A module's server.ts exposes db, session and secret-touching code. Importing
// "server-only" first turns an accidental client import into a build error
// instead of a bundled server module. Scoped to src/modules/*/server.ts in
// .oxlintrc.json.

const rule = {
  meta: {
    type: "problem",
    docs: { description: 'Require server.ts to import "server-only" first.' },
    messages: {
      missing: 'A module server.ts must start with `import "server-only";`.',
    },
    schema: [],
  },
  create(context) {
    return {
      Program(node) {
        const first = node.body[0];
        const guarded =
          first?.type === "ImportDeclaration" &&
          first.source.value === "server-only" &&
          first.specifiers.length === 0;
        if (!guarded)
          context.report({ node: first ?? node, messageId: "missing" });
      },
    };
  },
};

export default rule;
