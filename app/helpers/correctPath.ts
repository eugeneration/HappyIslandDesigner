import { pointApproximates } from './pointApproximates';
import { getDistanceFromWholeNumber } from './getDistanceFromWholeNumber';

export function correctPath(path: paper.Path, receivingPath: paper.PathItem) {
  path.segments.forEach((segment) => {
    const { point } = segment;
    const isSegmentInvalid =
      getDistanceFromWholeNumber(point.x) > 0.1 ||
      getDistanceFromWholeNumber(point.y) > 0.1;
    if (!isSegmentInvalid) {
      return;
    }

    const prevIndex =
      (segment.index - 1 + path.segments.length) % path.segments.length;
    const nextIndex = (segment.index + 1) % path.segments.length;
    const prevPoint = path.segments[prevIndex].point;
    const nextPoint = path.segments[nextIndex].point;

    // todo: this assumes the problem point is always at .5,
    // which may not be true in degenerate cases
    const possiblePoint1 = point.subtract(
      new paper.Point(
        0.5 * Math.sign(prevPoint.x - point.x),
        0.5 * Math.sign(prevPoint.y - point.y),
      ),
    );
    const possiblePoint2 = point.subtract(
      new paper.Point(
        0.5 * Math.sign(nextPoint.x - point.x),
        0.5 * Math.sign(nextPoint.y - point.y),
      ),
    );

    if (
      pointApproximates(
        receivingPath.getNearestPoint(possiblePoint1),
        possiblePoint1,
      )
    ) {
      const crossPoint = possiblePoint2.subtract(
        new paper.Point(
          Math.sign(possiblePoint2.x - point.x),
          Math.sign(possiblePoint2.y - point.y),
        ),
      );
      path.insert(nextIndex, crossPoint);
      segment.point = possiblePoint1;
    } else {
      const crossPoint = possiblePoint1.subtract(
        new paper.Point(
          Math.sign(possiblePoint1.x - point.x),
          Math.sign(possiblePoint1.y - point.y),
        ),
      );
      path.insert(prevIndex + 1, crossPoint);
      segment.point = possiblePoint2;
    }
  });
}
