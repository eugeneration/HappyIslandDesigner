import { Group, Path, Point, PointText, Raster, Size, view } from 'paper';
import i18next from 'i18next';
import PerspT from 'perspective-transform';

import { renderModal } from './modal';
import { createButton } from './createButton';
import { colors } from '../colors';
import { emitter } from '../emitter';
import { layers } from '../layers';
import { updateMapOverlay } from './screenshotOverlay';
import { loadImage } from '../load';

let switchMenu: paper.Group;

export function showSwitchModal(isShown) {
  if (switchMenu == null) {
    if (!isShown) return;
    renderScreenshotModal();
  }
  switchMenu.data.show(isShown);
}

class ZoomCanvas {
  private canvas: HTMLCanvasElement;

  constructor(event: paper.MouseEvent, zoomLevel: number) {
    const zoom = document.createElement("canvas");
    zoom.height = 200;
    zoom.width = 200;
    zoom.style.position = 'absolute';
    zoom.style.display = "block";
    document.body.appendChild(zoom);

    this.canvas = zoom;
    this.update(event, zoomLevel, event.point);
  }

  public update(event, zoomLevel: number, pointGlobalPosition: paper.Point) {
    const zoomSize = 100;
    const zoom = this.canvas;

    const pointCanvasPosition = layers.fixedLayer.globalToLocal(pointGlobalPosition);

    zoom.getContext("2d")?.drawImage(view.element,
        pointCanvasPosition.x * view.pixelRatio - zoomLevel * zoomSize * 0.5,
        pointCanvasPosition.y * view.pixelRatio - zoomLevel * zoomSize * 0.5,
        zoomLevel * zoomSize, zoomLevel * zoomSize,
        0, 0, zoomSize * 2, zoomSize * 2);

    if (event.event.touches) {
      if (event.event.touches.length > 0) {
      zoom.style.top = event.event.touches[0].pageY - 30 - zoomSize * 2 + "px";
      zoom.style.left = event.event.touches[0].pageX - zoomSize + "px";
      }
    } else {
        zoom.style.top = pointCanvasPosition.y - 10 - zoomSize * 2 + "px";
        zoom.style.left = pointCanvasPosition.x - 10 - zoomSize * 2 + "px";
    }
  }

  public remove() {
    this.canvas.remove();
  }
}

