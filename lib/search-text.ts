export function normalizeSearchText(value: string): string {
  return value.trim().toLocaleLowerCase("tr");
}
