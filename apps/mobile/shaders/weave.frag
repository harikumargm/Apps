#include <flutter/runtime_effect.glsl>

uniform float uTime;
uniform vec2 uResolution;

out vec4 fragColor;

void main() {
  vec2 uv = FlutterFragCoord().xy / uResolution;
  float warp = abs(fract(uv.y * 28.0 + sin(uTime * 0.4) * 0.03) - 0.5);
  float weft = abs(fract(uv.x * 28.0 + uv.y * 2.0) - 0.5);
  float cloth = smoothstep(0.09, 0.02, min(warp, weft));
  vec3 paper = vec3(0.953, 0.937, 0.902);
  vec3 indigo = vec3(0.114, 0.208, 0.341);
  fragColor = vec4(mix(paper, indigo, cloth * 0.8), 1.0);
}
