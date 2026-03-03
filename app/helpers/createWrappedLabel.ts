import paper from 'paper';
import { colors } from '../colors';

const FONT_FAMILY = 'TTNorms, sans-serif';
const TITLE_FONT_SIZE = 16;
const SUB_FONT_SIZE = 11;
const LINE_HEIGHT = 18;

/**
 * Creates a label group with auto-wrapping title text and a subtitle.
 * Returns the group and the subtitle PointText (for updating text later).
 */
export function createWrappedLabel(
  title: string,
  subLabelContent: string,
  maxWidth: number,
): { group: paper.Group; subLabel: paper.PointText } {
  // Word-wrap: measure text width, split into lines that fit maxWidth
  const words = title.split(' ');
  const titleTexts: paper.PointText[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const temp = new paper.PointText({
      content: testLine,
      fontFamily: FONT_FAMILY,
      fontSize: TITLE_FONT_SIZE,
    });
    const fits = temp.bounds.width <= maxWidth;
    temp.remove();

    if (fits) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        const t = new paper.PointText(new paper.Point(0, titleTexts.length * LINE_HEIGHT));
        t.content = currentLine;
        t.justification = 'center';
        t.fontFamily = FONT_FAMILY;
        t.fontSize = TITLE_FONT_SIZE;
        t.fillColor = colors.text.color;
        titleTexts.push(t);
      }
      currentLine = word;
    }
  }
  // Push final line
  const lastLine = new paper.PointText(new paper.Point(0, titleTexts.length * LINE_HEIGHT));
  lastLine.content = currentLine;
  lastLine.justification = 'center';
  lastLine.fontFamily = FONT_FAMILY;
  lastLine.fontSize = TITLE_FONT_SIZE;
  lastLine.fillColor = colors.text.color;
  titleTexts.push(lastLine);

  // Subtitle below title lines
  const subLabel = new paper.PointText(new paper.Point(0, titleTexts.length * LINE_HEIGHT));
  subLabel.content = subLabelContent;
  subLabel.justification = 'center';
  subLabel.fontFamily = FONT_FAMILY;
  subLabel.fontSize = SUB_FONT_SIZE;
  subLabel.fillColor = colors.oceanText.color;

  // Size background to fit all items
  const allItems: paper.PointText[] = [...titleTexts, subLabel];
  let combinedBounds = allItems[0].bounds;
  for (let i = 1; i < allItems.length; i++) {
    combinedBounds = combinedBounds.unite(allItems[i].bounds);
  }

  const labelBg = new paper.Path.Rectangle(
    new paper.Rectangle(
      combinedBounds.x - 8,
      combinedBounds.y - 4,
      combinedBounds.width + 16,
      combinedBounds.height + 8
    ),
    new paper.Size(6, 6)
  );
  labelBg.fillColor = colors.paper.color;
  labelBg.opacity = 0.9;

  const group = new paper.Group([labelBg, ...titleTexts, subLabel]);
  group.applyMatrix = false;

  return { group, subLabel };
}
