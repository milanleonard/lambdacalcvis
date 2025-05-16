
import type { Grid, SvgElementData } from './tromp-types';

let elementKeyCounter = 0;

export class NullGrid implements Grid {
  drawl(r: number, cstart: number, cend: number, name?: string): void {}
  drawv(rstart: number, rend: number, c: number): void {}
  drawfl(rstart: number, rend: number, cstart: number, cend: number): void {}
  drawbl(rstart: number, rend: number, cstart: number, cend: number): void {}
  drawu(rstart: number, rend: number, rback: number, cstart: number, cend: number): void {}
}

export class SvgCollectingGrid implements Grid {
  public svgElements: SvgElementData[] = [];
  // private scale: number; // Not directly used for coordinates, but kept for consistency if needed later

  constructor(scale: number) {
    // this.scale = scale;
    elementKeyCounter = 0; // Reset for each new grid instance
  }

  private nextKey(): string {
    return `tromp-elem-${elementKeyCounter++}`;
  }

  drawl(r: number, cstart: number, cend: number, name?: string): void {
    let line_cstart = cstart - 1/3;
    let line_cend = cend + 1/3;
    
    // pylambdac: if cend < cstart: line_cstart = cstart; line_cend = cstart + 0.1;
    // This condition means the body was extremely narrow or empty, ending before it started.
    // If cend is the col index of the end of the body, and cstart is start col for lambda bar.
    // If body is 'x', cend might be cstart+1. So (cstart+1)-1/3.
    // The original python code's `cend` in `drawl(ro, co, e_c - 1, self.v)`: `e_c` is next avail col from body.
    // So `e_c-1` is the last column occupied by the body.
    if (cend < cstart) { // If body is so narrow its end column is before its start column for the bar
        line_cstart = cstart; 
        line_cend = cstart + 0.2; // Minimal bar length
    }


    this.svgElements.push({
      type: 'line',
      key: this.nextKey(),
      x1: line_cstart,
      y1: r,
      x2: line_cend,
      y2: r,
      title: name,
    });
  }

  drawv(rstart: number, rend: number, c: number): void {
    this.svgElements.push({
      type: 'line',
      key: this.nextKey(),
      x1: c,
      y1: rstart,
      x2: c,
      y2: rend,
    });
  }

  drawfl(rstart: number, rend: number, cstart: number, cend: number): void { // Forward L (┌)
    this.svgElements.push({
      type: 'polyline',
      key: this.nextKey(),
      points: `${cstart},${rstart} ${cstart},${rend} ${cend},${rend}`,
    });
  }

  drawbl(rstart: number, rend: number, cstart: number, cend: number): void { // Backward L (┐)
    this.svgElements.push({
      type: 'polyline',
      key: this.nextKey(),
      points: `${cstart},${rend} ${cend},${rend} ${cend},${rstart}`,
    });
  }

  drawu(rstart: number, rend: number, rback: number, cstart: number, cend: number): void { // U shape (┌┐)
    this.svgElements.push({
      type: 'polyline',
      key: this.nextKey(),
      points: `${cstart},${rstart} ${cstart},${rend} ${cend},${rend} ${cend},${rback}`,
    });
  }
}
