// Where we put accessibility stuff!
// import { Point } from 'paper';
import { drawGrid, startDrawGrid, endDrawGrid } from './grid';
import { layers } from './layers';

export var canvas = document.getElementById('canvas');
export var accessibleBrush:boolean = false;
export var accessibleCursor:paper.Point;
export var cursorIncrement:number;


export function accessibleBrushSetter() {
    // Initializes the accessible brush cursor, cursor increment and flag, intended to be called from keyboard.ts
    accessibleBrush = accessibleBrush ? false : true;
    cursorIncrement = layers.mapOverlayLayer.localToGlobal(
            new paper.Point(1, 1)
            ).x - 
        layers.mapOverlayLayer.localToGlobal(
            new paper.Point(0, 0)
            ).x;
    accessibleCursor = new paper.Point(
        layers.mapOverlayLayer.localToGlobal(new paper.Point(56, 48))
        );
}

export function updateCursor(event) {
    // Used to update the cursor to a new location from onMouseUp in index.ts
    accessibleCursor = new paper.Point(event.point);
}

export function accessibleDraw(state?: string) {
    // Go between for the various drawing functions, to be called from keyboard.ts
    switch (state) {
        case ('start'): 
            startDrawGrid(accessibleCursor);
            break;
        case ('stop'):
            endDrawGrid();
            break;
        default:
            drawGrid(accessibleCursor);
        }
}