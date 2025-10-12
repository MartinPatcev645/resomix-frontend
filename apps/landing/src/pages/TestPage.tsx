import React, { useState } from "react";
import { StaticNoise } from "@resomix/ui";
// import { Terrain } from "@resomix/ui";

type Triplet = [number, number, number];

interface NoiseConfig {
  fps: number;
  dark: {
    enabled: boolean;
    color: Triplet;
    density: number;
    alpha: number;
    edge: number;
    radiusFactor: number;
    sizes: {
      sm: Triplet;
      md: Triplet;
      lg: Triplet;
    };
  };
  light: {
    enabled: boolean;
    color: Triplet;
    density: number;
    alpha: number;
    edge: number;
    radiusFactor: number;
    sizes: {
      sm: Triplet;
      md: Triplet;
      lg: Triplet;
    };
  };
}

const DEFAULT_CONFIG: NoiseConfig = {
  fps: 30,
  dark: {
    enabled: true,
    color: [5/255, 5/255, 5/255],   // 9/255, 9/255, 8/255
    density: 1,
    alpha: 0.99,
    edge: 0.4,
    radiusFactor: 0.5,
    sizes: {
      sm: [2.3, 2.8, 4.2],
      md: [2.5, 3.0, 4.5],
      lg: [2.7, 3.2, 4.8],
    },
  },
  light: {
    enabled: false,
    color: [22/255, 22/255, 21/255],
    density: 0.85,
    alpha: 0.9,
    edge: 0.5,
    radiusFactor: 0.5,
    sizes: {
      sm: [2.3, 2.8, 4.2],
      md: [2.5, 3.0, 4.5],
      lg: [2.7, 3.2, 4.8],
    },
  },
};

const TestPage: React.FC = () => {
  const [config, setConfig] = useState<NoiseConfig>(DEFAULT_CONFIG);
  const [applied, setApplied] = useState<NoiseConfig>(DEFAULT_CONFIG);

  const handleReset = () => {
    setConfig(DEFAULT_CONFIG);
    setApplied(DEFAULT_CONFIG);
  };

  const handleApply = () => {
    setApplied({ ...config });
  };

  const updateConfig = (path: string[], value: any) => {
    setConfig(prev => {
      const newConfig = JSON.parse(JSON.stringify(prev));
      let current = newConfig;
      for (let i = 0; i < path.length - 1; i++) {
        current = current[path[i]];
      }
      current[path[path.length - 1]] = value;
      return newConfig;
    });
  };

  return (
    <div className="w-screen h-screen overflow-auto bg-[#0A0A0A] text-white">
      <div className="max-w-7xl mx-auto p-8 relative z-10">
        {/* Preview Area */}
        <div className="mb-8 relative z-10">
          <h1 className="text-2xl font-bold mb-4">Static Noise Testing Suite</h1>
          <div 
            className="relative mx-auto bg-[var(--color-noise-background)] border border-gray-700 rounded-lg overflow-hidden"
            style={{ width: '66.67%', height: '50vh' }}
          >
            <StaticNoise
              className="pointer-events-none absolute inset-0"
              fps={applied.fps}
              dark={applied.dark}
              light={applied.light}
            />
            
            {/* Action Buttons */}
            <div className="absolute top-4 left-4 z-20 flex flex-col gap-2">
              <button
                onClick={handleApply}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors text-sm shadow-lg"
              >
                Apply Changes
              </button>
              <button
                onClick={handleReset}
                className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors text-sm shadow-lg"
              >
                Reset to Default
              </button>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="space-y-6 relative z-10">
          {/* FPS Control */}
          <div className="bg-[#1A1A1A] p-6 rounded-lg border border-gray-800">
            <h2 className="text-xl font-semibold mb-4">General Settings</h2>
            <div className="flex items-center gap-4">
              <label className="w-32 text-sm" title="Frames per second for noise animation">
                FPS:
              </label>
              <input
                type="number"
                value={config.fps}
                onChange={(e) => updateConfig(['fps'], Number(e.target.value))}
                className="w-20 px-3 py-1 bg-[#0A0A0A] border border-gray-700 rounded text-sm"
                min="1"
                max="60"
              />
              <span className="text-xs text-gray-500">Animation refresh rate</span>
            </div>
          </div>

          {/* Dark Layer Controls */}
          <LayerControls
            title="Dark Layer"
            config={config.dark}
            onUpdate={(field, value) => updateConfig(['dark', field], value)}
            onUpdateNested={(field, nested, value) => updateConfig(['dark', field, nested], value)}
          />

          {/* Light Layer Controls */}
          <LayerControls
            title="Light Layer"
            config={config.light}
            onUpdate={(field, value) => updateConfig(['light', field], value)}
            onUpdateNested={(field, nested, value) => updateConfig(['light', field, nested], value)}
          />
        </div>
      </div>

      {/* Terrain overlay at the top of the screen */}
      {/* <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          zIndex: 1,
          pointerEvents: "none",
          opacity: "60%",
        }}
      >
        <Terrain
          speed={1.2}
          segments={324}
          perlinPasses={1}
          elevation={1}
          noiseRange={2.14}
          sombreroAmplitude={0.6}
          sombreroFrequency={10}
          wireframe={true}
          wireframeColor="#FFFFFF"
          floorVisible={false}
        />
      </div> */}
    </div>
  );
};

