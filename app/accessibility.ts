// Where we put accessibility stuff!
// import { Point } from 'paper';
import { drawGrid, startDrawGrid, endDrawGrid } from './grid';

export var canvas = document.getElementById('canvas');
export var accessibleBrush:boolean = false;
export var accessibleCursor:paper.Point;

export function accessibleBrushSetter() {
    accessibleBrush = accessibleBrush ? false : true;
    accessibleCursor = new paper.Point(canvas!.getBoundingClientRect().width/2, canvas!.getBoundingClientRect().height/2);
}

export function accessibleDraw(state?: string) {
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