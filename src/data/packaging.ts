/**
 * Packaging Specifications Configuration
 * Stores actual packed weight and dimensions entered by admin.
 * Zero hardcoded guesses or assumptions.
 */

export interface PackageSpecs {
  sku: string;
  packSize: string;
  weightGrams?: number | null;
  lengthCm?: number | null;
  breadthCm?: number | null;
  heightCm?: number | null;
}

export interface ParcelDimensionsInput {
  weightGrams?: number | string | null;
  lengthCm?: number | string | null;
  breadthCm?: number | string | null;
  heightCm?: number | string | null;
}

/**
 * Validates and derives the parcel specifications for an order.
 * Strictly requires positive packed weight and box dimensions; does NOT invent default numbers.
 */
export function getEffectiveParcelSpecs(
  packSize: string,
  quantity: number = 1,
  override?: ParcelDimensionsInput
): {
  weightGrams: number;
  lengthCm: number;
  breadthCm: number;
  heightCm: number;
  sku: string;
  isValid: boolean;
} {
  const normalizedPack = (packSize || "").trim().toLowerCase();
  const sku = `SAF-MAKHANA-${normalizedPack.toUpperCase() || "CUSTOM"}`;

  const weight = override?.weightGrams ? Number(override.weightGrams) : 0;
  const length = override?.lengthCm ? Number(override.lengthCm) : 0;
  const breadth = override?.breadthCm ? Number(override.breadthCm) : 0;
  const height = override?.heightCm ? Number(override.heightCm) : 0;

  const isValid =
    !isNaN(weight) &&
    !isNaN(length) &&
    !isNaN(breadth) &&
    !isNaN(height) &&
    weight > 0 &&
    length > 0 &&
    breadth > 0 &&
    height > 0;

  return {
    weightGrams: weight,
    lengthCm: length,
    breadthCm: breadth,
    heightCm: height,
    sku,
    isValid,
  };
}
