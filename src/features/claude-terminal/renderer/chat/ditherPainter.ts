import type { Painter } from './painter';

/**
 * Dither: a glow along the bottom with haze drifting up, drawn as square dots that are on or off by an 8×8 Bayer
 * matrix, after Magic UI's Dither ("horizon"). Written fresh as one small WebGL shader.
 */


/** Any CSS color as 0–1 RGB, read back from a one-pixel canvas so theme colors in any format work. */
function toRgb(color: string): [number, number, number] {
  const pixel = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  if (!pixel) return [0.5, 0.5, 0.5];
  pixel.fillStyle = color;
  pixel.fillRect(0, 0, 1, 1);
  const [r = 128, g = 128, b = 128] = pixel.getImageData(0, 0, 1, 1).data;
  return [r / 255, g / 255, b / 255];
}

/** Each dot's square in CSS pixels; one pixel of it is the gap. */
const CELL = 4;

const VERTEX = `attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAGMENT = `precision mediump float;
uniform vec2 res;
uniform float t;
uniform float clear;
uniform vec3 color;
float bayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
float bayer8(vec2 a) { return bayer4(0.5 * a) * 0.25 + bayer2(a); }
void main() {
  if (abs(gl_FragCoord.x - res.x * 0.5) < clear * 0.5) discard;
  vec2 cell = floor(gl_FragCoord.xy / ${CELL.toFixed(1)});
  vec2 inCell = mod(gl_FragCoord.xy, ${CELL.toFixed(1)});
  if (inCell.x >= ${(CELL - 1).toFixed(1)} || inCell.y >= ${(CELL - 1).toFixed(1)}) discard;
  vec2 uv = cell * ${CELL.toFixed(1)} / res;
  float glow = exp(-uv.y * 3.2);
  float haze = 0.5 + 0.5 * sin(uv.y * 13.0 - t * 0.5 + sin(uv.x * 5.0 + t * 0.23) * 1.3 + sin(uv.x * 11.0 - t * 0.17) * 0.4);
  float level = clamp(glow * 0.75 + haze * 0.35 * (1.0 - uv.y * 0.6) - 0.08, 0.0, 1.0);
  if (level <= bayer8(cell)) discard;
  float alpha = 0.35 + 0.45 * level;
  gl_FragColor = vec4(color * alpha, alpha);
}`;

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
}

/** Null when WebGL isn't available; the caller then uses another effect. */
export function createDitherPainter(canvas: HTMLCanvasElement): Painter | null {
  const gl = canvas.getContext('webgl', { premultipliedAlpha: true, antialias: false });
  if (!gl) return null;
  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
  const program = gl.createProgram();
  if (!vertex || !fragment || !program) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  // One triangle that covers the whole canvas.
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'p');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  const res = gl.getUniformLocation(program, 'res');
  const time = gl.getUniformLocation(program, 't');
  const clearAt = gl.getUniformLocation(program, 'clear');
  const colorAt = gl.getUniformLocation(program, 'color');
  let lastColor = '';

  return {
    // Drawn at one pixel per CSS pixel, not the screen's two: the dots are 4 px squares, so sharper costs four times the work for nothing.
    draw: (seconds, width, height, clear, color) => {
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(res, width, height);
      gl.uniform1f(time, seconds);
      gl.uniform1f(clearAt, clear);
      if (color !== lastColor) {
        gl.uniform3f(colorAt, ...toRgb(color));
        lastColor = color;
      }
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    dispose: () => {
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
    },
  };
}