function renderScreenshotModal() {
  const isMobile = Math.min(view.bounds.width * view.scaling.x, view.bounds.height * view.scaling.y) < 400;
  const margin = isMobile ? 5 : 20;
  switchMenu = renderModal(i18next.t('load_game_map'), margin, margin, function() {showSwitchModal(false)}, {fullscreen: true});

  const uploadGroup = new Group();
  uploadGroup.applyMatrix = false;
  switchMenu.data.contents.addChild(uploadGroup);
  {
    var instructionImage = new Raster(
        isMobile ? 'static/img/screenshot-instructions-mobile.png': 'static/img/screenshot-instructions.png');
    instructionImage.scale(0.5);
    instructionImage.onLoad = function() {
      if (instructionImage.bounds.width > switchMenu.data.width) {
        instructionImage.scale(switchMenu.data.width / instructionImage.width);
        instructionImage.bounds.topCenter = new Point(0, 0);
      }
      if (instructionImage.bounds.height > switchMenu.data.height * 0.5) {
        instructionImage.scale((switchMenu.data.height * 0.5) / instructionImage.height);
        instructionImage.bounds.topCenter = new Point(0, 0);
      }

      const instructions = new PointText(instructionImage.bounds.bottomCenter.add(new Point(0, 60)));
      instructions.justification = 'center';
      instructions.fontFamily = 'TTNorms, sans-serif';
      instructions.fontSize = isMobile ? 14 : 18;
      instructions.fillColor = colors.text.color;
      instructions.content = i18next.t('load_game_map_instructions');

      const uploadIcon = new Raster('static/img/ui-upload-white.png');
      uploadIcon.scale(0.4);
      var uploadButton = createButton(uploadIcon, 30, function() {
        loadImage(loadMapImage);
      }, {
        alpha: .9,
        highlightedColor: colors.jaybird.color,
        selectedColor: colors.blue.color,
        disabledColor: colors.text.color,
      });
      uploadButton.position = instructions.position.add(new Point(0, 100));

      uploadGroup.addChildren([instructionImage, instructions, uploadButton]);
      uploadGroup.position = new Point(switchMenu.data.width / 2, switchMenu.data.height / 2);
    };
  }


  const mapImageGroup = new Group();
  mapImageGroup.applyMatrix = false;
  switchMenu.data.contents.addChildren([mapImageGroup]);

  let mapImage;
  function loadMapImage(image) {
    if (mapImage) mapImage.remove();

    mapImage = new Raster(image);
    mapImage.onLoad = function() {
      uploadGroup.visible = false;

      //var maxImageWidth = 700;
      //var maxImageHeight = 700;
      //var originalSize = new Size(mapImage.size);
      //var scale = Math.min(maxImageWidth / mapImage.width, maxImageHeight / mapImage.height);
      //console.log(maxImageWidth / mapImage.width, maxImageHeight / mapImage.height);
      //var newSize = originalSize * scale;
      //console.log(originalSize, scale, newSize)
      //mapImage.scale(scale);
      //var resampled = mapImage.rasterize(view.resolution / view.pixelRatio);
      //resampled.smoothing=false;
      //mapImage.remove();
      //mapImage = resampled;

      const newSize = mapImage.size;

      const margin = isMobile ? -34 : 0;
      mapImage.bounds.topLeft = new Point(0, 0);

      const maxImageWidth = switchMenu.data.width - margin * 2;
      const maxImageHeight = switchMenu.data.height - 100 - margin * 2; // need 100px for the button
      mapImageGroup.scaling = new Point(1, 1);
      mapImageGroup.scale(Math.min(maxImageWidth / newSize.width, maxImageHeight / newSize.height));
      mapImageGroup.position = new Point(margin, 0);

      const inverseScale = 1 / mapImageGroup.scaling.x;

      const closeIcon = new Raster('static/img/ui-x.png');
      closeIcon.scale(.5);
      const closeButton = createButton(closeIcon, 24, function(){mapImage.data.remove()}, {
        alpha: 0.9,
        highlightedColor: colors.paperOverlay.color,
        selectedColor: colors.paperOverlay2.color,
      });
      closeButton.scale(inverseScale);
      closeButton.position = mapImage.bounds.topRight;

      const confirmIcon = new Raster('static/img/ui-check-white.png');
      confirmIcon.scale(0.5);
      const confirmButton = createButton(confirmIcon, 30, function() {
        mapImage.data.perspectiveWarp();
        updateMapOverlay(mapImage.data.perspectiveWarpImage);
        switchMenu.data.show(false);
      }, {
        alpha: .9,
        highlightedColor: colors.jaybird.color,
        selectedColor: colors.blue.color,
        disabledColor: colors.text.color,
      });
      confirmButton.data.disable(true);
      confirmButton.bounds.topCenter = mapImage.bounds.bottomCenter.add(new Point(0, 58 * inverseScale));
      confirmButton.scale(inverseScale);
      emitter.on('screenshot_update_point', function(pointCount) {
        if (pointCount == 4) {
          confirmButton.data.disable(false);
        } else {
          confirmButton.data.disable(true);
        }
      });

      const mapImagePoints = new Group();
      mapImageGroup.addChildren([mapImage, mapImagePoints, confirmButton]);
      mapImageGroup.position = new Point(switchMenu.data.width / 2, switchMenu.data.height / 2);
      mapImageGroup.addChild(closeButton);

      mapImage.data.hoveredPoint = null;
      mapImage.data.grabbedPoint = null;
      mapImage.data.updateHoveredPoint = function(position) {
        const point = this.points.find(function(point) {
          return point.position.getDistance(position) < 80;
        });
        if (point != this.hoveredPoint) {
          const oldPoint = this.hoveredPoint;
          if (oldPoint) {
            oldPoint.data.hover(false);
          }
        }

        this.hoveredPoint = point;
        if (point) {
            point.data.hover(true);
        }
        return point;
      }

      mapImage.data.pointIndex = 0;
      mapImage.data.points = [];

      mapImage.onMouseMove = function(event) {
        // retain the same point after grab has begun
        if (this.data.grabbedPoint) return;
        const rawCoordinate = mapImageGroup.globalToLocal(event.point);
        this.data.updateHoveredPoint(rawCoordinate);
      }
      mapImage.onMouseDown = function(event) {

        const rawCoordinate = mapImageGroup.globalToLocal(event.point);

        this.data.updateHoveredPoint(rawCoordinate);
        if (this.data.hoveredPoint) {
            this.data.grabbedPoint = this.data.hoveredPoint;
            this.data.grabbedPoint.data.select(true);
            this.data.grabbedPoint.data.startPoint = rawCoordinate;
            this.data.grabbedPoint.data.grabPivot = rawCoordinate.subtract(this.data.grabbedPoint.position);
        }

        if (mapImage.data.points.length < 4 && !this.data.grabbedPoint) {

            const point = new Group();
            point.pivot = new Point(0, 0);
            point.applyMatrix = false;
            point.addChildren([
            new Path.Circle({
                center: [0, 0],
                radius: 1,
                fillColor: colors.yellow.color,
            }),
            new Path({
                segments: [[0, 3], [0, 8]],
                strokeWidth: 1,
                strokeColor: colors.yellow.color,
                strokeCap: 'round',
            }),
            new Path({
                segments: [[3, 0], [8, 0]],
                strokeWidth: 1,
                strokeColor: colors.yellow.color,
                strokeCap: 'round',
            }),
            new Path({
                segments: [[0, -3], [0, -8]],
                strokeWidth: 1,
                strokeColor: colors.yellow.color,
                strokeCap: 'round',
            }),
            new Path({
                segments: [[-3, 0], [-8, 0]],
                strokeWidth: 1,
                strokeColor: colors.yellow.color,
                strokeCap: 'round',
            }),
            new Path.Circle({
                center: [0, 0],
                radius: 15,
                fillColor: colors.invisible.color,
                strokeColor: colors.yellow.color,
                strokeWidth: 2,
            }),
            ]);
            point.scale(1 / mapImageGroup.scaling.x);
            point.position = rawCoordinate;
            point.data.startPoint = rawCoordinate;
            point.data.grabPivot = new Point(0, 0);
            point.locked = true;

            point.data.updateColor = function() {
            point.children.forEach(function(path) {
                path.strokeColor =
                point.data.selected ? colors.yellow.color
                : point.data.hovered ? colors.lightYellow.color : colors.yellow.color;
            })
            }
            point.data.hover = function(isHovered) {
            point.data.hovered = isHovered;
            point.data.updateColor();
            }
            point.data.select = function(isSelected) {
            point.data.selected = isSelected;
            point.data.updateColor();
            if (isMobile) point.scale(isSelected ? 0.4 / mapImageGroup.scaling.x : 1 / mapImageGroup.scaling.x);
            }

            mapImagePoints.addChild(point);

            mapImage.data.hoveredPoint = point;
            mapImage.data.grabbedPoint = point;
            point.data.hover(true);
            point.data.select(true);

            mapImage.data.pointIndex = mapImage.data.points.length;
            mapImage.data.points[mapImage.data.pointIndex] = point;
            emitter.emit('screenshot_update_point', mapImage.data.points.length);
          }

          if (this.data.grabbedPoint) {
            var zoomLevel = Math.min(0.8, 4 * mapImageGroup.scaling.x) * view.pixelRatio;
            mapImage.data.zoom = new ZoomCanvas(event, zoomLevel);
            // wait for the point to appear before grabbing canvas
            setTimeout(() => mapImage.data.zoom.update(event, zoomLevel, event.point), 100);
          }
        }
        mapImage.onMouseDrag = function(event) {
          const rawCoordinate = mapImageGroup.globalToLocal(event.point);

          const point = mapImage.data.grabbedPoint;
          if (point) {
            const delta = rawCoordinate.subtract(point.data.startPoint);
            point.position = point.data.startPoint.subtract(point.data.grabPivot).add(delta.multiply(isMobile ? 0.08 : 0.2));

            var zoomLevel = Math.min(0.8, 4 * mapImageGroup.scaling.x) * view.pixelRatio;
            mapImage.data.zoom.update(event, zoomLevel, mapImageGroup.localToGlobal(point.position));

            if (this.data.outline) {
              this.data.updateOutline();
            }
          }
        }
        mapImage.onMouseUp = function(event) {

          if (mapImage.data.zoom) {
            mapImage.data.zoom.remove();
            mapImage.data.zoom = null;
          }

          if (this.data.grabbedPoint) {
            this.data.grabbedPoint.data.select(false);
            this.data.grabbedPoint = null;
          }

          if (event.event.touches && this.data.hoveredPoint) {
            this.data.hoveredPoint.data.hover(false);
            this.data.hoveredPoint = null;
          }

          if (mapImage.data.points.length == 4) {
            this.data.updateOutline();
            //this.data.perspectiveWarp();
          }
        }
        mapImage.data.sortPoints = function() {
          // reorder the points to clockwise starting from top left
          {
              var points = mapImage.data.points;
              points.sort(function (a, b) {return a.position.y - b.position.y})

              function slope(a, b) {
                return (a.y - b.y) / (a.x - b.x);
              }

              // the top/bottom edge must contain the top point and has slope closest to zero
              function getHorizontalEdge(point, otherPoints) {
                otherPoints.sort(function(a, b) {return Math.abs(slope(a.position, point.position)) - Math.abs(slope(b.position, point.position))});
                const edgePoint = otherPoints[0];
                const edge = [edgePoint, point];
                edge.sort(function(a, b){return a.position.x - b.position.x});
                return edge;
              }

              const topEdge = getHorizontalEdge(points[0], points.slice(1, -1));
              const bottomEdge = getHorizontalEdge(points[3], points.slice(1, -1));

              mapImage.data.points = [
                topEdge[0], topEdge[1], bottomEdge[1], bottomEdge[0]
              ];
          }
        }
        mapImage.data.updateOutline = function() {
          if (this.outline) {
              this.outline.data.update();
              return;
          }

          const outline = new Group();
          outline.locked = true;

          const rect = new Path();
          rect.fillColor = colors.yellow.color;
          rect.opacity = 0.3;
          outline.data.rect = rect;
          outline.addChild(rect);

          const lines = new Group();
          outline.data.lines = lines;
          outline.addChild(lines);

          outline.data.update = function() {
            mapImage.data.sortPoints();
            outline.data.rect.segments = mapImage.data.points.map(function(p) { return p.position});

            if (!mapImage.data.flashingInterval) {
              mapImage.data.flashingInterval = setInterval(function() {
                if (uploadGroup.visible || !switchMenu.data.isShown()) {
                  clearInterval(mapImage.data.flashingInterval);
                  mapImage.data.flashingInterval = null;
                  return;
                }
                lines.opacity = lines.opacity == 0 ? 1 : 0;
              }, 500);
            }

            const perspectiveTransformMatrix = PerspT(
              [0, 0,
              5, 0,
              5, 4,
              0, 4],
              mapImage.data.points.reduce(function(acc, point) {
                acc.push(point.position.x, point.position.y); return acc;
              }, []));
            function calculateLines(p0: paper.Point, p1: paper.Point, axis: paper.Point, numLines: number) {
              var lines: Array<[number, number]> = [];
              for (let i = 0; i < numLines; i++) {
                const offset = new Point(axis.y, axis.x).multiply(1.1);

                const pp0 = p0.add(axis.multiply(i)).subtract(offset);
                const pp1 = p1.add(axis.multiply(i)).add(offset);
                lines.push([
                  perspectiveTransformMatrix.transform(pp0.x, pp0.y),
                  perspectiveTransformMatrix.transform(pp1.x, pp1.y)]);
              }
              return lines;
            }
            function drawLinePath(points: [number, number], index: number) {
              if (!outline.data.lines.children[index]) {
                const line = new Path.Line(points);
                line.strokeWidth = 1.5 / mapImageGroup.scaling.x;
                line.strokeColor = colors.white.color.clone();
                line.strokeColor.alpha = 0.3;
                outline.data.lines.addChild(line);
              }
              outline.data.lines.children[index].segments = points;
            }
            let index = 0;
            calculateLines(new Point(0, 0), new Point(0, 4),
              new Point(1, 0), 6)
                .forEach(function(line) {drawLinePath(line, index); index++})
            calculateLines(new Point(0, 0), new Point(5, 0),
              new Point(0, 1), 5)
                .forEach(function(line) {drawLinePath(line, index); index++})
          }.bind(this);
          outline.data.update();

          mapImageGroup.addChild(outline);
          this.outline = outline;
        }
        mapImage.data.perspectiveWarp = function() {
          return new Promise(function(onComplete) {
            const resultSize = new Size(700, 600);

            mapImage.data.sortPoints();

            const perspectiveTransformMatrix = PerspT(
              mapImage.data.points.reduce(function(acc, point) {
                acc.push(point.position.x, point.position.y); return acc;
              }, []),
              [0, 0,
              resultSize.width, 0,
              resultSize.width, resultSize.height,
              0, resultSize.height]);

            const mapImageData = mapImage.getImageData(0, 0, mapImage.width, mapImage.height);

            if (!mapImage.data.perspectiveWarpImage) {
              mapImage.data.perspectiveWarpImage = new Raster(resultSize);
              mapImageGroup.addChild(mapImage.data.perspectiveWarpImage);
              mapImage.data.perspectiveWarpImage.position = mapImage.position;
              //this.perspectiveWarpImage.scaling = 1 / mapImageGroup.scaling.x;

              mapImage.data.perspectiveWarpImage.scaling = 16 * 7 / resultSize.width;
              mapImage.data.perspectiveWarpImage.bounds.topCenter = mapImage.bounds.bottomCenter;
            }

            const context = mapImage.data.perspectiveWarpImage.context;

            const xScale = 7 / 5;
            const yScale = 6 / 4;

            const imageData = context.createImageData(resultSize.width, resultSize.height)
            for (let y = 0; y < resultSize.height; y++) {
              const rowIndex = y * resultSize.width;
              for (let x = 0; x < resultSize.width; x++) {
                const index = (rowIndex + x) * 4;

                // the points we want is actually an acre outside the bounds

                const mapPosX = x * xScale - resultSize.width / 5;
                const mapPosY = y * yScale - resultSize.height / 4;

                const srcPt = perspectiveTransformMatrix.transformInverse(mapPosX, mapPosY);
                const srcIndex = (Math.round(srcPt[0]) + Math.round(srcPt[1]) * mapImage.width) * 4;


                //console.log(x, y, '->', Math.round(srcPt[0]), Math.round(srcPt[1]), srcIndex);
                //var srcIndex = ((x) + (y + 10) * mapImage.width) * 4;

                imageData.data[index] = mapImageData.data[srcIndex];
                imageData.data[index+1] = mapImageData.data[srcIndex+1];
                imageData.data[index+2] = mapImageData.data[srcIndex+2];
                imageData.data[index+3] = mapImageData.data[srcIndex+3];
              }
            }
            context.putImageData(imageData, 0, 0);
            onComplete();
          });
        };
        mapImage.data.remove = function() {
          emitter.emit('screenshot_update_point', 0);
          mapImageGroup.removeChildren();
          uploadGroup.visible = true;
        }
      };
    }

  switchMenu.data.contents.addChildren([mapImageGroup]);
  switchMenu.opacity = 0;
}
