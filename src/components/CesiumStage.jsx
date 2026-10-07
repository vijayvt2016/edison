import { useEffect, useRef } from "react";
import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import { createScenario } from "../scenario/buildScene";

// Owns the Cesium Viewer. Runs fully offline: bundled Natural Earth II imagery,
// ellipsoid terrain, no Cesium ion token required.
// Optional: set VITE_CESIUM_ION_TOKEN in .env.local for high-resolution imagery.
const ION_TOKEN = import.meta.env.VITE_CESIUM_ION_TOKEN;
if (ION_TOKEN) Cesium.Ion.defaultAccessToken = ION_TOKEN;

const baseLayer = () =>
  ION_TOKEN
    ? Cesium.ImageryLayer.fromWorldImagery()
    : Cesium.ImageryLayer.fromProviderAsync(
        Cesium.TileMapServiceImageryProvider.fromUrl(Cesium.buildModuleUrl("Assets/Textures/NaturalEarthII"))
      );

export default function CesiumStage({ onReady, onTick }) {
  const host = useRef(null);
  const tickRef = useRef(onTick);
  tickRef.current = onTick;

  useEffect(() => {
    const viewer = new Cesium.Viewer(host.current, {
      baseLayer: baseLayer(),
      terrainProvider: new Cesium.EllipsoidTerrainProvider(),
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      animation: false,
      timeline: false,
      fullscreenButton: false,
      infoBox: false,
      selectionIndicator: false,
      shouldAnimate: false,
    });

    const scene = viewer.scene;
    scene.backgroundColor = Cesium.Color.fromCssColorString("#04070A");
    scene.globe.baseColor = Cesium.Color.fromCssColorString("#0B1620");
    scene.globe.enableLighting = false;
    scene.moon.show = false;
    scene.fog.enabled = true;
    const base = viewer.imageryLayers.get(0);
    base.brightness = 0.62;
    base.saturation = 0.55;
    base.contrast = 1.15;
    base.gamma = 1.05;
    viewer.cesiumWidget.creditContainer.classList.add("credits");

    const ctl = createScenario(viewer, { onTick: (t, playing) => tickRef.current?.(t, playing) });
    onReady?.(ctl);

    // Opens on the wide constellation view; playback starts from the
    // "Start briefing" button (browsers only allow audio after a click).

    return () => {
      ctl.destroy();
      viewer.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={host} className="stage" />;
}
