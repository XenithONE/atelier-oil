export const PIGMENTS = [
  { name: "チタニウムホワイト", hex: "#F6F3E9" },
  { name: "アイボリーブラック", hex: "#242825" },
  { name: "バーントシェンナ", hex: "#984421" },
  { name: "イエローオーカー", hex: "#C49A43" },
  { name: "カドミウムイエロー", hex: "#FCD200" },
  { name: "カドミウムオレンジ", hex: "#EF791B" },
  { name: "バーミリオン", hex: "#D63620" },
  { name: "アリザリンクリムソン", hex: "#861A32" },
  { name: "ウルトラマリン", hex: "#002185" },
  { name: "フレンチウルトラマリン", hex: "#203BA8" },
  { name: "コバルトブルー", hex: "#266BB5" },
  { name: "ビリジアン", hex: "#176966" },
  { name: "テールベルト", hex: "#284A31" },
  { name: "サップグリーン", hex: "#47713B" },
  { name: "オリーブグリーン", hex: "#818331" },
  { name: "バーントアンバー", hex: "#50341F" },
];
export const colorName = (hex: string) =>
  PIGMENTS.find((p) => p.hex.toLowerCase() === hex.toLowerCase())?.name ??
  "調色した色";
