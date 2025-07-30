// import tvNoiseGif from "../assets/gifs/tv_noise.gif";
import noiseImg from "../assets/noise-transparent.png";

interface BackgroundNoiseProps {
  opacity?: number;
  zIndex?: number;
  className?: string;
}

export function BackgroundNoise({ 
  opacity = 1, 
  zIndex = 10, 
  className = "" 
}: BackgroundNoiseProps) {
  return (
    <div
      className={`absolute inset-0 pointer-events-none ${className}`}
      style={{
        backgroundImage: `url(${noiseImg})`,
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
