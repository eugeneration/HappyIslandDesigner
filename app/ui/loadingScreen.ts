let element;

// this is a hack until React gets added
function createElement() {
  let div = document.createElement("div");
  div.id = 'bobContainer';

  let img = document.createElement("img");
  img.src = "static/gif/bob-loading.gif";
  img.id = "bob";

  let p = document.createElement("p");
  p.style.fontFamily = "TTNorms";
  p.style.color = "#726a5a";
  p.textContent = "Please wait a bit...";

  div.appendChild(img);
  div.appendChild(p);
  return div;
}
let hideTimeout;
export function showLoadingScreen(isShown) {
  if (!element) {
    element = createElement();
    document.body.appendChild(element);
  }

  clearTimeout(hideTimeout);
  if (isShown) {
    element.style.display = 'block';
  }
  // for some reason it needs a frame before it will animate the opacity
  setTimeout(() => element.style.opacity = isShown ? 1 : 0, 10);
  if (!isShown) {
    hideTimeout = setTimeout(() => element.style.display = 'none', 500);
  }
}
