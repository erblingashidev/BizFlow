export const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024;

export type DetectedImage = { mime: "image/jpeg" | "image/png" | "image/webp"; ext: "jpg" | "png" | "webp" };

/**
 * Identifies an image by its file signature, not by the client-supplied name or MIME type,
 * so a renamed HTML/SVG/script file cannot be stored as a "product image".
 */
export function detectImageType(bytes: Uint8Array): DetectedImage | null {
  const at = (offset: number, sig: number[]) => sig.every((b, i) => bytes[offset + i] === b);
  if (bytes.length >= 3 && at(0, [0xff, 0xd8, 0xff])) return { mime: "image/jpeg", ext: "jpg" };
  if (bytes.length >= 8 && at(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { mime: "image/png", ext: "png" };
  if (bytes.length >= 12 && at(0, [0x52, 0x49, 0x46, 0x46]) && at(8, [0x57, 0x45, 0x42, 0x50])) {
    return { mime: "image/webp", ext: "webp" };
  }
  return null;
}

/** Storage object path for a product image; must match the products_image_path_scoped check. */
export function productImagePath(companyId: string, productId: string, fileId: string, ext: DetectedImage["ext"]) {
  return `${companyId}/products/${productId}/${fileId}.${ext}`;
}

/** True when `path` is an image path of this company's product (guards removals). */
export function isProductImagePath(path: string, companyId: string, productId: string): boolean {
  return path.startsWith(`${companyId}/products/${productId}/`) && !path.includes("..");
}
