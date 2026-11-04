/**
 * Natural ordering for apartment numbers ("A2" before "A10") and names.
 * Lists of tenants, invoices and meter readings use apartment order; anyone without an apartment
 * (former or unassigned tenants) comes after, alphabetically by name.
 */
const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base", ignorePunctuation: true });

export const compareText = (a: string, b: string) => collator.compare(a, b);

/** Apartment numbers in natural order; missing numbers sort last. */
export function compareApt(a: string | null | undefined, b: string | null | undefined) {
  if (a && b) return collator.compare(a, b);
  return a ? -1 : b ? 1 : 0;
}

/** Comparator: by apartment number, then by name (which also orders everyone without an apartment). */
export const byApartmentThenName =
  <T>(apt: (t: T) => string | null | undefined, name: (t: T) => string) =>
  (x: T, y: T) =>
    compareApt(apt(x), apt(y)) || collator.compare(name(x), name(y));
