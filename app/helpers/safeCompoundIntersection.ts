// @ts-nocheck
import paper from 'paper';

/**
 * Safely intersects a PathItem with a clip path.
 * For CompoundPaths, intersects each child individually and combines results.
 * This works around Paper.js bugs where intersect() fails on CompoundPaths.
 * See: https://github.com/paperjs/paper.js/issues/958
 */
export function safeCompoundIntersection(
  pathItem: paper.PathItem,
  clipPath: paper.PathItem,
  options?: { insert?: boolean }
): paper.PathItem {
  const opts = { insert: false, ...options };

  // Try normal intersection first
  const directResult = pathItem.intersect(clipPath, opts);
  if (directResult && !directResult.isEmpty()) {
    return directResult;
  }

  // Get children arrays (or single-element arrays for simple paths)
  const pathChildren = (pathItem as paper.CompoundPath).children;
  const clipChildren = (clipPath as paper.CompoundPath).children;

  const pathItems = (pathChildren && pathChildren.length > 0)
    ? pathChildren
    : [pathItem];
  const clipItems = (clipChildren && clipChildren.length > 0)
    ? clipChildren
    : [clipPath];

  // If neither is a compound path, return the (possibly empty) direct result
  if (pathItems.length === 1 && clipItems.length === 1) {
    return directResult;
  }

  // Intersect each combination of children and combine results
  let result: paper.PathItem | null = null;

  for (const pathChild of pathItems) {
    for (const clipChild of clipItems) {
      const intersection = pathChild.intersect(clipChild, { insert: false });
      if (intersection && !intersection.isEmpty()) {
        if (result === null) {
          result = intersection;
        } else {
          const united = result.unite(intersection, { insert: false });
          result.remove();
          intersection.remove();
          result = united;
        }
      }
    }
  }

  // Clean up the failed direct result
  if (directResult) {
    directResult.remove();
  }
  if (result && !result.isEmpty()) {
    console.warning('used safeCompoundIntersection fallback');
  }

  // Return result or empty path if nothing intersected
  return result || new paper.Path();
}
