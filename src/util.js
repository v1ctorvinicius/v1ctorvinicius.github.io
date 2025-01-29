function resizeRendererToDisplaySize(renderer) {
  const canvas = renderer.domElement;
  const clientWidth = canvas.clientWidth;
  const clientHeight = canvas.clientHeight;
  const needResize =
    canvas.width !== clientWidth || canvas.height !== clientHeight;
  if (needResize) {
    renderer.setSize(clientWidth, clientHeight, false);
  }
  return needResize;
}

async function loadShader(url) {
  const response = await fetch(url);
  return await response.text();
}

export { resizeRendererToDisplaySize, loadShader };
