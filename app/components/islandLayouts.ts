
export interface Layout { name: string,  contributor: string, link?: string, data: string, quality: number }
export enum LayoutType { none = "", blank = "blank", west = "west", south = "south", east = "east"}

export const baseMapLayouts = {
  [LayoutType.blank]: [0],
  [LayoutType.east]: [36, 37, 38, 52, 53, 55, 60, 61, 63, 64, 67, 68, 69, 70, 71, 75, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93],
  [LayoutType.south]: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 19, 27, 29, 30, 31, 34, 40, 41, 42, 43, 45, 51, 96],
  [LayoutType.west]: [18, 20, 21, 22, 23, 24, 25, 26,28, 32, 33, 35, 39, 44, 46, 47, 48, 49, 50, 54, 56, 57, 58, 59, 62, 65, 66, 72, /* 73, */ 74, 76, 94, 95],
}
