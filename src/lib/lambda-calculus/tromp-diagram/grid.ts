
import type { Grid, SvgElementData } from './tromp-types';

let elementKeyCounter = 0;

export class NullGrid implements Grid {
  drawl(r: number, cstart: number, cend: number, name?: string, sourcePrimitiveName?: string): void {}
  drawv(rstart: number, rend: number, c: number, sourcePrimitiveName?: string): void {}
  drawfl(rstart: number, rend: number, cstart: number, cend: number, sourcePrimitiveName?: string): void {}
  drawbl(rstart: number, rend: number, cstart: number, cend: number, sourcePrimitiveName?: string): void {}
  drawu(rstart: number, rend: number, rback: number, cstart: number, cend: number, sourcePrimitiveName?: string): void {}
}

export class SvgCollectingGrid implements Grid {
  public svgElements: SvgElementData[] = [];

  constructor(scale: number) { // scale not directly used here but kept for API consistency
    elementKeyCounter = 0; 
  }

  private nextKey(): string {
    return `tromp-elem-${elementKeyCounter++}`;
  }

  drawl(r: number, cstart: number, cend: number, name?: string, sourcePrimitiveName?: string): void {
    let line_cstart = cstart - 1/3;
    let line_cend = cend + 1/3;
    
    if (cend < cstart) { 
        line_cstart = cstart; 
        line_cend = cstart + 0.2; 
    }

    this.svgElements.push({
      type: 'line',
      key: this.nextKey(),
      x1: line_cstart,
      y1: r,
      x2: line_cend,
      y2: r,
      title: name,
      sourcePrimitiveName,
    });
  }

  drawv(rstart: number, rend: number, c: number, sourcePrimitiveName?: string): void {
    this.svgElements.push({
      type: 'line',
      key: this.nextKey(),
      x1: c,
      y1: rstart,
      x2: c,
      y2: rend,
      sourcePrimitiveName,
    });
  }

  drawfl(rstart: number, rend: number, cstart: number, cend: number, sourcePrimitiveName?: string): void { 
    this.svgElements.push({
      type: 'polyline',
      key: this.nextKey(),
      points: `${cstart},${rstart} ${cstart},${rend} ${cend},${rend}`,
      sourcePrimitiveName,
    });
  }

  drawbl(rstart: number, rend: number, cstart: number, cend: number, sourcePrimitiveName?: string): void { 
    this.svgElements.push({
      type: 'polyline',
      key: this.nextKey(),
      points: `${cstart},${rend} ${cend},${rend} ${cend},${rstart}`,
      sourcePrimitiveName,
    });
  }

  drawu(rstart: number, rend: number, rback: number, cstart: number, cend: number, sourcePrimitiveName?: string): void { 
    this.svgElements.push({
      type: 'polyline',
      key: this.nextKey(),
      points: `${cstart},${rstart} ${cstart},${rend} ${cend},${rend} ${cend},${rback}`,
      sourcePrimitiveName,
    });
  }
}
