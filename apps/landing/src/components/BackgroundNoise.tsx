import tvNoiseGif from "../assets/gifs/tv_noise.gif";

interface BackgroundNoiseProps {
  opacity?: number;
  zIndex?: number;
  className?: string;
}

export function BackgroundNoise({ 
  opacity = 0.30, 
  zIndex = 20, 
  className = "" 
}: BackgroundNoiseProps) {
  return (
    <div
      className={`absolute inset-0 pointer-events-none ${className}`}
      style={{
        backgroundImage: `url(${tvNoiseGif})`,
        backgroundSize: 'auto',
        backgroundRepeat: 'repeat',
        backgroundPosition: 'top left',
        opacity,
        zIndex,
      }}
      aria-hidden="true"
    />
  );
} 