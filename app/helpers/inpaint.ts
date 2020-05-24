// @ts-nocheck
// from https://github.com/antimatter15/inpaint.js/blob/master/inpaint.js

// This file isn't very well documented, but that shouldn't be a huge problem
// because most of this is a fairly straightforward port of the scikit-image
// implementation which can be found in
// https://github.com/chintak/scikit-image/blob/inpaint/skimage/filter/_inpaint_fmm.pyx

import HeapQueue from './heapqueue';

export default function InpaintTelea(
  width: number,
  height: number,
  image: Uint8ClampedArray,
  mask: Uint8ClampedArray,
  radius?: number,
){
	if(!radius) radius = 5;

	var LARGE_VALUE = 1e6;
	var SMALL_VALUE = 1e-6;

	var size = width * height;
	var flag = new Uint8Array(size);
	var u = new Float32Array(size);

	for(var i = 0; i < size; i++){
		if(!mask[i]) continue;
		// this is the equivalent of doing a morphological dilation with
		// a 1-pixel cross structuring element for first pass through flag
		flag[i + 1] = flag[i] = flag[i - 1] = flag[i + width] = flag[i - width] = 1;
	}

	for(var i = 0; i < size; i++){
		flag[i] = (flag[i] * 2) - (mask[i] ^ flag[i])
		if(flag[i] == 2) // UNKNOWN
			u[i] = LARGE_VALUE;
	}


	var heap = new HeapQueue(function(a, b){ return a[0] - b[0] }) // sort by first thingy

	for(var i = 0; i < size; i++){
		if(flag[i] == 1) // BAND
			heap.push([u[i], i]);
	}

	var indices_centered = []
	// generate a mask for a circular structuring element
	for(var i = -radius; i <= radius; i++){
		var h = Math.floor(Math.sqrt(radius * radius - i * i))
		for(var j = -h; j <= h; j++)
			indices_centered.push(i + j * width);
	}

	// function eikonal(n1, n2){
	// 	var u1 = u[n1],
	// 		u2 = u[n2];
	// 	if(flag[n1] == 0 /*KNOWN*/){
	// 		if(flag[n2] == 0 /*KNOWN*/){
	// 			var perp = Math.sqrt(2 - Math.pow(u1 - u2, 2)); // perpendicular distance
	// 			var s = (u1 + u2 - perp) * 0.5; // average distance
	// 			if(s >= u1 && s >= u2) return s;
	// 			s += perp;
	// 			if(s >= u1 && s >= u2) return s;
	// 		}else{
	// 			return 1 + u1
	// 		}
	// 	}else if(flag[n2] == 0 /*KNOWN*/){
	// 		return 1 + u2;
	// 	}
	// 	return LARGE_VALUE
	// }

	function eikonal(n1, n2){
		var u_out = LARGE_VALUE,
			u1 = u[n1],
			u2 = u[n2];
		if(flag[n1] == 0){
			if(flag[n2] == 0){
				var perp = Math.sqrt(2 - (u1 - u2) * (u1 - u2));
				var s = (u1 + u2 - perp) * 0.5;
				if(s >= u1 && s >= u2){
					u_out = s
				}else{
					s += perp;
					if(s >= u1 && s >= u2){
						u_out = s;
					}
				}
			}else{
				u_out = 1 + u1
			}
		}else if(flag[n2] == 0){
			u_out = 1 + u2
		}
		return u_out
	}
	function inpaint_point(n){
		var Ia = 0, norm = 0;
		// var Jx = 0, Jy = 0;
		var gradx_u = grad_func(u, n, 1),
			grady_u = grad_func(u, n, width);

		var i = n % width,
			j = Math.floor(n / width);


		for(var k = 0; k < indices_centered.length; k++){
			var nb = n + indices_centered[k];
			var i_nb = nb % width,
				j_nb = Math.floor(nb / width);

			if(i_nb <= 1 || j_nb <= 1 || i_nb >= width - 1 || j_nb >= height - 1) continue;

			if(flag[nb] != 0 /*KNOWN*/) continue;

			var rx = i - i_nb,
				ry = j - j_nb;

			var geometric_dst = 1 / ((rx * rx + ry * ry) * Math.sqrt(rx * rx + ry * ry))
			var levelset_dst = 1 / (1 + Math.abs(u[nb] - u[n]))
			var direction = Math.abs(rx * gradx_u + ry * grady_u);
			var weight = geometric_dst * levelset_dst * direction + SMALL_VALUE;
			// var gradx_img = grad_func(image, nb, 1) + SMALL_VALUE,
			// 	grady_img = grad_func(image, nb, width) + SMALL_VALUE;

			Ia += weight * image[nb]
			// Jx -= weight * gradx_img * rx
			// Jy -= weight * grady_img * ry
			norm += weight
		}
		// the fmm.py which this is based on actually implements a slightly different
		// algorithm which apparently "considers the effect of gradient of intensity value"
		// which is some kind of voodoo magic that I don't understand which is apparently
		// in the OpenCV implementation. Unless I've been porting the algorithm wrong,
		// which is certainly a possibility and I invested quite a bit of effort into
		// that hypothesis by way of rewriting and checking every line of code a few
		// times.
		image[n] = Ia / norm;
		// image[n] = Ia / norm + (Jx + Jy) / Math.sqrt(Jx * Jx + Jy * Jy);
	}



	// this is meant to return the x-gradient
	function grad_func(array, n, step){
		if(flag[n + step] != 2 /* UNKNOWN */){
			if(flag[n - step] != 2){
				return (array[n + step] - array[n - step]) * 0.5
			}else{
				return array[n + step] - array[n]
			}
		}else{
			if(flag[n - step] != 2){
				return array[n] - array[n - step]
			}else{
				return 0
			}
		}
	}


	while(heap.length){
		var n = heap.pop()[1];
		var i = n % width,
			j = Math.floor(n / width);
		flag[n] = 0; // KNOWN
		if(i <= 1 || j <= 1 || i >= width - 1 || j >= height - 1) continue;
		for(var k = 0; k < 4; k++){
			var nb = n + [-width, -1, width, 1][k];
			if(flag[nb] != 0){ // not KNOWN
				u[nb] = Math.min(eikonal(nb - width, nb - 1),
                                 eikonal(nb + width, nb - 1),
                                 eikonal(nb - width, nb + 1),
                                 eikonal(nb + width, nb + 1));
				if(flag[nb] == 2){ // UNKNOWN
					flag[nb] = 1; // BAND
					heap.push([u[nb], nb])
					inpaint_point(nb)
				}
			}
		}
	}
	return image;
}
