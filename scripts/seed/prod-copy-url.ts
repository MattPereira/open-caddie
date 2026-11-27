export const PROD_COPY_DATABASE = "open_caddie_prod";

export function prodCopyUrl(databaseUrl: string) {
  const url = new URL(databaseUrl);
  url.pathname = `/${PROD_COPY_DATABASE}`;
  return url.toString();
}
