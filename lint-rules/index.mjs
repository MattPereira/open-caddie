import playerDomainTerm from "./player-domain-term.mjs";
import serverEntryGuard from "./server-entry-guard.mjs";
import useServerOnlyInActions from "./use-server-only-in-actions.mjs";

const plugin = {
  meta: { name: "local" },
  rules: {
    "player-domain-term": playerDomainTerm,
    "server-entry-guard": serverEntryGuard,
    "use-server-only-in-actions": useServerOnlyInActions,
  },
};

export default plugin;
