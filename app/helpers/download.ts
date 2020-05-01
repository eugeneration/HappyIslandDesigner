import { saveAs } from 'file-saver';

export function downloadDataURLForiOSSafari(filename, data) {
  const image = new Image();
  image.src = data;
  image.addEventListener(
    'load',
    () => {
      saveAs(dataURLtoBlob(data), filename);
    }
  );
}

export function downloadDataURL(filename, data) {
  const element = document.createElement('a');
  element.setAttribute('href', data);
  element.setAttribute('download', filename);

  element.style.display = 'none';
  document.body.appendChild(element);

  element.click();


  document.body.removeChild(element);
}

export function downloadText(filename, text) {
  downloadDataURL(
    filename,
    `data:text/plain;charset=utf-8,${encodeURIComponent(text)}`,
  );
}

function dataURLtoBlob(dataurl) {
  var arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
      bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
  while(n--){
      u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], {type:mime});
}
