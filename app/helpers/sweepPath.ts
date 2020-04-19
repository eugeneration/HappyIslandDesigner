// assumes convex simple polygon with clockwise orientation
// otherwise I have to simplify the polygon after stretching points
export function sweepPath(path: paper.Path, sweepVector) {
  // find the lines w/ segment normals > 0
  if (sweepVector.x === 0 && sweepVector.y === 0) {
    return path;
  }

  const allFrontEdges: paper.Segment[][] = [];
  let frontEdge: paper.Segment[] = [];
  const sweepDirection = sweepVector.normalize();

  let isFirstFront = false;
  let isLastFront = false;

  let potentialPoints: paper.Segment[] = [];
  // go backwards so when I add indices I don't affect the index order
  for (let i = path.segments.length - 1; i >= 0; i--) {
    const p0 = path.segments[i];
    const p1 =
      path.segments[(i - 1 + path.segments.length) % path.segments.length];
    const normal = path.clockwise
      ? new paper.Point(
          p0.point.y - p1.point.y,
          p1.point.x - p0.point.x,
        ).normalize()
      : new paper.Point(
          p1.point.y - p0.point.y,
          p0.point.x - p1.point.x,
        ).normalize();
    const dot = normal.dot(sweepDirection);

    if (dot > 0) {
      if (i === path.segments.length - 1) {
        isFirstFront = true;
      }
      if (i === 0) {
        isLastFront = true;
      }

      if (potentialPoints.length > 0) {
        frontEdge.concat(potentialPoints);
        potentialPoints = [];
      }
      if (frontEdge.length === 0) {
        // if this is the first point found in this edge, also add the start point
        frontEdge.push(p0);
      }
      frontEdge.push(p1);
    } else if (dot === 0) {
      // include lines w/ normals ===0 if connected to line > 0
      if (frontEdge.length > 0) {
        potentialPoints.push(p1);
      }
    } else {
      if (frontEdge.length > 0) {
        allFrontEdges.push(frontEdge);
        frontEdge = [];
      }
      if (potentialPoints.length > 0) {
        potentialPoints = [];
      }
    }
  }
  if (frontEdge.length > 0) {
    allFrontEdges.push(frontEdge);
  }

  if (allFrontEdges.length === 0) {
    console.log('Did not find any points to sweep!');
    return path;
  }

  // check if there was a wrap around
  const isWrapped = isFirstFront && isLastFront;
  const skipFirst = allFrontEdges[0].length > 1;
  const skipLast = allFrontEdges[allFrontEdges.length - 1].length > 1;

  let first = true;
  allFrontEdges.forEach((frontEdge) => {
    // duplicate the first and last point in the edge
    // segments are in reverse index order

    const s0 = frontEdge[0];
    const s1 = frontEdge[frontEdge.length - 1];
    const s0Clone = s0.clone();
    const s1Clone = s1.clone();
    if (!(isWrapped && skipFirst && first)) {
      path.insert(s0.index + 1, s0Clone);
    }
    if (!(isWrapped && skipLast && s1.index === path.segments.length - 1)) {
      path.insert(s1.index, s1Clone);
    }
    frontEdge.forEach((s) => {
      // there is a duplicate when it wraps around
      if (isWrapped && first) {
        first = false;
      } else {
        s.point = s.point.add(sweepVector);
      }
    });
  });
  return path;
}
