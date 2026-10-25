import type { Part } from "./api";

// Supplier product types are stored alongside the original component parameters.
export function getProductType(part: Pick<Part, "specs" | "category">): string {
  return (
    part.specs["商品类型"]?.trim() ||
    part.specs["器件类型"]?.trim() ||
    part.category
  );
}
