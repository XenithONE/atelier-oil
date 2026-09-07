declare module "spectral.js" {
  export class Color {
    constructor(value: string | number[]);
    toString(options?: { format?: string; method?: string }): string;
    sRGB: number[];
  }
  export function mix(...colors: [Color, number][]): Color;
}
