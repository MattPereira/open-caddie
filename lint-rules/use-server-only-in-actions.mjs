// Every export of a "use server" file is a public endpoint. Module writes take
// the acting Player's id, so as endpoints a client could pass any id and bypass
// authorization. Only route actions.ts files, which read the session, may be
// "use server". Scoped to src/** minus src/app/**/actions.ts in .oxlintrc.json.

const rule = {
  meta: {
    type: "problem",
    docs: { description: 'Allow "use server" only in route actions.ts files.' },
    messages: {
      useServer:
        '"use server" belongs only in a route actions.ts that reads the session: every export here would be a public endpoint.',
    },
    schema: [],
  },
  create(context) {
    return {
      ExpressionStatement(node) {
        if (node.directive === "use server") {
          context.report({ node, messageId: "useServer" });
        }
      },
    };
  },
};

export default rule;
