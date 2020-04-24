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
