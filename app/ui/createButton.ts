import paper from 'paper';
import { colors } from '../colors';

type buttonOptions = {
  alpha?: number
  highlightedColor?: paper.Color
  selectedColor?: paper.Color
  disabledColor?: paper.Color
};
export function createButton(item, buttonSize: number, onClick, options?: buttonOptions) {
  const alpha = options?.alpha ?? 0.0001;
  const highlightedColor = options?.highlightedColor?.clone() ?? colors.sand.color.clone();
  const selectedColor = options?.selectedColor?.clone() ?? colors.npc.color.clone();
  const disabledColor = options?.disabledColor?.clone() ?? null;

  const group = new paper.Group();

  const button = new paper.Path.Circle(new paper.Point(0, 0), buttonSize);

  group.applyMatrix = false;
  group.addChildren([button, item]);

  function updateColor(btn: paper.Path.Circle) {
    btn.fillColor =
      (group.data.disabled && disabledColor) ? disabledColor
      : (group.data.selected || group.data.pressed) ? selectedColor
      : highlightedColor;

    if (group.data.selected) {
      btn.fillColor.alpha = 1;
    } else if (group.data.pressed) {
      btn.fillColor.alpha = 0.5;
    } else if (group.data.hovered) {
      btn.fillColor.alpha = 1;
    } else {
      btn.fillColor.alpha = alpha;
    }
  }
  updateColor(button);

  group.data = {
    selected: false,
    hovered: false,
    pressed: false,
    disabled: false,
    select(isSelected) {
      group.data.selected = isSelected;
      updateColor(button);
    },
    hover(isHover) {
      group.data.hovered = isHover;
      updateColor(button);
    },
    press(isPressed) {
      group.data.pressed = isPressed;
      updateColor(button);
    },
    disable(isDisabled) {
      group.data.disabled = isDisabled;
      item.opacity = isDisabled ? 0.5 : 1;
      updateColor(button);
      if (isDisabled) {
        group.data.hover(false);
      }
    },
  };
  group.onMouseEnter = function () {
    if (group.data.disabled) {
      return;
    }
    group.data.hover(true);
  };
  group.onMouseLeave = function () {
    if (group.data.disabled) {
      return;
    }
    group.data.press(false);
    group.data.hover(false);
  };
  group.onMouseDown = function () {
    if (group.data.disabled) {
      return;
    }
    group.data.press(true);
  };
  group.onMouseUp = function (event) {
    if (group.data.disabled) {
      return;
    }
    if (group.data.pressed) {
      onClick(event, group);
    }
    group.data.press(false);
  };
  return group;
}
