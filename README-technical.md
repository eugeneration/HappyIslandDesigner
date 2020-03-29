# Happy Island Designer - Technical Details

## Overview

I used [Paper.js](http://paperjs.org/) as my primary library for drawing on the HTML `<canvas>`element. If you peek at the HTML you can see that the entire webpage is pretty much a single canvas. I did the dumb thing of creating everything - even all the UI - using canvas, but I hope to migrate most of the UI to React in the future.

If you peek at my code, you can also see that the entire webpage is pretty much a single massive `.js` file because I wanted to get something out as quickly as possible and didn't want to 'waste time' setting up a proper package manager system. This corner-cutting ended up biting me in the butt after just a few days of working on the project, but sunk cost fallacy told me to keep going so ~3400 lines later here we are now.

But if you want to get even more technical:

### Terrain/Path Drawing

[Paper.js](http://paperjs.org/) helps you render vector paths on canvas. I store a vector path for each terrain color. When you draw on the screen, I calculate the vector shape made by sweeping the brush shape from the prev to the current mouse position. Because the map only allows for straight or diagonal lines, I have to decompose the line into straight or diagonal lines. Once I have this shape, I can combine it with the existing terrain of that color. However, I first make sure that any invalid shapes are removed - two diagonals can result in an invalid wedge shape that I have to fill in. Also, to allow for undo/redo I find the difference between the old and new shape and store that into the history stack.

### Placing Objects

Objects are more simple. I load in the sprite file and check my reference to see what the grid size of the object is and create an appropriately sized box boundary. When encoding the map data, each object is represented as a minimal data structure that allows me to know which object to render when decoding a map from save data. The only tricky part here is that image files take some time to load, so I have to make sure my object rendering logic is asynchronous so that the icons are ready to go before I try to draw them on screen. This is why when you refresh the page, you'll see the terrain first and then a little bit later the icons appear.

## Store Data in the Image

I use a library called [Steganography.js](https://www.peter-eigenschink.at/projects/steganographyjs/) to store the map data into the unused alpha channel of the map image. I did it this way so that if you are working on multiple maps, you can know which map file you are loading in because you can see the full image of the island. If you fill the whole map with tons of objects you might run out of the limited space available in the image file and your map won't save properly (sorry!), but I hope to compress the map data to give you significantly more room in the save file.
