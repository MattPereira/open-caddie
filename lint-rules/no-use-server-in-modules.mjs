// Every export of a "use server" file is a public endpoint. Module writes take
// the acting Player's id, so as endpoints a client could pass any id and bypass
// authorization. Only route actions.ts files are "use server". Scoped to
// src/modules/** in .oxlintrc.json.

const rule = {
  meta: {
    type: "problem",
    docs: { description: 'Ban "use server" directives in modules.' },
    messages: {
      useServer:
        'Modules are never "use server": wrap the write in a route actions.ts that reads the session.',
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
