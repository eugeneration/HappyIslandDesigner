// @ts-nocheck
export function uniteCompoundPath(compound) {
  let p = new paper.Path();
  compound.children.forEach((c) => {
    const u = p.unite(c);
    p.remove();
    p = u;
  });
  compound.remove();
  return p;
}
