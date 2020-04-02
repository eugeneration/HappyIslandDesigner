import paper from 'paper';
import { colors } from '../colors';

export function createButton(item, buttonSize, onClick, options?: any) {
  const highlightedColor =
    !options || options.highlightedColor == null
      ? colors.sand.color
      : options.highlightedColor;
  const selectedColor =
    !options || options.selectedColor == null
      ? colors.npc.color
      : options.selectedColor;

  const group = new paper.Group();

  const button = new paper.Path.Circle(0, 0, buttonSize);

  group.applyMatrix = false;
  group.addChildren([button, item]);

  function updateColor() {
    button.fillColor =
      group.data.selected || group.data.pressed
        ? selectedColor
        : highlightedColor;
    button.fillColor.alpha = group.data.selected
      ? 1
      : group.data.pressed
      ? 0.5
      : group.data.hovered
      ? 1
      : 0.0001;
  }
  updateColor();

  group.data = {
    selected: false,
    hovered: false,
    pressed: false,
    disabled: false,
    select(isSelected) {
      group.data.selected = isSelected;
      updateColor();
    },
    hover(isHover) {
      group.data.hovered = isHover;
      updateColor();
    },
    press(isPressed) {
      group.data.pressed = isPressed;
      updateColor();
    },
    disable(isDisabled) {
      group.data.disabled = isDisabled;
      item.opacity = isDisabled ? 0.5 : 1;
      if (isDisabled) group.data.hover(false);
    },
  };
  group.onMouseEnter = function (event) {
    if (group.data.disabled) return;
    group.data.hover(true);
  };
  group.onMouseLeave = function (event) {
    if (group.data.disabled) return;
    group.data.press(false);
    group.data.hover(false);
  };
  group.onMouseDown = function (event) {
    if (group.data.disabled) return;
    group.data.press(true);
  };
  group.onMouseUp = function (event) {
    if (group.data.disabled) return;
    if (group.data.pressed) onClick(event, group);
    group.data.press(false);
  };
  return group;
}
