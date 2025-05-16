
import type { Grid, SvgElementData } from './tromp-types';

let elementKeyCounter = 0;

export class NullGrid implements Grid {
  drawl(r: number, cstart: number, cend: number, name?: string, sourcePrimitiveName?: string, isHighlighted?: boolean): void {}
  drawv(rstart: number, rend: number, c: number, sourcePrimitiveName?: string, isHighlighted?: boolean): void {}
  drawfl(rstart: number, rend: number, cstart: number, cend: number, sourcePrimitiveName?: string, isHighlighted?: boolean): void {}
  drawbl(rstart: number, rend: number, cstart: number, cend: number, sourcePrimitiveName?: string, isHighlighted?: boolean): void {}
  drawu(rstart: number, rend: number, rback: number, cstart: number, cend: number, sourcePrimitiveName?: string, isHighlighted?: boolean): void {}
}

export class SvgCollectingGrid implements Grid {
  public svgElements: SvgElementData[] = [];

  constructor(scale: number) { 
    elementKeyCounter = 0; 
  }

  private nextKey(): string {
    return `tromp-elem-${elementKeyCounter++}`;
  }

  drawl(r: number, cstart: number, cend: number, name?: string, sourcePrimitiveName?: string, isHighlighted?: boolean): void {
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
      isHighlighted,
    });
  }

  drawv(rstart: number, rend: number, c: number, sourcePrimitiveName?: string, isHighlighted?: boolean): void {
    this.svgElements.push({
      type: 'line',
      key: this.nextKey(),
      x1: c,
      y1: rstart,
      x2: c,
      y2: rend,
      sourcePrimitiveName,
      isHighlighted,
    });
  }

  drawfl(rstart: number, rend: number, cstart: number, cend: number, sourcePrimitiveName?: string, isHighlighted?: boolean): void { 
    this.svgElements.push({
      type: 'polyline',
      key: this.nextKey(),
      points: `${cstart},${rstart} ${cstart},${rend} ${cend},${rend}`,
      sourcePrimitiveName,
      isHighlighted,
    });
  }

  drawbl(rstart: number, rend: number, cstart: number, cend: number, sourcePrimitiveName?: string, isHighlighted?: boolean): void { 
    this.svgElements.push({
      type: 'polyline',
      key: this.nextKey(),
      points: `${cstart},${rend} ${cend},${rend} ${cend},${rstart}`,
      sourcePrimitiveName,
      isHighlighted,
    });
  }

  drawu(rstart: number, rend: number, rback: number, cstart: number, cend: number, sourcePrimitiveName?: string, isHighlighted?: boolean): void { 
    this.svgElements.push({
      type: 'polyline',
      key: this.nextKey(),
      points: `${cstart},${rstart} ${cstart},${rend} ${cend},${rend} ${cend},${rback}`,
      sourcePrimitiveName,
      isHighlighted,
    });
  }
}
