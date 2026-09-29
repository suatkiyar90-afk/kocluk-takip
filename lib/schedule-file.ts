export function isPdfUrl(url: string): boolean {
  const clean = url.split("?")[0].split("#")[0];
  return /\.pdf$/i.test(clean);
}

export function isImageUrl(url: string): boolean {
  const clean = url.split("?")[0].split("#")[0];
  return /\.(png|jpe?g|gif|webp|svg|avif|bmp)$/i.test(clean);
}
