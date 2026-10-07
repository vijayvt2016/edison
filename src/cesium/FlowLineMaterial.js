import * as Cesium from "cesium";

// Custom polyline material: pulses that travel from the first to the last
// position of a line. Used for RF beams, jamming, reports and data packets.

const TYPE = "EdisonFlowLine";

Cesium.Material._materialCache.addMaterial(TYPE, {
  fabric: {
    type: TYPE,
    uniforms: {
      color: new Cesium.Color(1, 1, 1, 1),
      time: 0,
      speed: 1,
      repeat: 4,
      duty: 6,
      base: 0.18,
    },
    source: /* glsl */ `
      czm_material czm_getMaterial(czm_materialInput materialInput) {
        czm_material m = czm_getDefaultMaterial(materialInput);
        float s = clamp(fract(materialInput.st.s * repeat - time * speed), 0.0, 1.0);
        float head = pow(s, duty);
        float edge = clamp(1.0 - pow(clamp(abs(materialInput.st.t - 0.5) * 2.0, 0.0, 1.0), 2.0), 0.35, 1.0);
        m.diffuse = color.rgb;
        m.emission = color.rgb * head * 0.1;
        m.alpha = clamp(color.a * (base + (1.0 - base) * head) * edge, 0.0, 1.0);
        return m;
      }
    `,
  },
  translucent: () => true,
});

export class FlowLineMaterialProperty {
  /**
   * @param {object} o
   * @param {(time: Cesium.JulianDate) => Cesium.Color} o.color  color (alpha may animate)
   * @param {(time: Cesium.JulianDate) => number} o.clock  story-seconds getter
   */
  constructor({ color, clock, speed = 1, repeat = 4, duty = 6, base = 0.18 }) {
    this._color = color;
    this._clock = clock;
    this.speed = speed;
    this.repeat = repeat;
    this.duty = duty;
    this.base = base;
    this._definitionChanged = new Cesium.Event();
  }
  get isConstant() {
    return false;
  }
  get definitionChanged() {
    return this._definitionChanged;
  }
  getType() {
    return TYPE;
  }
  getValue(time, result) {
    result = result || {};
    result.color = this._color(time);
    result.time = this._clock(time);
    result.speed = this.speed;
    result.repeat = this.repeat;
    result.duty = this.duty;
    result.base = this.base;
    return result;
  }
  equals(other) {
    return this === other;
  }
}
