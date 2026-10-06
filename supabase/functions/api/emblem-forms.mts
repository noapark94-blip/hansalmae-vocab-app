// Resolve only server-defined artwork; clients cannot supply arbitrary image URLs.
export function emblemImage(emblem: { id: string; image_path: string }, form?: string): string {
  return emblem.id === "title_dictionary" && form === "B"
    ? "./images/emblems/title-dictionary-b.png"
    : emblem.image_path;
}
