import noUseServerInModules from "./no-use-server-in-modules.mjs";
import playerDomainTerm from "./player-domain-term.mjs";

const plugin = {
  meta: { name: "local" },
  rules: {
    "no-use-server-in-modules": noUseServerInModules,
    "player-domain-term": playerDomainTerm,
  },
};

export default plugin;
