import paper from 'paper';
import { colors } from '../colors';
import { objectMap } from '../helpers/objectMap';

export type Options = {
  columnSpacing?: number;
  extraColumns?: number;
  extraRows?: number;
  horizontal?: boolean;
  margin?: number;
  noPointer?: boolean;
  perColumn?: number;
  spacing?: number;
};

export function createMenu(items, options: Options): paper.Group {
  const itemsCount = Object.keys(items).length;
  const spacing = !options.spacing ? 50 : options.spacing;
  const perColumn = !options.perColumn ? itemsCount : options.perColumn;
  const extraColumns = !options.extraColumns ? 0 : options.extraColumns;
  const extraRows = !options.extraRows ? 0 : options.extraRows;
  const columnSpacing = !options.columnSpacing ? 60 : options.columnSpacing;
  const horizontal = !options.horizontal ? false : options.horizontal;
  const noPointer = !options.noPointer ? false : options.noPointer;
  const margin = !options.margin ? 35 : options.margin;
  let i = 0;
  const iconMenu = new paper.Group();

  const columns = Math.ceil(itemsCount / perColumn) + extraColumns;

  const menuLongPosition = -margin;
  const menuShortPosition = -0.5 * columnSpacing;
  const menuLongDimension = 2 * margin + spacing * (perColumn - 1 + extraRows);
  const menuShortDimension = columnSpacing * columns;
  const backing = new paper.Path.Rectangle(
    new paper.Rectangle(
      horizontal ? menuLongPosition : menuShortPosition,
      horizontal ? menuShortPosition : menuLongPosition,
      horizontal ? menuLongDimension : menuShortDimension,
      horizontal ? menuShortDimension : menuLongDimension,
    ),
    new paper.Size(
      Math.min(columnSpacing / 2, 30),
      Math.min(columnSpacing / 2, 30),
    ),
  );
  backing.fillColor = colors.paper.color;

  let triangle: paper.Path.RegularPolygon;
  if (!noPointer) {
    triangle = new paper.Path.RegularPolygon(new paper.Point(0, 0), 3, 14);
    triangle.fillColor = colors.paper.color;
    triangle.rotate(-90);
    triangle.scale(0.5, 1);
    // respond to horizontal
    triangle.position = triangle.position.subtract(
      new paper.Point(30 + 3.5, 0),
    );
  } else {
    triangle = new paper.Path();
  }
  iconMenu.addChildren([backing, triangle]);

  const buttonMap = objectMap(items, (item) => {
    const column = Math.floor(i / perColumn);
    const buttonLongDimension = spacing * (i - column * perColumn);
    const buttonShortDimension = columnSpacing * (column + extraColumns);
    item.position = new paper.Point(
      horizontal ? buttonLongDimension : buttonShortDimension,
      horizontal ? buttonShortDimension : buttonLongDimension,
    );
    iconMenu.addChild(item);
    i += 1;
    return item;
  });

  iconMenu.data = {
    buttonMap,
    update(selectedButton: string) {
      Object.keys(buttonMap).forEach((name) => {
        buttonMap[name].data.select(name === selectedButton);
      });
    },
    setPointer(distance: number) {
      triangle.position = triangle.position.add(new paper.Point(0, distance));
    },
  };

  return iconMenu;
}