interface LayerControlsProps {
  title: string;
  config: NoiseConfig['dark'] | NoiseConfig['light'];
  onUpdate: (field: string, value: any) => void;
  onUpdateNested: (field: string, nested: string, value: any) => void;
}

const LayerControls: React.FC<LayerControlsProps> = ({ title, config, onUpdate, onUpdateNested }) => {
  const disabled = !config.enabled;

  return (
    <div className="bg-[#1A1A1A] p-6 rounded-lg border border-gray-800">
      <div className="flex items-center gap-3 mb-4">
        <input
          type="checkbox"
          checked={config.enabled}
          onChange={(e) => onUpdate('enabled', e.target.checked)}
          className="w-5 h-5 cursor-pointer"
        />
        <h2 className="text-xl font-semibold">{title}</h2>
      </div>

      <div className="space-y-4 pl-8">
        {/* Color */}
        <div className="flex items-center gap-4">
          <label className="w-32 text-sm" title="RGB color values (0-1 range)">
            Color (RGB):
          </label>
          <div className="flex gap-2 items-center">
            <input
              type="number"
              value={(config.color[0] * 255).toFixed(0)}
              onChange={(e) => {
                const newColor: Triplet = [...config.color];
                newColor[0] = Number(e.target.value) / 255;
                onUpdate('color', newColor);
              }}
              disabled={disabled}
              className="w-16 px-2 py-1 bg-[#0A0A0A] border border-gray-700 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              min="0"
              max="255"
            />
            <input
              type="number"
              value={(config.color[1] * 255).toFixed(0)}
              onChange={(e) => {
                const newColor: Triplet = [...config.color];
                newColor[1] = Number(e.target.value) / 255;
                onUpdate('color', newColor);
              }}
              disabled={disabled}
              className="w-16 px-2 py-1 bg-[#0A0A0A] border border-gray-700 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              min="0"
              max="255"
            />
            <input
              type="number"
              value={(config.color[2] * 255).toFixed(0)}
              onChange={(e) => {
                const newColor: Triplet = [...config.color];
                newColor[2] = Number(e.target.value) / 255;
                onUpdate('color', newColor);
              }}
              disabled={disabled}
              className="w-16 px-2 py-1 bg-[#0A0A0A] border border-gray-700 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              min="0"
              max="255"
            />
            <div 
              className="w-12 h-8 border border-gray-700 rounded"
              style={{ 
                backgroundColor: `rgb(${config.color[0] * 255}, ${config.color[1] * 255}, ${config.color[2] * 255})` 
              }}
            />
          </div>
        </div>

        {/* Density */}
        <div className="flex items-center gap-4">
          <label className="w-32 text-sm" title="Percentage of dots shown (0 = none, 1 = all)">
            Density:
          </label>
          <input
            type="number"
            value={config.density}
            onChange={(e) => onUpdate('density', Number(e.target.value))}
            disabled={disabled}
            className="w-20 px-3 py-1 bg-[#0A0A0A] border border-gray-700 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            min="0"
            max="1"
            step="0.01"
          />
          <span className="text-xs text-gray-500">0.0 - 1.0</span>
        </div>

        {/* Alpha */}
        <div className="flex items-center gap-4">
          <label className="w-32 text-sm" title="Overall opacity of the dots">
            Alpha:
          </label>
          <input
            type="number"
            value={config.alpha}
            onChange={(e) => onUpdate('alpha', Number(e.target.value))}
            disabled={disabled}
            className="w-20 px-3 py-1 bg-[#0A0A0A] border border-gray-700 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            min="0"
            max="1"
            step="0.01"
          />
          <span className="text-xs text-gray-500">0.0 - 1.0</span>
        </div>

        {/* Edge */}
        <div className="flex items-center gap-4">
          <label className="w-32 text-sm" title="Softness of dot edges in pixels">
            Edge Softness:
          </label>
          <input
            type="number"
            value={config.edge}
            onChange={(e) => onUpdate('edge', Number(e.target.value))}
            disabled={disabled}
            className="w-20 px-3 py-1 bg-[#0A0A0A] border border-gray-700 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            min="0"
            max="5"
            step="0.1"
          />
          <span className="text-xs text-gray-500">Blur amount in pixels</span>
        </div>

        {/* Radius Factor */}
        <div className="flex items-center gap-4">
          <label className="w-32 text-sm" title="Dot size relative to cell size">
            Radius Factor:
          </label>
          <input
            type="number"
            value={config.radiusFactor}
            onChange={(e) => onUpdate('radiusFactor', Number(e.target.value))}
            disabled={disabled}
            className="w-20 px-3 py-1 bg-[#0A0A0A] border border-gray-700 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            min="0.1"
            max="1"
            step="0.05"
          />
          <span className="text-xs text-gray-500">0.1 - 1.0 (larger = bigger dots)</span>
        </div>

        {/* Sizes */}
        <div className="space-y-3 pt-2">
          <div>
            <label className="text-sm font-medium">Cell Sizes (px) - 3 layers per breakpoint:</label>
            <p className="text-xs text-gray-400 mt-1">
              Cell size controls the grid spacing for noise dots. Each breakpoint (sm/md/lg) has 3 layers of dots having different sizes that create depth. 
              <br />• <strong>sm</strong>: Small screens (&lt;640px) • <strong>md</strong>: Medium screens (640-1024px) • <strong>lg</strong>: Large screens (&gt;1024px)
            </p>
          </div>
          
          {/* Small */}
          <div className="flex items-center gap-4 pl-4">
            <label className="w-28 text-sm" title="Cell sizes for small screens (<640px)">
              Small (sm):
            </label>
            <div className="flex gap-2">
              {[0, 1, 2].map(i => (
                <input
                  key={i}
                  type="number"
                  value={config.sizes.sm[i]}
                  onChange={(e) => {
                    const newSizes: Triplet = [...config.sizes.sm];
                    newSizes[i] = Number(e.target.value);
                    onUpdateNested('sizes', 'sm', newSizes);
                  }}
                  disabled={disabled}
                  className="w-16 px-2 py-1 bg-[#0A0A0A] border border-gray-700 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  min="0.5"
                  max="20"
                  step="0.1"
                />
              ))}
            </div>
          </div>

          {/* Medium */}
          <div className="flex items-center gap-4 pl-4">
            <label className="w-28 text-sm" title="Cell sizes for medium screens (640-1024px)">
              Medium (md):
            </label>
            <div className="flex gap-2">
              {[0, 1, 2].map(i => (
                <input
                  key={i}
                  type="number"
                  value={config.sizes.md[i]}
                  onChange={(e) => {
                    const newSizes: Triplet = [...config.sizes.md];
                    newSizes[i] = Number(e.target.value);
                    onUpdateNested('sizes', 'md', newSizes);
                  }}
                  disabled={disabled}
                  className="w-16 px-2 py-1 bg-[#0A0A0A] border border-gray-700 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  min="0.5"
                  max="20"
                  step="0.1"
                />
              ))}
            </div>
          </div>

          {/* Large */}
          <div className="flex items-center gap-4 pl-4">
            <label className="w-28 text-sm" title="Cell sizes for large screens (>1024px)">
              Large (lg):
            </label>
            <div className="flex gap-2">
              {[0, 1, 2].map(i => (
                <input
                  key={i}
                  type="number"
                  value={config.sizes.lg[i]}
                  onChange={(e) => {
                    const newSizes: Triplet = [...config.sizes.lg];
                    newSizes[i] = Number(e.target.value);
                    onUpdateNested('sizes', 'lg', newSizes);
                  }}
                  disabled={disabled}
                  className="w-16 px-2 py-1 bg-[#0A0A0A] border border-gray-700 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  min="0.5"
                  max="20"
                  step="0.1"
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestPage;
